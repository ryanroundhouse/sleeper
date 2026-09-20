const test = require('node:test');
const assert = require('node:assert/strict');
const { createMachine, draftPool, nextReset } = require('../gacha-core.js');

function fixture() {
    const values = new Map();
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    let now = new Date('2026-09-19T16:00:00Z');
    const options = { storage, key: 'draws', clock: () => now, random: () => 0 };
    const pool = ['A', 'B', 'C', 'D'].map(id => ({ id, name: `Player ${id}`, position: 'QB', team: 'BUF' }));
    return { machine: createMachine(options), pool, storage, options, setTime: value => { now = new Date(value); } };
}

test('three unique draws persist across reloads and pages; fourth draw is refused', () => {
    const f = fixture();
    assert.equal(f.machine.status().remaining, 3);
    assert.equal(f.machine.draw(f.pool, '2026').player.id, 'A');
    const anotherPage = createMachine(f.options);
    assert.equal(anotherPage.draw(f.pool, '2026').player.id, 'B');
    assert.equal(f.machine.draw(f.pool, '2026').player.id, 'C');
    assert.throws(() => anotherPage.draw(f.pool, '2026'), /Come back tomorrow/);
    assert.equal(anotherPage.status().remaining, 0);
    assert.deepEqual(anotherPage.status().history.map(e => e.player.id), ['A', 'B', 'C']);
});

test('Toronto midnight restores allowance and eligibility while retaining all history', () => {
    const f = fixture();
    f.setTime('2026-09-20T03:59:59Z');
    for (let i = 0; i < 3; i++) f.machine.draw(f.pool, '2026');
    assert.equal(f.machine.status().remaining, 0);
    f.setTime('2026-09-20T04:00:00Z');
    assert.equal(f.machine.status().remaining, 3);
    assert.equal(f.machine.draw(f.pool, '2027').player.id, 'A');
    assert.deepEqual(f.machine.status().history.map(e => e.season), ['2026', '2026', '2026', '2027']);
    assert.equal(f.machine.status().remaining, 2);
});

test('reset boundary handles both daylight saving transitions and winter offset', () => {
    assert.equal(new Date(nextReset(new Date('2026-03-08T05:00:00Z'))).toISOString(), '2026-03-09T04:00:00.000Z');
    assert.equal(new Date(nextReset(new Date('2026-11-01T04:00:00Z'))).toISOString(), '2026-11-02T05:00:00.000Z');
    assert.equal(new Date(nextReset(new Date('2026-01-01T04:59:59Z'))).toISOString(), '2026-01-01T05:00:00.000Z');
});

test('each equal-sized random interval selects a different eligible player', () => {
    for (const [random, expected] of [[0, 'A'], [0.25, 'B'], [0.5, 'C'], [0.99999, 'D']]) {
        const f = fixture();
        const machine = createMachine({ ...f.options, random: () => random });
        assert.equal(machine.draw(f.pool, '2026').player.id, expected);
    }
});

test('empty or exhausted draft pools do not spend an allowance', () => {
    const f = fixture();
    assert.throws(() => f.machine.draw([], '2026'), /No drafted players/);
    assert.equal(f.machine.status().remaining, 3);
    f.machine.draw(f.pool.slice(0, 1), '2026');
    assert.throws(() => f.machine.draw(f.pool.slice(0, 1), '2026'), /No drafted players/);
    assert.equal(f.machine.status().remaining, 2);
});

test('failed save never returns a player or consumes an allowance', () => {
    const f = fixture();
    const broken = createMachine({ ...f.options, storage: {
        getItem: f.storage.getItem,
        setItem() { throw new DOMException('Storage full', 'QuotaExceededError'); },
    } });
    assert.throws(() => broken.draw(f.pool, '2026'), { name: 'QuotaExceededError' });
    assert.equal(f.machine.status().remaining, 3);
    assert.equal(f.machine.status().history.length, 0);
});

test('invalid saved history fails closed instead of resetting the allowance', () => {
    for (const raw of ['{oops', '{}', '{"version":1,"history":[null]}', '{"version":2,"history":[]}']) {
        const f = fixture();
        f.storage.setItem('draws', raw);
        assert.throws(() => f.machine.status());
        assert.throws(() => f.machine.draw(f.pool, '2026'));
        assert.equal(f.storage.getItem('draws'), raw);
    }
});

test('draft pool uses draft selections, deduplicates IDs, and carries reveal metadata', () => {
    const pick = { player_id: '9221', metadata: { first_name: 'Jahmyr', last_name: 'Gibbs', position: 'RB', team: 'DET' } };
    assert.deepEqual(draftPool([pick, pick, {}]), [{ id: '9221', name: 'Jahmyr Gibbs', position: 'RB', team: 'DET' }]);
    assert.throws(() => draftPool({}), /Draft data/);
});
