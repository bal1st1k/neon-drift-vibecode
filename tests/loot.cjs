/* Pure inventory/build checks. Run: node tests/loot.cjs. No browser or network. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../catalog.js');
const cards = require('../tuning-cards.js');
const core = require('../engine.js');
const progress = require('../progress.js');
const loot = require('../loot.js');
let passed = 0;
const check = (name, work) => { work(); passed++; console.log(`PASS ${name}`); };
const snapshot = value => JSON.stringify(value);
const clone = value => JSON.parse(JSON.stringify(value));
const fresh = () => progress.defaults();
const random = seed => {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
};
const fixedRoll = (chance, withinPool = 0) => {
  let calls = 0;
  return () => calls++ === 0 ? chance : withinPool;
};
const totalCards = save => Object.values(save.inventory.cards).reduce((sum, value) => sum + value, 0) +
  Object.values(save.equippedCards).reduce((sum, equipped) => sum + Object.keys(equipped).length, 0);

function healthy(save) {
  assert.ok(Number.isInteger(save.inventory.cases.street) && save.inventory.cases.street >= 0 && save.inventory.cases.street <= 99999);
  for (const [id, value] of Object.entries(save.inventory.cards)) {
    assert.ok(cards.getCard(id), `Unknown inventory card ${id}`);
    assert.ok(Number.isInteger(value) && Number.isFinite(value) && value >= 0, `Invalid quantity ${id}=${value}`);
  }
  for (const equipped of Object.values(save.equippedCards)) for (const [slot, id] of Object.entries(equipped)) {
    assert.equal(cards.getCard(id)?.slotId, slot);
  }
}

function rejectedWithoutChanges(save, operation) {
  const before = snapshot(save);
  const result = operation();
  assert.equal(result.ok, false);
  assert.equal(typeof result.message, 'string');
  assert.equal(snapshot(save), before, 'Rejected inventory actions must be atomic');
}

check('all thirty-three cards reference real images and eleven correct slots', () => {
  assert.equal(cards.cards.length, 33);
  assert.equal(cards.slots.length, 11);
  assert.equal(new Set(cards.cards.map(card => card.image)).size, 33);
  for (const rarity of ['blue', 'yellow', 'red']) {
    assert.equal(cards.cards.filter(card => card.rarity === rarity).length, 11);
    for (const slot of cards.slots) {
      const card = cards.getCardForSlot(slot.id, rarity);
      assert.ok(card);
      assert.equal(card.level, cards.rarities[rarity].level);
      assert.ok(fs.existsSync(path.resolve(__dirname, '..', card.image)), card.image);
      assert.equal(card.sourceStatsPresent, false);
    }
  }
  assert.equal(cards.cards.filter(card => card.sourceLabelMismatch).length, 2);
});

check('rarity thresholds are exactly 88%, 11% and 1%, including boundary values', () => {
  assert.equal(cards.rarities.blue.chance, .88);
  assert.equal(cards.rarities.yellow.chance, .11);
  assert.equal(cards.rarities.red.chance, .01);
  for (const [value, rarity] of [[0, 'blue'], [.88 - Number.EPSILON, 'blue'], [.88, 'yellow'],
    [.99 - Number.EPSILON, 'yellow'], [.99, 'red'], [1, 'red']]) {
    assert.equal(loot.rollCard(fixedRoll(value)).rarity, rarity, `Boundary ${value}`);
  }
  const histogram = { blue: 0, yellow: 0, red: 0 };
  for (let index = 0; index < 10000; index++) histogram[loot.rollCard(fixedRoll((index + .5) / 10000)).rarity]++;
  assert.deepEqual(histogram, { blue: 8800, yellow: 1100, red: 100 });
  for (const value of [NaN, Infinity, -Infinity, -100, 100]) assert.ok(cards.getCard(loot.rollCard(() => value).id));
});

check('seeded draws approach the configured frequencies and can select all thirty-three cards', () => {
  const rng = random(6767), counts = { blue: 0, yellow: 0, red: 0 }, seen = new Set();
  const samples = 100000;
  for (let index = 0; index < samples; index++) {
    const card = loot.rollCard(rng);
    counts[card.rarity]++; seen.add(card.id);
  }
  assert.ok(Math.abs(counts.blue / samples - .88) < .004);
  assert.ok(Math.abs(counts.yellow / samples - .11) < .004);
  assert.ok(Math.abs(counts.red / samples - .01) < .0015);
  assert.equal(seen.size, 33);
  const a = random(17), b = random(17);
  for (let index = 0; index < 50; index++) assert.equal(loot.rollCard(a).id, loot.rollCard(b).id);
});

check('earning and opening one case grants one card without charging credits', () => {
  const save = fresh(), startingCredits = save.credits;
  assert.equal(save.version, 3);
  assert.equal(loot.awardCase(save).ok, true);
  assert.equal(save.inventory.cases.street, 1);
  assert.equal(save.career.totalCases, 1);
  const countBefore = totalCards(save), started = Date.now();
  const rolls = [0, .99, 0];
  const result = loot.openCase(save, () => rolls.shift() ?? 0);
  assert.equal(result.ok, true);
  assert.equal(result.card.rarity, 'red');
  assert.equal(save.inventory.cases.street, 0);
  assert.equal(totalCards(save), countBefore + 1);
  assert.equal(save.inventory.cards[result.card.id], 1);
  assert.equal(save.career.openedCases, 1);
  assert.equal(save.credits, startingCredits);
  assert.equal(save.lastDrop.cardId, result.card.id);
  assert.ok(save.lastDrop.timestamp >= started && save.lastDrop.timestamp <= Date.now());
  healthy(save);
});

check('opening an empty case inventory changes nothing and does not roll randomness', () => {
  const save = fresh();
  rejectedWithoutChanges(save, () => loot.openCase(save, () => { throw new Error('Empty cases must not roll'); }));
  save.inventory.cases.street = 99998;
  loot.awardCase(save); loot.awardCase(save);
  assert.equal(save.inventory.cases.street, 99999);
  healthy(save);
});

check('equipping consumes one card and upgrading returns the previous card', () => {
  const save = fresh();
  save.inventory.cards = { 'turbo-blue': 2, 'turbo-yellow': 1, 'turbo-red': 1 };
  const count = totalCards(save);
  assert.equal(loot.equipCard(save, 'ae85', 'turbo-blue').ok, true);
  assert.equal(save.inventory.cards['turbo-blue'], 1);
  assert.equal(save.equippedCards.ae85.turbo, 'turbo-blue');
  assert.equal(totalCards(save), count);
  const upgrade = loot.equipCard(save, 'ae85', 'turbo-yellow');
  assert.equal(upgrade.ok, true);
  assert.equal(upgrade.returned.id, 'turbo-blue');
  assert.equal(save.inventory.cards['turbo-blue'], 2);
  assert.equal(save.inventory.cards['turbo-yellow'], 0);
  assert.equal(save.equippedCards.ae85.turbo, 'turbo-yellow');
  assert.equal(totalCards(save), count);
  healthy(save);
});

check('same, lower, missing, invalid and unowned-car equip attempts change nothing', () => {
  const save = fresh();
  save.inventory.cards = { 'turbo-blue': 2, 'turbo-yellow': 2, 'turbo-red': 1 };
  assert.equal(loot.equipCard(save, 'ae85', 'turbo-yellow').ok, true);
  rejectedWithoutChanges(save, () => loot.equipCard(save, 'ae85', 'turbo-yellow'));
  rejectedWithoutChanges(save, () => loot.equipCard(save, 'ae85', 'turbo-blue'));
  rejectedWithoutChanges(save, () => loot.equipCard(save, 'ae85', 'intake-red'));
  rejectedWithoutChanges(save, () => loot.equipCard(save, 'ae85', 'missing'));
  rejectedWithoutChanges(save, () => loot.equipCard(save, 'ae85', '__proto__'));
  rejectedWithoutChanges(save, () => loot.equipCard(save, 'ae86', 'turbo-red'));
  save.upgrades.ae85.turbo = 3;
  rejectedWithoutChanges(save, () => loot.equipCard(save, 'ae85', 'turbo-red'));
  healthy(save);
});

check('unequipping restores exactly one card and cannot duplicate it', () => {
  const save = fresh();
  save.inventory.cards = { 'nitro-red': 1 };
  loot.equipCard(save, 'ae85', 'nitro-red');
  const count = totalCards(save);
  const result = loot.unequipCard(save, 'ae85', 'nitro');
  assert.equal(result.ok, true);
  assert.equal(result.card.id, 'nitro-red');
  assert.equal(save.inventory.cards['nitro-red'], 1);
  assert.equal(save.equippedCards.ae85.nitro, undefined);
  assert.equal(totalCards(save), count);
  rejectedWithoutChanges(save, () => loot.unequipCard(save, 'ae85', 'nitro'));
  rejectedWithoutChanges(save, () => loot.unequipCard(save, 'ae85', 'missing'));
  rejectedWithoutChanges(save, () => loot.unequipCard(save, 'ae86', 'nitro'));
});

check('ten blue cards of mixed families craft into exactly two yellow cards', () => {
  const save = fresh();
  const blue = cards.cards.filter(card => card.rarity === 'blue');
  for (const card of blue.slice(0, 10)) save.inventory.cards[card.id] = 1;
  save.inventory.cards['nitro-red'] = 3;
  const before = totalCards(save), redBefore = loot.countRarity(save, 'red');
  const result = loot.craftCards(save, 'blue', () => 0);
  assert.equal(result.ok, true);
  assert.equal(result.consumed, 10);
  assert.equal(result.rarity, 'yellow');
  assert.equal(result.cards.length, 2);
  assert.ok(result.cards.every(card => card.rarity === 'yellow'));
  assert.equal(result.cards[0].id, result.cards[1].id);
  assert.equal(save.inventory.cards[result.cards[0].id], 2, 'Duplicate results must grant both copies');
  assert.equal(loot.countRarity(save, 'blue'), 0);
  assert.equal(loot.countRarity(save, 'yellow'), 2);
  assert.equal(loot.countRarity(save, 'red'), redBefore);
  assert.equal(totalCards(save), before - 8);
  assert.equal(save.career.craftedCards, 2);
  healthy(save);
});

check('ten yellow cards craft into two red cards and preserve installed equipment', () => {
  const save = fresh();
  save.inventory.cards = { 'turbo-blue': 1, 'tires-yellow': 6, 'brakes-yellow': 4 };
  loot.equipCard(save, 'ae85', 'turbo-blue');
  const equipment = snapshot(save.equippedCards), before = totalCards(save);
  const result = loot.craftCards(save, 'yellow', random(8));
  assert.equal(result.ok, true);
  assert.ok(result.cards.every(card => card.rarity === 'red'));
  assert.equal(loot.countRarity(save, 'yellow'), 0);
  assert.equal(loot.countRarity(save, 'red'), 2);
  assert.equal(snapshot(save.equippedCards), equipment);
  assert.equal(totalCards(save), before - 8);
  healthy(save);
});

check('insufficient, installed-only and invalid crafting attempts are atomic', () => {
  const save = fresh();
  save.inventory.cards = { 'turbo-blue': 10 };
  loot.equipCard(save, 'ae85', 'turbo-blue');
  assert.equal(loot.countRarity(save, 'blue'), 9);
  assert.equal(totalCards(save), 10);
  rejectedWithoutChanges(save, () => loot.craftCards(save, 'blue', () => { throw new Error('Insufficient craft must not roll'); }));
  rejectedWithoutChanges(save, () => loot.craftCards(save, 'yellow'));
  rejectedWithoutChanges(save, () => loot.craftCards(save, 'red'));
  rejectedWithoutChanges(save, () => loot.craftCards(save, 'unknown'));
  healthy(save);
});

check('schema three round trips cases, free cards, equipped cards, motors and cash', () => {
  const save = fresh();
  save.owned.push('ae86'); save.selectedCar = 'ae86'; save.credits = 43210;
  save.inventory.cases.street = 17;
  save.inventory.cards = { 'turbo-red': 2, 'tires-yellow': 5, 'brakes-blue': 4 };
  save.equippedCards.ae85 = { intake: 'intake-yellow', weight: 'weight-red' };
  save.equippedCards.ae86 = { turbo: 'turbo-red' };
  save.ownedEngines.ae86.push('rb26dett'); save.selectedEngines.ae86 = 'rb26dett';
  save.upgrades.ae85.brakes = 3;
  save.lastDrop = { cardId: 'turbo-red', cardIds: ['turbo-red'], timestamp: 123456789 };
  const clean = progress.sanitize(clone(save));
  assert.equal(clean.version, 3);
  assert.deepEqual(clean, save);
  assert.deepEqual(progress.sanitize(clone(clean)), clean);
  healthy(clean);
});

check('save validation rejects malformed quantities and mismatched slots without NaNs', () => {
  const raw = fresh();
  raw.inventory = { cases: { street: Infinity }, cards: {
    'turbo-blue': -4, 'intake-red': NaN, 'tires-yellow': 4.9,
    'brakes-red': Infinity, 'weight-blue': '5', missing: 100
  } };
  raw.equippedCards.ae85 = { turbo: 'nitro-red', tires: 'tires-yellow', missing: 'turbo-blue' };
  const clean = progress.sanitize(raw);
  assert.equal(clean.inventory.cases.street, 0);
  assert.deepEqual(clean.inventory.cards, { 'tires-yellow': 4 });
  assert.deepEqual(clean.equippedCards.ae85, { tires: 'tires-yellow' });
  healthy(clean);
});

check('v2 migration preserves credits, purchased cars, tuning and motor inventory', () => {
  const old = fresh(); old.version = 2; old.credits = 76543;
  old.owned.push('s15'); old.selectedCar = 's15'; old.upgrades.s15.turbo = 3; old.upgrades.s15.tires = 2;
  old.ownedEngines.s15.push('13b-rew'); old.selectedEngines.s15 = '13b-rew';
  old.career.totalCredits = 54321;
  delete old.inventory; delete old.equippedCards; delete old.lastDrop;
  const clean = progress.sanitize(old);
  assert.equal(clean.version, 3);
  assert.equal(clean.credits, 76543);
  assert.equal(clean.selectedCar, 's15');
  assert.equal(clean.upgrades.s15.turbo, 3);
  assert.equal(clean.upgrades.s15.tires, 2);
  assert.equal(clean.selectedEngines.s15, '13b-rew');
  assert.deepEqual(clean.ownedEngines.s15, old.ownedEngines.s15);
  assert.equal(clean.career.totalCredits, 54321);
  assert.deepEqual(clean.inventory, fresh().inventory);
  assert.deepEqual(clean.equippedCards.s15, {});
  assert.deepEqual(progress.sanitize(clone(clean)), clean, 'Reloading must not multiply currency');
});

check('v1 migration applies its existing currency scale once and keeps purchased levels', () => {
  const old = { schema: 'neon-drift', version: 1, credits: 1200,
    owned: ['vector', 'specter', 'comet'], selectedCar: 'specter', selectedTrack: 'harbor',
    upgrades: { vector: { engine: 2, grip: 1, nitro: 3 }, specter: { engine: 3, grip: 2, nitro: 1 } },
    career: { races: 7, wins: 3, totalCredits: 8400 }, settings: { sound: false } };
  const clean = progress.sanitize(old);
  assert.equal(clean.version, 3);
  assert.equal(clean.credits, 12000);
  assert.equal(clean.selectedCar, 's15');
  assert.ok(['ae85', 'ae86', 's15', 'fd3s'].every(id => clean.owned.includes(id)));
  assert.equal(clean.upgrades.ae86.turbo, 2);
  assert.equal(clean.upgrades.ae86.tires, 1);
  assert.equal(clean.upgrades.ae86.nitro, 3);
  assert.equal(clean.upgrades.s15.turbo, 3);
  assert.equal(clean.career.totalCredits, 84000);
  assert.equal(clean.settings.sound, false);
  assert.deepEqual(progress.sanitize(clone(clean)), clean);
});

check('all card effects use the maximum slot level and leave catalog formulas untouched', () => {
  const catalogueBefore = snapshot(catalog.upgrades);
  for (const card of cards.cards) {
    const equipped = { [card.slotId]: card.id };
    const expected = catalog.computeBuild('ae85', { [card.slotId]: card.level });
    const actual = cards.computeBuild('ae85', {}, undefined, equipped);
    assert.deepEqual(actual, expected, card.id);
  }
  assert.equal(cards.getLevels({ turbo: 2 }, { turbo: 'turbo-blue' }).turbo, 2);
  assert.equal(cards.getLevels({ turbo: 1 }, { turbo: 'turbo-red' }).turbo, 3);
  assert.equal(cards.getLevels({ turbo: 1 }, { turbo: 'nitro-red' }).turbo, 1);
  const tune = { turbo: 2, weight: 1 }, equipment = { turbo: 'turbo-red', weight: 'weight-yellow' };
  assert.deepEqual(cards.computeBuild('ae85', tune, 'rb26dett', equipment), catalog.computeBuild('ae85', { turbo: 3, weight: 2 }, 'rb26dett'));
  assert.equal(snapshot(catalog.upgrades), catalogueBefore);
});

check('equipped cards reach the real Engine build and survive reset without stacking', () => {
  const stock = new core.Engine({ carId: 'ae85', trackId: 'harbor' });
  const tuned = new core.Engine({ carId: 'ae85', trackId: 'harbor', upgrades: { turbo: 2 },
    cards: { turbo: 'turbo-red', weight: 'weight-yellow' } });
  assert.ok(tuned.build.powerHp > stock.build.powerHp);
  assert.ok(tuned.build.weightKg < stock.build.weightKg);
  assert.equal(tuned.effectiveUpgrades.turbo, 3);
  assert.equal(tuned.effectiveUpgrades.weight, 2);
  assert.deepEqual(tuned.build, catalog.computeBuild('ae85', { turbo: 3, weight: 2 }));
  tuned.reset();
  assert.equal(tuned.effectiveUpgrades.turbo, 3);
  assert.ok(Math.abs(tuned.build.powerHp - 80 * 1.36) < 1e-9);
});

check('one thousand mixed inventory actions conserve cards or the exact crafting exchange', () => {
  const save = fresh(), rng = random(42);
  save.inventory.cases.street = 100;
  for (const card of cards.cards) save.inventory.cards[card.id] = card.rarity === 'blue' ? 5 : card.rarity === 'yellow' ? 2 : 1;
  const paidLevels = snapshot(save.upgrades);
  for (let step = 0; step < 1000; step++) {
    const action = Math.floor(rng() * 6), before = snapshot(save), oldCards = totalCards(save);
    let result, expectedChange = 0;
    if (action === 0) result = loot.awardCase(save);
    else if (action === 1) { result = loot.openCase(save, rng); expectedChange = result.cards?.length || 0; }
    else if (action === 2) result = loot.equipCard(save, 'ae85', cards.cards[Math.floor(rng() * cards.cards.length)].id);
    else if (action === 3) result = loot.unequipCard(save, 'ae85', cards.slots[Math.floor(rng() * cards.slots.length)].id);
    else { result = loot.craftCards(save, action === 4 ? 'blue' : 'yellow', rng); expectedChange = -8; }
    if (!result.ok) assert.equal(snapshot(save), before, `Failed action ${action} at step ${step} mutated state`);
    assert.equal(totalCards(save), oldCards + (result.ok ? expectedChange : 0));
    assert.equal(snapshot(save.upgrades), paidLevels, 'Inventory operations must not rewrite paid tuning');
    healthy(save);
  }
});

console.log(`\n${passed} loot checks passed.`);
