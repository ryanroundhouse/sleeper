const test = require('node:test');
const assert = require('node:assert/strict');
const live = require('../sleeper-live.js');

test('computePointsFor sums starter points per roster across weeks', () => {
    const weeks = [
        { week: 1, matchups: [{ roster_id: 1, total_points: 100.5 }, { roster_id: 2, total_points: 80 }] },
        { week: 2, matchups: [{ roster_id: 1, total_points: 50.25 }, { roster_id: 2, total_points: 0 }] },
    ];
    assert.deepEqual(live.computePointsFor(weeks), { 1: 150.75, 2: 80 });
});

test('computePointsFor rounds away floating point noise', () => {
    const weeks = [
        { week: 1, matchups: [{ roster_id: 1, total_points: 0.1 }] },
        { week: 2, matchups: [{ roster_id: 1, total_points: 0.2 }] },
    ];
    assert.equal(live.computePointsFor(weeks)[1], 0.3);
});

test('adaptive interval: fast while changing, slow after two unchanged polls, fast again on change', () => {
    const p = live.createBackoff({ fast: 60, slow: 300 });
    assert.equal(p.next(true), 60);
    assert.equal(p.next(false), 60);   // one quiet poll is not enough
    assert.equal(p.next(false), 300);  // two quiet polls in a row
    assert.equal(p.next(false), 300);
    assert.equal(p.next(true), 60);    // scores moved again
});

test('formatWeb mirrors the Python snapshot shape', () => {
    const league = { name: 'L', season: '2026', status: 'in_season', total_rosters: 2 };
    const users = [
        { user_id: 'u1', display_name: 'Ryan', metadata: { team_name: 'Team R' } },
        { user_id: 'u2', display_name: 'Sam', metadata: {} },
    ];
    const rosters = [
        { roster_id: 1, owner_id: 'u1', players: ['1'] },
        { roster_id: 2, owner_id: 'u2', players: ['2'] },
    ];
    const matchupsByWeek = {
        1: [
            { roster_id: 1, matchup_id: 1, starters: ['1'], starters_points: [20], players_points: { '1': 20 } },
            { roster_id: 2, matchup_id: 1, starters: ['2'], starters_points: [7.5], players_points: { '2': 7.5 } },
        ],
        2: null,
    };
    const players = { '1': { name: 'Josh Allen', position: 'QB', team: 'BUF' } };
    const web = live.formatWeb({ league, users, rosters, matchupsByWeek, currentWeek: 2, leagueId: 'abc', players });

    assert.deepEqual(web.teams, {
        1: { display_name: 'Ryan', team_name: 'Team R' },
        2: { display_name: 'Sam', team_name: 'Sam' },
    });
    assert.equal(web.weeks.length, 1);               // null weeks are skipped
    assert.equal(web.weeks[0].matchups[1].total_points, 7.5);
    assert.equal(web.weeks[0].matchups[0].team_name, 'Team R');
    assert.deepEqual(web.league_info, {
        name: 'L', league_id: 'abc', season: '2026', status: 'in_season', current_week: 2, total_rosters: 2,
    });
    assert.equal(web.players['1'].name, 'Josh Allen');
});

test('unknownPlayerIds lists ids in rosters or matchups that the subset lacks', () => {
    const web = {
        weeks: [{ week: 1, matchups: [{ roster_id: 1, starters: ['1', '3'], players_points: { '1': 1, '3': 2 } }] }],
        players: { '1': {} },
    };
    const rosters = [{ roster_id: 1, players: ['1', '4', '0'] }]; // "0" = empty slot
    assert.deepEqual([...live.unknownPlayerIds(web, rosters)].sort(), ['3', '4']);
});

test('hasScoresChanged compares week totals only', () => {
    const a = { weeks: [{ week: 1, matchups: [{ roster_id: 1, total_points: 10 }] }] };
    const same = { weeks: [{ week: 1, matchups: [{ roster_id: 1, total_points: 10 }] }] };
    const diff = { weeks: [{ week: 1, matchups: [{ roster_id: 1, total_points: 11 }] }] };
    assert.equal(live.hasScoresChanged(a, same), false);
    assert.equal(live.hasScoresChanged(a, diff), true);
    assert.equal(live.hasScoresChanged(null, same), true);
});
