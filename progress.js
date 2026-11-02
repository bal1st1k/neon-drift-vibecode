/*! NEON DRIFT | Made by bal1st1k */
/* NEON DRIFT — versioned garage data and lossless v1 migration. */
(function (root) {
  'use strict';
  const core = root.NDCore || (typeof require === 'function' ? require('./engine.js') : null);
  const { cars, tracks, upgrades } = core;
  const catalog = root.NDCatalog || (typeof require === 'function' ? require('./catalog.js') : null);
  const engines = catalog.engines;
  const cardCatalog = root.NDCards || (typeof require === 'function' ? require('./tuning-cards.js') : null);
  const shop = root.NDShop || (typeof require === 'function' ? require('./shop.js') : null);
  const radio = root.NDRadio || (typeof require === 'function' ? require('./radio.js') : null);
  const obj = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const bounded = (value, fallback = 0, max = 1e9) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : fallback;
  const legacyCars = { vector: 'ae86', specter: 's15', comet: 'fd3s' };
  const carExists = id => cars.some(car => car.id === id);
  const engineExists = id => engines.some(engine => engine.id === id);
  const stock = id => cars.find(car => car.id === id)?.stockEngineId || cars[0].stockEngineId;
  const baseId = cars.some(car => car.id === 'ae85') ? 'ae85' : cars[0].id;
  const defaultTrack = tracks.some(track => track.id === 'akina') ? 'akina' : tracks[0].id;
  function defaults() {
    return {
      schema: 'neon-drift', version: 3, credits: 1200, owned: [baseId], selectedCar: baseId, selectedTrack: defaultTrack,
      upgrades: Object.fromEntries(cars.map(car => [car.id, Object.fromEntries(upgrades.map(upgrade => [upgrade.id, 0]))])),
      selectedEngines: Object.fromEntries(cars.map(car => [car.id, car.stockEngineId])),
      ownedEngines: Object.fromEntries(cars.map(car => [car.id, [car.stockEngineId]])),
      equippedCards: Object.fromEntries(cars.map(car => [car.id, {}])),
      inventory: { cases: Object.fromEntries(['street',...Object.keys(shop.specialCases)].map(id=>[id,0])), cards: {} }, lastDrop: null, lastReward: null,
      shop: { cycle: 0, purchased: [] }, pity: Object.fromEntries(Object.keys(shop.specialCases).map(id=>[id,0])),
      records: {}, career: { races: 0, wins: 0, totalDrift: 0, totalCredits: 0, totalCases: 0, openedCases: 0, craftedCards: 0 },
      settings: { sound: true, music: false, radio:false, radioStation:'eurobeat', radioVolume:.65, volume: .42, quality: 'high', reducedMotion: typeof root.matchMedia === 'function' ? root.matchMedia('(prefers-reduced-motion: reduce)').matches : false }
    };
  }
  function migrateV1(raw) {
    const migrated = { ...raw, version: 2 };
    const rename = id => legacyCars[id] || id;
    migrated.credits = bounded(raw.credits, 1200) * 10;
    migrated.owned = (Array.isArray(raw.owned) ? raw.owned : ['vector']).map(rename);
    migrated.selectedCar = rename(raw.selectedCar || 'vector');
    migrated.upgrades = {};
    for (const [id, levels] of Object.entries(obj(raw.upgrades))) {
      const item = obj(levels);
      migrated.upgrades[rename(id)] = { turbo: item.engine, tires: item.grip, nitro: item.nitro };
    }
    migrated.records = Object.fromEntries(Object.entries(obj(raw.records)).map(([id, record]) => [id, { ...obj(record), carId: rename(obj(record).carId) }]));
    migrated.career = { ...obj(raw.career), totalCredits: bounded(obj(raw.career).totalCredits) * 10 };
    return migrated;
  }
  function sanitize(input) {
    let raw = obj(input);
    const clean = defaults();
    if (raw.schema !== 'neon-drift' || ![1, 2, 3].includes(raw.version)) return clean;
    if (raw.version === 1) raw = migrateV1(raw);
    clean.credits = Math.floor(bounded(raw.credits, 1200));
    clean.owned = [...new Set([baseId, ...(Array.isArray(raw.owned) ? raw.owned.filter(carExists) : [])])];
    if (clean.owned.includes(raw.selectedCar)) clean.selectedCar = raw.selectedCar;
    if (tracks.some(track => track.id === raw.selectedTrack)) clean.selectedTrack = raw.selectedTrack;
    const rawUpgrades = obj(raw.upgrades), rawOwnedEngines = obj(raw.ownedEngines), rawSelectedEngines = obj(raw.selectedEngines);
    for (const car of cars) {
      for (const upgrade of upgrades) clean.upgrades[car.id][upgrade.id] = Math.floor(bounded(obj(rawUpgrades[car.id])[upgrade.id], 0, upgrade.maxLevel));
      const inventory = Array.isArray(rawOwnedEngines[car.id]) ? rawOwnedEngines[car.id].filter(id=>engineExists(id)&&(id===car.stockEngineId||engines.find(engine=>engine.id===id).swapAllowed!==false)) : [];
      clean.ownedEngines[car.id] = [...new Set([stock(car.id), ...inventory])];
      if (clean.ownedEngines[car.id].includes(rawSelectedEngines[car.id])) clean.selectedEngines[car.id] = rawSelectedEngines[car.id];
      if (car.swapLocked) { clean.ownedEngines[car.id] = [car.stockEngineId]; clean.selectedEngines[car.id] = car.stockEngineId; }
      for (const [slotId, cardId] of Object.entries(obj(obj(raw.equippedCards)[car.id]))) {
        const card = cardCatalog.getCard(cardId);
        if (card?.slotId === slotId) clean.equippedCards[car.id][slotId] = card.id;
      }
      if (car.tuningLocked) {
        clean.upgrades[car.id] = Object.fromEntries(upgrades.map(upgrade => [upgrade.id, 0]));
        clean.selectedEngines[car.id] = car.stockEngineId;
        clean.ownedEngines[car.id] = [car.stockEngineId];
        clean.equippedCards[car.id] = {};
      }
    }
    clean.inventory.cases.street = Math.floor(bounded(obj(obj(raw.inventory).cases).street, 0, 99999));
    for(const id of Object.keys(shop.specialCases))clean.inventory.cases[id] = Math.floor(bounded(obj(obj(raw.inventory).cases)[id], 0, 99999));
    for(const id of Object.keys(shop.specialCases))clean.pity[id]=shop.getPity(raw,id).count;
    for (const card of cardCatalog.cards) {
      const count = Math.floor(bounded(obj(obj(raw.inventory).cards)[card.id], 0, 99999));
      if (count > 0) clean.inventory.cards[card.id] = count;
    }
    const drop = obj(raw.lastDrop);
    if (cardCatalog.getCard(drop.cardId)) clean.lastDrop = {
      cardId: drop.cardId,
      cardIds: (Array.isArray(drop.cardIds) ? drop.cardIds : [drop.cardId]).filter(id => cardCatalog.getCard(id)).slice(0,3),
      timestamp: Math.floor(bounded(drop.timestamp, 0, 1e14))
    };
    const reward = obj(raw.lastReward);
    if (Object.hasOwn(shop.specialCases,reward.caseId)) {
      const timestamp = Math.floor(bounded(reward.timestamp, 0, 1e14));
      const caseId=reward.caseId,offer=shop.specialCases[caseId],carId=offer.carIds?.includes(reward.carId) ? reward.carId : offer.carId;
      const pityPool=reward.pityOutcome==='banner'?(offer.carIds||[offer.carId]):reward.pityOutcome==='toyota'?shop.pityCars:[];
      if(reward.guaranteed===true){
        if(pityPool.includes(reward.carId)){
          const meta={caseId,carId:reward.carId,guaranteed:true,pityOutcome:reward.pityOutcome,timestamp};
          if(reward.type==='car')clean.lastReward={...meta,type:'car'};
          else if(reward.type==='card'&&reward.duplicate===true&&cardCatalog.getCard(reward.cardId)?.rarity==='red')clean.lastReward={...meta,type:'card',cardId:reward.cardId,duplicate:true};
        }
      }
      else if (reward.type === 'card' && (cardCatalog.getCard(reward.cardId)?.rarity === 'blue'||offer.yellowChance>0&&cardCatalog.getCard(reward.cardId)?.rarity==='yellow')) clean.lastReward = { caseId, type:'card', cardId:reward.cardId, timestamp };
      else if (reward.type === 'card' && cardCatalog.getCard(reward.cardId)?.rarity === 'red' && reward.duplicate === true && reward.carId === carId) clean.lastReward = { caseId, type:'card', cardId:reward.cardId, duplicate:true, carId, timestamp };
      else if (reward.type === 'currency' && Number.isInteger(reward.amount) && reward.amount >= 500 && reward.amount <= 2000 && reward.amount % 100 === 0) clean.lastReward = { caseId, type:'currency', amount:reward.amount, timestamp };
      else if (reward.type === 'car' && reward.carId === carId) clean.lastReward = { caseId, type:'car', carId, duplicate:reward.duplicate === true, amount:reward.duplicate === true && caseId==='s2000' ? 43000 : 0, timestamp };
    }
    for (const track of tracks) {
      const record = obj(obj(raw.records)[track.id]);
      if (typeof record.bestTime !== 'number' || !Number.isFinite(record.bestTime) || record.bestTime <= 5 || record.bestTime >= 86400) continue;
      const lap = bounded(record.bestLap, record.bestTime, record.bestTime);
      clean.records[track.id] = {
        bestTime: record.bestTime, bestLap: lap > 0 ? lap : record.bestTime,
        bestPosition: Math.max(1, Math.floor(bounded(record.bestPosition, 4, 4))), bestDrift: Math.floor(bounded(record.bestDrift)),
        carId: carExists(record.carId) ? record.carId : baseId, races: Math.max(1, Math.floor(bounded(record.races, 1)))
      };
    }
    for (const key of Object.keys(clean.career)) clean.career[key] = Math.floor(bounded(obj(raw.career)[key]));
    clean.career.wins = Math.min(clean.career.wins, clean.career.races);
    clean.shop = { cycle: Math.floor(bounded(obj(raw.shop).cycle)), purchased: obj(raw.shop).purchased };
    shop.ensureStock(clean);
    const settings = obj(raw.settings);
    for (const key of ['sound', 'music', 'radio', 'reducedMotion']) if (typeof settings[key] === 'boolean') clean.settings[key] = settings[key];
    clean.settings.radioStation=radio.stationById(settings.radioStation).id;
    clean.settings.radioVolume=bounded(settings.radioVolume,.65,1);
    if(clean.settings.radio)clean.settings.music=false;
    clean.settings.volume = bounded(settings.volume, .42, 1);
    clean.settings.quality = settings.quality === 'low' ? 'low' : 'high';
    return clean;
  }
  root.NDProgress = { defaults, sanitize, migrateV1 };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.NDProgress;
})(globalThis);
