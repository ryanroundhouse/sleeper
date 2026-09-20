/* One shared widget for current and archived pages. Assets resolve from this script. */
(() => {
    'use strict';
    if (!(document.currentScript instanceof HTMLScriptElement)) return;
    const base = new URL('.', document.currentScript.src);
    const core = /** @type {typeof import('./gacha-core.js')} */ (window['GachaCore']);
    const key = `sleeper:gacha:v1:${base.pathname}`;
    const machineArt = `<svg class="gacha-machine" viewBox="0 0 160 205" aria-hidden="true">
        <ellipse cx="80" cy="195" rx="59" ry="7" fill="#1c1a17" opacity=".12"/>
        <path d="M57 15h46l7 12H50z" fill="#b3261e" stroke="#1c1a17" stroke-width="3"/>
        <path d="M31 73c0-30 17-48 49-48s49 18 49 48v39H31z" fill="#fff9ec" stroke="#1c1a17" stroke-width="3"/>
        <g class="gacha-balls" stroke="#1c1a17" stroke-width="2">
            <g transform="translate(47 90) rotate(-25)"><circle r="14" fill="#b3261e"/><path d="M-14 0a14 14 0 0 0 28 0z" fill="#f4eddc"/></g>
            <g transform="translate(77 92) rotate(20)"><circle r="14" fill="#d5ae54"/><path d="M-14 0a14 14 0 0 0 28 0z" fill="#f4eddc"/></g>
            <g transform="translate(108 91) rotate(-40)"><circle r="14" fill="#6b7869"/><path d="M-14 0a14 14 0 0 0 28 0z" fill="#f4eddc"/></g>
            <g transform="translate(61 64) rotate(40)"><circle r="14" fill="#6b7869"/><path d="M-14 0a14 14 0 0 0 28 0z" fill="#f4eddc"/></g>
            <g transform="translate(94 62) rotate(-20)"><circle r="14" fill="#b3261e"/><path d="M-14 0a14 14 0 0 0 28 0z" fill="#f4eddc"/></g>
        </g>
        <path d="M41 62q0-18 17-25" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/>
        <path d="M29 109h102l8 75H21z" fill="#b3261e" stroke="#1c1a17" stroke-width="3"/>
        <rect x="27" y="181" width="106" height="12" rx="3" fill="#1c1a17"/>
        <circle cx="80" cy="137" r="21" fill="#f4eddc" stroke="#1c1a17" stroke-width="3"/>
        <g class="gacha-crank"><rect x="61" y="132" width="38" height="10" rx="5" fill="#1c1a17"/><circle cx="80" cy="137" r="5" fill="#d5ae54"/></g>
        <path d="M63 180v-12a17 13 0 0 1 34 0v12z" fill="#1c1a17"/>
        <g class="gacha-capsule" transform="translate(80 170)" stroke="#1c1a17" stroke-width="2"><circle r="11" fill="#d5ae54"/><path d="M-11 0a11 11 0 0 0 22 0z" fill="#f4eddc"/></g>
    </svg>`;
    const launcher = document.createElement('button');
    launcher.className = 'gacha-launcher';
    launcher.type = 'button';
    launcher.setAttribute('aria-haspopup', 'dialog');
    launcher.setAttribute('aria-controls', 'gacha-dialog');
    launcher.innerHTML = `${machineArt}<span>Daily draw<small class="gacha-badge">3 a day</small></span>`;
    const panel = document.createElement('dialog');
    panel.id = 'gacha-dialog';
    panel.className = 'gacha-panel';
    panel.setAttribute('aria-labelledby', 'gacha-title');
    panel.innerHTML = `<header class="gacha-heading"><div><p class="gacha-eyebrow">The daily lucky dip</p><h2 id="gacha-title">Draft capsules</h2></div><button class="gacha-close" type="button" aria-label="Close draft capsules" autofocus>×</button></header>
        <div class="gacha-stage">${machineArt}<div><p class="gacha-tagline">A little luck.<br>A familiar face.</p><p class="gacha-pool">Current-season draft picks.<br>Three chances, every day.</p></div></div>
        <p class="gacha-allowance"></p><p class="gacha-reset"></p>
        <button class="gacha-draw" type="button" disabled>Loading players…</button>
        <p class="gacha-message" role="status" aria-live="polite"></p>
        <div class="gacha-result" hidden></div>
        <section class="gacha-history"><h3>Your draw history <span class="gacha-history-count"></span></h3><p class="gacha-empty">Your first capsule is waiting.</p><ol class="gacha-history-list" aria-label="Saved player draws"></ol><button class="gacha-more" type="button" hidden>Show earlier draws</button></section>
        <p class="gacha-footnote">Just for fun. Saved in this browser, across days and seasons.</p>`;
    document.body.append(launcher, panel);
    const find = selector => panel.querySelector(selector);
    const drawButton = find('.gacha-draw');
    const message = find('.gacha-message');
    const result = find('.gacha-result');
    let machine;
    let pool = [];
    let season;
    let busy = false;
    let loading = false;
    let storageFailed = false;
    let historyLimit = 30;
    let renderedHistory = '';
    let resetAt = 0;
    try {
        machine = core.createMachine({ storage: window.localStorage, key });
    } catch (_) {
        storageFailed = true;
    }
    function portrait(player) {
        const frame = document.createElement('span');
        frame.className = 'gacha-portrait';
        const fallback = document.createElement('span');
        fallback.textContent = player.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('');
        fallback.setAttribute('aria-hidden', 'true');
        const img = document.createElement('img');
        img.alt = player.name;
        img.loading = 'lazy';
        img.src = `https://sleepercdn.com/content/nfl/players/${encodeURIComponent(player.id)}.jpg`;
        img.addEventListener('error', () => img.remove(), { once: true });
        frame.append(fallback, img);
        return frame;
    }
    function playerDetails(entry, history) {
        const card = document.createElement(history ? 'li' : 'div');
        card.className = 'gacha-player';
        const copy = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = entry.player.name;
        const detail = document.createElement('p');
        detail.textContent = [entry.player.position, entry.player.team, `${entry.season} draft`].filter(Boolean).join(' · ');
        copy.append(name, detail);
        if (history) {
            const time = document.createElement('time');
            time.dateTime = entry.at;
            time.textContent = new Date(entry.at).toLocaleString('en-CA', {
                timeZone: 'America/Toronto', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
            }) + ' ET';
            copy.append(time);
        }
        card.append(portrait(entry.player), copy);
        return card;
    }
    function refresh() {
        try {
            if (!machine) throw new Error('Storage unavailable');
            const state = machine.status();
            resetAt = state.resetAt;
            launcher.querySelector('.gacha-badge').textContent = `${state.remaining} left today`;
            find('.gacha-allowance').textContent = `${state.remaining} of 3 draws left today`;
            const fingerprint = JSON.stringify([state.history, historyLimit]);
            if (fingerprint !== renderedHistory) {
                find('.gacha-history-list').replaceChildren(...state.history.slice(-historyLimit).reverse().map(entry => playerDetails(entry, true)));
                find('.gacha-history-count').textContent = `(${state.history.length})`;
                find('.gacha-empty').hidden = state.history.length > 0;
                find('.gacha-more').hidden = state.history.length <= historyLimit;
                renderedHistory = fingerprint;
            }
            drawButton.disabled = busy || loading || storageFailed || !navigator.locks || !pool.length || !state.remaining;
            drawButton.textContent = busy ? 'Opening your capsule…' : loading ? 'Loading players…'
                : !state.remaining ? 'Come back tomorrow' : !pool.length ? 'Players unavailable' : 'Turn the handle ↻';
        } catch (_) {
            storageFailed = true;
            drawButton.disabled = true;
        }
        if (storageFailed) {
            message.textContent = 'Draws are unavailable because your history could not be saved or read. Allow browser storage, then reopen the page.';
            launcher.querySelector('.gacha-badge').textContent = 'Unavailable';
        } else if (!navigator.locks) {
            message.textContent = 'Drawing needs a current browser and a secure (HTTPS) connection to keep your daily allowance safe.';
        }
        updateCountdown();
    }
    function updateCountdown() {
        if (!resetAt) return;
        const seconds = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor(seconds % 3600 / 60);
        find('.gacha-reset').textContent = `Resets in ${hours}h ${minutes}m ${String(seconds % 60).padStart(2, '0')}s · midnight Toronto`;
    }
    async function fetchJSON(path) {
        const response = await fetch(new URL(path, base));
        if (!response.ok) throw new Error('Could not load the draft');
        return response.json();
    }
    async function loadPool() {
        if (loading || pool.length) return;
        loading = true;
        refresh();
        try {
            const web = await fetchJSON('web_interface_data.json');
            const info = web.league_info;
            pool = core.draftPool(await fetchJSON(`league_${encodeURIComponent(info.league_id)}_draft_picks.json`));
            season = info.season;
            if (!pool.length) throw new Error('Empty draft');
            find('.gacha-pool').textContent = `${pool.length} players · ${season} draft. Equal odds. No repeats today.`;
            message.textContent = '';
        } catch (_) {
            message.textContent = 'The draft is unavailable. Close and reopen to retry. No draw was used.';
        } finally {
            loading = false;
            refresh();
        }
    }
    launcher.addEventListener('click', () => {
        panel.showModal();
        refresh();
        loadPool();
    });
    find('.gacha-close').addEventListener('click', () => panel.close());
    panel.addEventListener('click', event => { if (event.target === panel) {
        const rect = panel.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) panel.close();
    } });
    panel.addEventListener('close', () => launcher.focus());
    find('.gacha-more').addEventListener('click', () => { historyLimit += 30; refresh(); });
    drawButton.addEventListener('click', async () => {
        if (busy || drawButton.disabled) return;
        busy = true;
        result.hidden = true;
        message.textContent = '';
        refresh();
        try {
            const entry = await navigator.locks.request(key, () => machine.draw(pool, season));
            panel.classList.add('gacha-spinning');
            await new Promise(resolve => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1800));
            result.replaceChildren(playerDetails(entry, false));
            result.hidden = false;
            message.textContent = `You drew ${entry.player.name}! Saved to your history.`;
            if (panel.open) result.scrollIntoView({ block: 'nearest' });
        } catch (error) {
            message.textContent = error.name === 'QuotaExceededError' || error.name === 'SecurityError'
                ? 'Could not save your draw. No draw was used. Allow browser storage and try again.'
                : error.message;
        } finally {
            busy = false;
            panel.classList.remove('gacha-spinning');
            refresh();
        }
    });
    window.addEventListener('storage', event => { if (event.key === key || event.key === null) refresh(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    setInterval(() => {
        if (resetAt && Date.now() >= resetAt) refresh();
        else if (panel.open) updateCountdown();
    }, 1000);
    refresh();
})();
