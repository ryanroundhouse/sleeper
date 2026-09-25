/*
 * Shared data loader for the Sleeper league pages.
 *
 * Every page first renders the committed snapshot (web_interface_data.json and
 * the league_*.json files). When live view is enabled the page then reads the
 * Sleeper API directly and keeps polling: every `fast` ms while scores are
 * changing, backing off to `slow` ms after two quiet polls. If the API cannot
 * be reached the snapshot stays on screen and the header says so.
 *
 * Archived seasons load this same file with live view off.
 *
 * Works as a browser global (window.SleeperLive) and as a CommonJS module for
 * the node tests.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SleeperLive = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const API_BASE = 'https://api.sleeper.app/v1';
    const PLAYER_DB_URL = `${API_BASE}/players/nfl`;
    const PLAYER_DB_CACHE = 'sleeper-player-db-v1';
    const PLAYER_DB_MAX_AGE_MS = 24 * 60 * 60 * 1000;
    const DEFAULT_FAST_MS = 60 * 1000;
    const DEFAULT_SLOW_MS = 5 * 60 * 1000;

    const round2 = (n) => Math.round(n * 100) / 100;

    /* ---------- pure helpers (unit tested) ---------- */

    /** Season Points For per roster: the sum of starter points across every scored week. */
    function computePointsFor(weeks) {
        const totals = {};
        (weeks || []).forEach((week) => {
            (week.matchups || []).forEach((m) => {
                totals[m.roster_id] = (totals[m.roster_id] || 0) + (m.total_points || 0);
            });
        });
        Object.keys(totals).forEach((id) => { totals[id] = round2(totals[id]); });
        return totals;
    }

    /** Adaptive poll interval: fast while scores move, slow after two quiet polls. */
    function createBackoff({ fast = DEFAULT_FAST_MS, slow = DEFAULT_SLOW_MS } = {}) {
        let quietPolls = 0;
        return {
            next(changed) {
                quietPolls = changed ? 0 : quietPolls + 1;
                return quietPolls >= 2 ? slow : fast;
            },
        };
    }

    /** Build the same shape the Python snapshot writes, from raw API responses. */
    function formatWeb({ league, users, rosters, matchupsByWeek, currentWeek, leagueId, players }) {
        const teams = {};
        users.forEach((user) => {
            const roster = rosters.find((r) => r.owner_id === user.user_id);
            if (!roster) return;
            const displayName = user.display_name || 'Unknown';
            teams[roster.roster_id] = {
                display_name: displayName,
                team_name: (user.metadata && user.metadata.team_name) || displayName,
            };
        });

        const weeks = [];
        Object.keys(matchupsByWeek)
            .map(Number)
            .sort((a, b) => a - b)
            .forEach((week) => {
                const matchups = matchupsByWeek[week];
                if (!matchups) return;
                weeks.push({
                    week,
                    matchups: matchups.map((m) => {
                        const team = teams[m.roster_id] || { display_name: 'Unknown', team_name: 'Unknown' };
                        const startersPoints = m.starters_points || [];
                        return {
                            roster_id: m.roster_id,
                            team_name: team.team_name,
                            display_name: team.display_name,
                            total_points: round2(startersPoints.reduce((a, b) => a + (b || 0), 0)),
                            starters: m.starters || [],
                            starters_points: startersPoints,
                            players_points: m.players_points || {},
                            matchup_id: m.matchup_id,
                        };
                    }),
                });
            });

        return {
            weeks,
            teams,
            players: players || {},
            league_info: {
                name: league.name || 'Unknown League',
                league_id: leagueId,
                season: league.season,
                status: league.status,
                current_week: currentWeek,
                total_rosters: league.total_rosters,
            },
        };
    }

    /** Player ids referenced by rosters or matchups that the embedded subset does not know. */
    function unknownPlayerIds(web, rosters) {
        const known = web.players || {};
        const unknown = new Set();
        // "0" is Sleeper's marker for an empty lineup slot, not a player
        const check = (id) => { if (id && id !== '0' && !known[id]) unknown.add(id); };
        (rosters || []).forEach((r) => (r.players || []).forEach(check));
        (web.weeks || []).forEach((w) => (w.matchups || []).forEach((m) => {
            (m.starters || []).forEach(check);
            Object.keys(m.players_points || {}).forEach(check);
        }));
        return unknown;
    }

    /** A week counts once at least one team has scored; before kickoff every total is zero. */
    function weekHasScores(week) {
        return (week.matchups || []).some((m) => (m.total_points || 0) > 0);
    }

    /** Latest scored week: the highest week in which any team has points; the highest week at all if none do. */
    function latestScoredWeek(weeks) {
        const numbers = (weeks || []).filter(weekHasScores).map((w) => w.week);
        if (!numbers.length) (weeks || []).forEach((w) => numbers.push(w.week));
        return numbers.length ? Math.max(...numbers) : null;
    }

    function scoreSignature(web) {
        if (!web) return null;
        return JSON.stringify((web.weeks || []).map((w) => [w.week, (w.matchups || []).map((m) => [m.roster_id, m.total_points])]));
    }

    function hasScoresChanged(prevWeb, nextWeb) {
        if (!prevWeb) return true;
        return scoreSignature(prevWeb) !== scoreSignature(nextWeb);
    }

    /* ---------- fetching ---------- */

    async function fetchJson(url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        return response.json();
    }

    async function loadSnapshot() {
        const web = await fetchJson('web_interface_data.json');
        const leagueId = web.league_info.league_id;
        const [leagueInfo, users, rosters] = await Promise.all([
            fetchJson(`league_${leagueId}_info.json`),
            fetchJson(`league_${leagueId}_users.json`),
            fetchJson(`league_${leagueId}_rosters.json`),
        ]);
        return {
            web, leagueInfo, users, rosters,
            source: 'snapshot',
            updatedAt: web.league_info.snapshot_time ? new Date(web.league_info.snapshot_time) : null,
        };
    }

    let playerDbPromise = null;   // parsed once per page load
    const unresolvableIds = new Set(); // ids the full database does not know either

    /** Sleeper asks for at most one download of the full player file per day; cache it. */
    function loadFullPlayerDb() {
        if (!playerDbPromise) {
            playerDbPromise = fetchFullPlayerDb().catch((err) => { playerDbPromise = null; throw err; });
        }
        return playerDbPromise;
    }

    async function fetchFullPlayerDb() {
        if (typeof caches === 'undefined') return fetchJson(PLAYER_DB_URL);
        const cache = await caches.open(PLAYER_DB_CACHE);
        const cached = await cache.match(PLAYER_DB_URL);
        if (cached) {
            const fetchedAt = Number(cached.headers.get('x-fetched-at')) || 0;
            if (Date.now() - fetchedAt < PLAYER_DB_MAX_AGE_MS) return cached.json();
        }
        const response = await fetch(PLAYER_DB_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${PLAYER_DB_URL}`);
        const body = await response.text();
        await cache.put(PLAYER_DB_URL, new Response(body, {
            headers: { 'content-type': 'application/json', 'x-fetched-at': String(Date.now()) },
        }));
        return JSON.parse(body);
    }

    async function resolvePlayers(knownPlayers, ids) {
        const wanted = [...ids].filter((id) => !unresolvableIds.has(id));
        if (wanted.length === 0) return knownPlayers;
        const players = { ...knownPlayers };
        try {
            const db = await loadFullPlayerDb();
            wanted.forEach((id) => {
                const p = db[id];
                if (!p) { unresolvableIds.add(id); return; }
                players[id] = {
                    name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
                    position: p.position || 'N/A',
                    team: p.team || 'N/A',
                };
            });
        } catch (err) {
            console.warn('Could not load full player database for unknown players:', err);
        }
        return players;
    }

    async function loadLive(leagueId, knownPlayers) {
        const [league, users, rosters, state] = await Promise.all([
            fetchJson(`${API_BASE}/league/${leagueId}`),
            fetchJson(`${API_BASE}/league/${leagueId}/users`),
            fetchJson(`${API_BASE}/league/${leagueId}/rosters`),
            fetchJson(`${API_BASE}/state/nfl`),
        ]);
        const frozen = league.status === 'complete' || String(league.season) !== String(state.season);
        const currentWeek = frozen
            ? ((league.settings && (league.settings.last_scored_leg || league.settings.leg)) || state.week || 1)
            : (state.week || 1);
        const weekNumbers = Array.from({ length: currentWeek }, (_, i) => i + 1);
        const weekResults = await Promise.all(weekNumbers.map((w) => fetchJson(`${API_BASE}/league/${leagueId}/matchups/${w}`)));
        const matchupsByWeek = {};
        weekNumbers.forEach((w, i) => { matchupsByWeek[w] = weekResults[i]; });

        let web = formatWeb({ league, users, rosters, matchupsByWeek, currentWeek, leagueId, players: knownPlayers });
        web.players = await resolvePlayers(knownPlayers, unknownPlayerIds(web, rosters));
        return { web, leagueInfo: league, users, rosters, source: 'live', updatedAt: new Date() };
    }

    /* ---------- status line in the page header ---------- */

    function formatTime(date) {
        if (!date) return 'unknown time';
        const sameDay = date.toDateString() === new Date().toDateString();
        return sameDay
            ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })
            : date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    function statusElement() {
        if (typeof document === 'undefined') return null;
        let el = document.getElementById('live-status');
        if (!el) {
            const header = document.querySelector('.header');
            if (!header) return null;
            el = document.createElement('span');
            el.id = 'live-status';
            (header.querySelector('.edition-subtitle') || header).appendChild(el);
        }
        return el;
    }

    function setStatus(text, kind) {
        const el = statusElement();
        if (!el) return;
        el.textContent = kind === 'live' ? 'Live' : text;
        el.title = text;
        el.setAttribute('aria-label', text);
        el.dataset.kind = kind;
    }

    /* ---------- orchestration ---------- */

    /**
     * Load data and hand it to the page.
     *   opts.live    - poll the Sleeper API after rendering the snapshot (default true)
     *   opts.onData  - called with {web, leagueInfo, users, rosters, source, updatedAt} every time data arrives;
     *                  awaited, so renders never interleave
     *   opts.onError - called if not even the snapshot could be loaded
     */
    async function start(opts) {
        const { live = true, onData, onError, fast, slow } = opts;
        let snapshot = null;
        try {
            snapshot = await loadSnapshot();
            await onData(snapshot);
        } catch (err) {
            console.error('Snapshot load failed:', err);
            if (!live) { onError && onError(err); return; }
        }

        if (!live) {
            setStatus(`Final snapshot from ${formatTime(snapshot.updatedAt)}`, 'snapshot');
            return;
        }

        if (!snapshot) setStatus('Loading live data…', 'loading');
        const leagueId = snapshot ? snapshot.web.league_info.league_id : opts.leagueId;
        if (!leagueId) { onError && onError(new Error('No league id available')); return; }

        const backoff = createBackoff({ fast, slow });
        let lastWeb = snapshot ? snapshot.web : null;
        let knownPlayers = snapshot ? snapshot.web.players : {};
        let timer = null;
        let inFlight = false;
        let lastLive = null;

        async function poll() {
            if (inFlight) return;
            inFlight = true;
            timer = null;
            let delay;
            try {
                const data = await loadLive(leagueId, knownPlayers);
                knownPlayers = data.web.players;
                const changed = hasScoresChanged(lastWeb, data.web);
                lastWeb = data.web;
                lastLive = data;
                await onData(data);
                setStatus(`Live · updated ${formatTime(data.updatedAt)}`, 'live');
                delay = backoff.next(changed);
            } catch (err) {
                console.warn('Live data unavailable:', err);
                if (lastLive) {
                    setStatus(`Live unavailable · showing data from ${formatTime(lastLive.updatedAt)}`, 'stale');
                    delay = backoff.next(false);
                } else if (snapshot) {
                    setStatus(`Live unavailable · showing snapshot from ${formatTime(snapshot.updatedAt)}`, 'stale');
                    delay = backoff.next(false);
                } else {
                    onError && onError(err); // nothing to show; stop polling
                }
            } finally {
                inFlight = false;
            }
            if (delay !== undefined) schedule(delay);
        }

        function schedule(delay) {
            if (typeof document !== 'undefined' && document.hidden) return; // resume on visibilitychange
            timer = setTimeout(poll, delay);
        }

        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                // Resume only if no poll is scheduled or running (poll() itself guards inFlight)
                if (!document.hidden && timer === null) poll();
            });
        }
        poll();
    }

    return {
        computePointsFor, createBackoff, formatWeb, unknownPlayerIds, hasScoresChanged, weekHasScores, latestScoredWeek,
        loadSnapshot, loadLive, start,
    };
});
