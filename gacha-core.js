/* Daily draws are browser-local; all dates use the league's Toronto calendar. */
(function (root) {
    'use strict';
    const calendar = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
    });
    function dayAt(date) {
        const parts = Object.fromEntries(calendar.formatToParts(date).map(p => [p.type, p.value]));
        return `${parts.year}-${parts.month}-${parts.day}`;
    }
    function nextReset(now) {
        // Find the next calendar boundary, including the 23- and 25-hour DST days.
        let low = now.getTime();
        let high = low + 26 * 60 * 60 * 1000;
        const today = dayAt(now);
        while (high - low > 1) {
            const middle = Math.floor((low + high) / 2);
            if (dayAt(new Date(middle)) === today) low = middle;
            else high = middle;
        }
        return high;
    }
    function draftPool(picks) {
        if (!Array.isArray(picks)) throw new Error('Draft data is unavailable.');
        return [...new Map(picks.filter(p => p.player_id && p.metadata).map(p => {
            const name = [p.metadata.first_name, p.metadata.last_name].filter(Boolean).join(' ');
            return [String(p.player_id), {
                id: String(p.player_id), name: name || String(p.player_id),
                position: p.metadata.position || '', team: p.metadata.team || 'FA',
            }];
        })).values()];
    }
    function createMachine({ storage, key, clock = () => new Date(), random = Math.random }) {
        function read() {
            const raw = storage.getItem(key);
            if (raw === null) return [];
            const data = JSON.parse(raw);
            if (data.version !== 1 || !Array.isArray(data.history) || data.history.some(entry =>
                !entry || !entry.player || typeof entry.player.id !== 'string' ||
                typeof entry.player.name !== 'string' || typeof entry.season !== 'string' ||
                typeof entry.at !== 'string' || !Number.isFinite(Date.parse(entry.at)))) {
                throw new Error('Saved draw history cannot be read.');
            }
            return data.history;
        }
        function today(history, now) {
            return history.filter(entry => dayAt(new Date(entry.at)) === dayAt(now));
        }
        return {
            status() {
                const history = read();
                const now = clock();
                return { history, remaining: Math.max(0, 3 - today(history, now).length), resetAt: nextReset(now) };
            },
            // Caller holds a Web Lock across this read/choose/save transaction.
            draw(pool, season) {
                const history = read();
                const now = clock();
                const drawn = today(history, now);
                if (drawn.length >= 3) throw new Error('All three draws are used. Come back tomorrow!');
                const available = pool.filter(player => !drawn.some(entry => entry.player.id === player.id));
                if (!available.length) throw new Error('No drafted players are available to draw.');
                const player = available[Math.floor(random() * available.length)];
                const entry = { player, season: String(season), at: now.toISOString() };
                // A failed write must not reveal an uncounted draw.
                storage.setItem(key, JSON.stringify({ version: 1, history: [...history, entry] }));
                return entry;
            },
        };
    }
    const api = { createMachine, draftPool, dayAt, nextReset };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.GachaCore = api;
})(typeof window === 'undefined' ? globalThis : window);
