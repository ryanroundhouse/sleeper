/* Presentation only: league calculations and polling remain in the page viewers. */
window.Newsprint = {
    update({ web, updatedAt }) {
        const info = web.league_info;
        const header = document.querySelector('.header');
        let edition = header.querySelector('.edition-line');
        if (!edition) {
            edition = document.createElement('div');
            edition.className = 'edition-line';
            edition.innerHTML = '<span class="edition-number"></span><span class="edition-format"></span><span class="edition-updated"></span>';
            header.prepend(edition);
            const subtitle = document.createElement('p');
            subtitle.className = 'edition-subtitle';
            const caption = document.createElement('span');
            caption.className = 'edition-caption';
            subtitle.appendChild(caption);
            document.getElementById('league-name').after(subtitle);
        }
        const week = info.current_week || Math.max(0, ...web.weeks.map(w => w.week));
        edition.querySelector('.edition-number').textContent = `Vol. ${info.season} · No. ${week}`;
        const clubs = Number(info.total_rosters) === 14 ? 'Fourteen' : info.total_rosters;
        edition.querySelector('.edition-format').textContent = `Best Ball · ${clubs} Clubs`;
        const date = updatedAt ? new Date(updatedAt) : null;
        edition.querySelector('.edition-updated').textContent = date && !Number.isNaN(date.valueOf())
            ? `Updated ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Awaiting update';
        const page = location.pathname.split('/').pop();
        const captions = { 'weekly.html': 'Weekly results', 'stats.html': 'Team performance over time', 'hall-of-fame.html': 'Honours and dishonours' };
        const selectedWeek = document.getElementById('week-select')?.value || week;
        header.querySelector('.edition-caption').textContent = page === 'stats.html'
            ? `${captions[page]}.`
            : page === 'hall-of-fame.html' ? `${captions[page]}, season ${info.season}.`
            : `${captions[page] || 'Season standings'}, week ${selectedWeek}.`;
    }
};
document.addEventListener('DOMContentLoaded', () => {
    const shortLabels = { 'Season Results': 'Season', 'Weekly Results': 'Weekly', 'Hall of Fame': 'HOF', '2025 Season': '2025', '⬅ Current Season': 'Current' };
    document.querySelectorAll('.nav-button').forEach(button => {
        const label = button.textContent.trim();
        if (!shortLabels[label]) return;
        button.textContent = '';
        button.setAttribute('aria-label', label);
        const full = document.createElement('span');
        full.className = 'nav-long';
        full.textContent = label;
        const short = document.createElement('span');
        short.className = 'nav-short';
        short.textContent = shortLabels[label];
        button.append(full, short);
    });
    if (window.Chart) {
        Chart.defaults.font.family = "'IBM Plex Mono', monospace";
        Chart.defaults.color = '#6b645a';
        Chart.defaults.plugins.tooltip.titleColor = '#f4eddc';
        Chart.defaults.plugins.tooltip.bodyColor = '#f4eddc';
        Chart.defaults.plugins.tooltip.cornerRadius = 0;
    }
});
