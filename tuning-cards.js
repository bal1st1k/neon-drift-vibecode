/*! NEON DRIFT | Made by bal1st1k */
/* NEON DRIFT — all 33 supplied tuning cards, transcribed and mapped by family.
 * The artwork prints part names and TIER 1/2/3, but NO performance percentages.
 * modifiers below are GAME BALANCE from the unchanged catalog.js formulas.
 * A higher tier replaces the slot effect; it never stacks with lower cards.
 * Paid legacy tuning remains intact through max(legacy level, equipped tier).
 */
(function (root) {
  'use strict';

  const rarities = {
    blue: { id: 'blue', level: 1, name: 'Обычная', label: 'Синяя', chance: 0.88, color: '#6aa7f5' },
    yellow: { id: 'yellow', level: 2, name: 'Редкая', label: 'Жёлтая', chance: 0.11, color: '#ffd438' },
    red: { id: 'red', level: 3, name: 'Легендарная', label: 'Красная', chance: 0.01, color: '#ff4769' }
  };
  const slots = [
    { id: 'turbo', name: 'Наддув', legacyUpgradeId: 'turbo' },
    { id: 'intake', name: 'Впуск', legacyUpgradeId: 'intake' },
    { id: 'exhaust', name: 'Выпуск', legacyUpgradeId: 'exhaust' },
    { id: 'ecu', name: 'Электроника ECU', legacyUpgradeId: 'ecu' },
    { id: 'tires', name: 'Шины и диски', legacyUpgradeId: 'tires' },
    { id: 'suspension', name: 'Подвеска', legacyUpgradeId: 'suspension' },
    { id: 'brakes', name: 'Тормоза', legacyUpgradeId: 'brakes' },
    { id: 'weight', name: 'Кузов и шасси', legacyUpgradeId: 'weight' },
    { id: 'gearbox', name: 'Коробка передач', legacyUpgradeId: 'gearbox' },
    { id: 'differential', name: 'Дифференциал', legacyUpgradeId: 'differential' },
    { id: 'nitro', name: 'Система нитро', legacyUpgradeId: 'nitro' }
  ];
  const modifierLabels = {
    powerPct: 'Мощность', weightPct: 'Масса', gripPct: 'Сцепление',
    handlingPct: 'Управляемость', brakingPct: 'Тормозное усилие',
    nitroPowerPct: 'Сила нитро', nitroDurationPct: 'Длительность нитро',
    accelerationPct: 'Отклик разгона', transmissionPct: 'Эффективность КПП',
    differentialPct: 'Эффективность дифференциала'
  };
  // These per-tier increments exactly mirror the old catalog's tuning math.
  const gameIncrements = {
    turbo: { powerPct: 12 }, intake: { powerPct: 3 }, exhaust: { powerPct: 4 }, ecu: { powerPct: 5 },
    tires: { gripPct: 11, handlingPct: 4.5 }, suspension: { handlingPct: 6, gripPct: 3.5 },
    brakes: { brakingPct: 12 }, weight: { weightPct: -4 },
    gearbox: { transmissionPct: 7, accelerationPct: 3.5 }, differential: { differentialPct: 6 },
    nitro: { nitroPowerPct: 10, nitroDurationPct: 12 }
  };
  // Rows: slotId, filename, exact printed source name, Russian display name.
  const artwork = {
    blue: [
      ['turbo', 'turbo-blue.jpg', 'TURBOCHARGER', 'Турбокомпрессор'],
      ['intake', 'intake-blue.jpg', 'AIR INTAKE FILTER', 'Воздушный фильтр'],
      ['exhaust', 'exhaust-blue.jpg', 'EXHAUST PIPE', 'Выхлопная труба'],
      ['ecu', 'ecu-blue.jpg', 'MICROCHIP CIRCUIT', 'Микросхема управления'],
      ['tires', 'tires-blue.jpg', 'RACING TIRE WHEEL', 'Спортивное колесо'],
      ['suspension', 'suspension-blue.jpg', 'COILOVER SUSPENSION', 'Койловерная подвеска'],
      ['brakes', 'brakes-blue.jpg', 'BRAKE DISC & CALIPER', 'Тормозной диск и суппорт'],
      ['weight', 'weight-blue.jpg', 'LIGHTWEIGHT CAR CHASSIS', 'Облегчённое шасси'],
      ['gearbox', 'gearbox-blue.jpg', 'TRANSMISSION GEARBOX', 'Коробка передач'],
      ['differential', 'differential-blue.jpg', 'DIFFERENTIAL GEARS', 'Шестерни дифференциала'],
      ['nitro', 'nitro-blue.jpg', 'NITROUS OXIDE TANK', 'Баллон закиси азота']
    ],
    yellow: [
      ['turbo', 'turbo-yellow.jpg', 'TWIN-TURBO SETUP', 'Комплект Twin-Turbo'],
      ['intake', 'intake-yellow.jpg', 'DUAL COLD AIR INTAKE SYSTEM', 'Двойной холодный впуск'],
      ['exhaust', 'exhaust-yellow.jpg', 'DUAL SPORT EXHAUST PIPES', 'Двойной спортивный выпуск'],
      ['ecu', 'ecu-yellow.jpg', 'ADVANCED ECU MODULE', 'Продвинутый модуль ECU'],
      ['tires', 'tires-yellow.jpg', 'WIDE SEMI-SLICK TIRE', 'Широкие полуслики'],
      ['suspension', 'suspension-yellow.jpg', 'ADJUSTABLE DUAL-SPRING COILOVER', 'Регулируемый двухпружинный койловер'],
      ['brakes', 'brakes-yellow.jpg', 'CROSS-DRILLED BRAKE DISC & LARGE CALIPER', 'Перфорированный диск и большой суппорт'],
      ['weight', 'weight-yellow.jpg', 'CARBON FIBER CAR BODY PARTS', 'Карбоновые кузовные панели'],
      ['gearbox', 'gearbox-yellow.jpg', 'SEQUENTIAL RACING GEARBOX', 'Секвентальная гоночная КПП'],
      ['differential', 'differential-yellow.jpg', '2-WAY LSD DIFFERENTIAL MECHANISM', 'Дифференциал 2-Way LSD'],
      ['nitro', 'nitro-yellow.jpg', 'DUAL NITROUS OXIDE TANKS GAUGE ICON', 'Двойные баллоны нитро с манометром']
    ],
    red: [
      ['turbo', 'turbo-red.jpg', 'DUAL LARGE TURBOS & INTRICATE PIPING', 'Крупные турбины с пайпингом'],
      ['intake', 'intake-red.jpg', 'DUAL LARGE TURBOS & INTRICATE PIPING', 'Индивидуальные дроссели ITB'],
      ['exhaust', 'exhaust-red.jpg', 'DUAL LARGE TURBOS & INTRICATE PIPING', 'Гоночный выпуск с четырьмя трубами'],
      ['ecu', 'ecu-red.jpg', 'ADVANCED PROCESSOR & CIRCUIT BOARD', 'Гоночный процессор и плата ECU'],
      ['tires', 'tires-red.jpg', 'ULTRA-WIDE RACING SLICK TIRES & FORGED RIMS', 'Сверхширокие слики и кованые диски'],
      ['suspension', 'suspension-red.jpg', 'HEAVY-DUTY RACING COILOVER STRUTS', 'Усиленные гоночные койловеры'],
      ['brakes', 'brakes-red.jpg', 'CERAMIC BRAKE ROTOR & CALIPERS', 'Керамический ротор и суппорты'],
      ['weight', 'weight-red.jpg', 'TUBULAR ROLL CAGE & SPACE-FRAME CHASSIS', 'Трубчатый каркас и пространственное шасси'],
      ['gearbox', 'gearbox-red.jpg', 'SEQUENTIAL RACING GEARBOX', 'Гоночная секвентальная трансмиссия'],
      ['differential', 'differential-red.jpg', 'HEAVY-DUTY DIFFERENTIAL', 'Усиленный дифференциал'],
      ['nitro', 'nitro-red.jpg', 'NITROUS OXIDE SYSTEM', 'Гоночная система закиси азота']
    ]
  };
  const sourceNotes = {
    'intake-red': 'В исходнике повторён заголовок про турбины, но изображены впускные раструбы и дроссельный узел. Семейство определено по рисунку; исходный заголовок сохранён в sourceName.',
    'exhaust-red': 'В исходнике повторён заголовок про турбины, но изображена система выпуска с четырьмя трубами. Семейство определено по рисунку; исходный заголовок сохранён в sourceName.'
  };
  const format = value => Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
  const cards = Object.entries(artwork).flatMap(([rarity, rows]) => rows.map(([slotId, filename, sourceName, name]) => {
    const level = rarities[rarity].level;
    const modifiers = Object.fromEntries(Object.entries(gameIncrements[slotId]).map(([key, amount]) => [key, amount * level]));
    const id = `${slotId}-${rarity}`;
    const effectText = Object.entries(modifiers).map(([key, value]) => `${modifierLabels[key]} ${value > 0 ? '+' : ''}${format(value)}%`).join(' · ');
    return {
      id, slotId, upgradeId: slotId, legacyUpgradeId: slotId, rarity, level,
      name, sourceName, image: `for promt/tuning/${rarity}/${filename}`,
      description: `Игровой эффект: ${effectText}.`, effectText, modifiers,
      sourceStatsPresent: false, sourceStats: null, modifierBasis: 'catalog-balance',
      sourceTier: `TIER ${level}`, sourceLabelMismatch: !!sourceNotes[id],
      sourceNote: sourceNotes[id] || 'На исходной карточке указаны название и Tier; численные характеристики отсутствуют. Проценты заданы балансом игры.'
    };
  }));
  const byId = Object.fromEntries(cards.map(card => [card.id, card]));
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const cleanLevel = value => {
    const numeric = typeof value === 'number' || typeof value === 'string' ? Number(value) : 0;
    return Number.isFinite(numeric) ? Math.max(0, Math.min(3, Math.floor(numeric))) : 0;
  };
  function getCard(id) { return typeof id === 'string' && Object.hasOwn(byId, id) ? byId[id] : null; }
  function getCardForSlot(slotId, rarity) { return getCard(`${slotId}-${rarity}`); }
  function getLevels(legacyLevels = {}, equippedCards = {}) {
    const legacy = object(legacyLevels), equipped = object(equippedCards);
    return Object.fromEntries(slots.map(slot => {
      const card = getCard(equipped[slot.id]);
      const cardLevel = card && card.slotId === slot.id ? card.level : 0;
      return [slot.id, Math.max(cleanLevel(legacy[slot.id]), cardLevel)];
    }));
  }
  function computeBuild(carId, legacyLevels = {}, engineId, equippedCards = {}) {
    const catalog = root.NDCatalog || (typeof require === 'function' ? require('./catalog.js') : null);
    if (!catalog || typeof catalog.computeBuild !== 'function') throw new Error('NDCatalog must load before tuning cards are applied.');
    return catalog.computeBuild(carId, getLevels(legacyLevels, equippedCards), engineId);
  }

  const api = { cards, slots, rarities, modifierLabels, getCard, getCardForSlot, getLevels, computeBuild };
  root.NDCards = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
