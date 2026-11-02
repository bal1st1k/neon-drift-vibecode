/*! NEON DRIFT | Made by bal1st1k */
/* NEON DRIFT — earned cases, card inventory and atomic crafting. */
(function (root) {
  'use strict';
  const catalog = root.NDCards || (typeof require === 'function' ? require('./tuning-cards.js') : null);
  const shop = root.NDShop || (typeof require === 'function' ? require('./shop.js') : null);
  const draw = random => {
    const value = Number(random());
    return Number.isFinite(value) ? Math.max(0, Math.min(1 - Number.EPSILON, value)) : 0;
  };
  const rarityOrder = ['blue', 'yellow', 'red'];
  const inventory = save => save.inventory;
  const fail = message => ({ ok: false, message });
  const quantity = (save, id) => Math.max(0, Math.floor(Number(inventory(save).cards[id]) || 0));
  function add(save, card, amount = 1) {
    inventory(save).cards[card.id] = quantity(save, card.id) + amount;
  }
  function chooseCard(rarity, random) {
    const pool = catalog.cards.filter(card => card.rarity === rarity);
    return pool[Math.floor(draw(random) * pool.length)];
  }
  function rollCard(random = Math.random) {
    const chance = draw(random);
    return chooseCard(chance < .88 ? 'blue' : chance < .99 ? 'yellow' : 'red', random);
  }
  function awardCase(save) {
    inventory(save).cases.street = Math.min(99999, inventory(save).cases.street + 1);
    save.career.totalCases = (save.career.totalCases || 0) + 1;
    return { ok: true, count: inventory(save).cases.street };
  }
  function finishSpecial(save,caseId,rewards,cards){
    inventory(save).cases[caseId]--;save.career.openedCases=(save.career.openedCases||0)+1;
    const targets=shop.specialCases[caseId].carIds||[shop.specialCases[caseId].carId];
    const reset=rewards.some(reward=>reward.guaranteed||targets.includes(reward.carId)&&(reward.type==='car'||reward.duplicate));
    save.pity||={};save.pity[caseId]=reset?0:shop.getPity(save,caseId).count+1;
    save.lastReward={caseId,...rewards[rewards.length-1],timestamp:Date.now()};
    return {ok:true,caseId,rewards,cards,count:rewards.length,...(rewards.length===1?{reward:rewards[0]}:{}),remaining:inventory(save).cases[caseId],pity:shop.getPity(save,caseId)};
  }
  function guaranteedReward(save,random,caseId){
    const offer=shop.specialCases[caseId],banner=draw(random)<.5,pool=banner?(offer.carIds||[offer.carId]):shop.pityCars;
    const carId=pool[Math.floor(draw(random)*pool.length)],cards=[];
    let reward;
    if(save.owned.includes(carId)){const card=chooseCard('red',random);add(save,card);cards.push(card);reward={type:'card',cardId:card.id,carId,duplicate:true};}
    else {save.owned.push(carId);reward={type:'car',carId};}
    return finishSpecial(save,caseId,[{...reward,guaranteed:true,pityOutcome:banner?'banner':'toyota'}],cards);
  }
  function openSpecialCase(save, random, caseId) {
    const offer=shop.specialCases[caseId];
    if (!(inventory(save).cases[caseId] > 0)) return fail('Кейсов '+offer.label+' пока нет. Они продаются в магазине.');
    if(shop.getPity(save,caseId).remaining===1)return guaranteedReward(save,random,caseId);
    if (offer.carIds) {
      const count=1+Math.floor(draw(random)*(offer.maxRewards||3)), rewards=[], cards=[];
      const cardEnd=offer.blueChance+(offer.yellowChance||0),carStart=1-(offer.carChance||.015),carStep=(1-carStart)/offer.carIds.length;
      for(let i=0;i<count;i++) {
        const chance=draw(random); let reward;
        if(chance<cardEnd) { const card=chooseCard(chance<offer.blueChance?'blue':'yellow',random); add(save,card); cards.push(card); reward={type:'card',cardId:card.id}; }
        else if(chance<carStart) { const amount=500+Math.floor(draw(random)*16)*100; save.credits=Math.min(1e9,save.credits+amount); reward={type:'currency',amount}; }
        else { const carId=offer.carIds[Math.min(offer.carIds.length-1,Math.floor((chance-carStart)/carStep))];
          if(save.owned.includes(carId)) { const card=chooseCard('red',random); add(save,card); cards.push(card); reward={type:'card',cardId:card.id,duplicate:true,carId}; }
          else { save.owned.push(carId); reward={type:'car',carId}; }
        }
        rewards.push(reward);
      }
      return finishSpecial(save,caseId,rewards,cards);
    }
    const chance = draw(random);
    let reward, card = null;
    if (chance < offer.blueChance) {
      card = chooseCard('blue', random);
      reward = { type: 'card', cardId: card.id };
    } else if (chance < (offer.blueChance*100+offer.currencyChance*100)/100) reward = { type: 'currency', amount: 500 + Math.floor(draw(random) * 16) * 100 };
    else {
      const duplicate = save.owned.includes(offer.carId);
      if (duplicate) {
        card = chooseCard('red', random);
        reward = { type: 'card', cardId: card.id, duplicate: true, carId: offer.carId };
      } else reward = { type: 'car', carId: offer.carId, duplicate: false, amount: 0 };
    }
    if (card) add(save, card);
    if (reward.type === 'car' && !reward.duplicate) save.owned.push(reward.carId);
    if (reward.amount) save.credits = Math.min(1e9, save.credits + reward.amount);
    return finishSpecial(save,caseId,[reward],card?[card]:[]);
  }
  function openCase(save, random = Math.random, caseId = 'street') {
    if (Object.hasOwn(shop.specialCases,caseId)) return openSpecialCase(save, random,caseId);
    if (caseId !== 'street') return fail('Такого кейса нет в инвентаре.');
    if (!(inventory(save).cases.street > 0)) return fail('Кейсов пока нет. Получи один за финиш или купи в магазине.');
    const count = 1 + Math.floor(draw(random) * 3);
    const cards = Array.from({length: count}, () => rollCard(random));
    if (cards.some(card => !card)) return fail('Каталог карточек ещё загружается.');
    const card = cards[0];
    inventory(save).cases.street--;
    for (const item of cards) add(save, item);
    save.career.openedCases = (save.career.openedCases || 0) + 1;
    save.lastDrop = { cardId: card.id, cardIds: cards.map(item => item.id), timestamp: Date.now() };
    return { ok: true, caseId: 'street', card, cards, count, remaining: inventory(save).cases.street };
  }
  function openCases(save, random = Math.random, caseId = 'street', count = 10) {
    if(count!==10)return fail('За один раз можно открыть 10 кейсов.');
    if(caseId!=='street'&&!Object.hasOwn(shop.specialCases,caseId))return fail('Такого кейса нет в инвентаре.');
    if(!(inventory(save).cases[caseId]>=count))return fail('Для открытия десяти нужно 10 кейсов этого типа.');
    // Commit once after every roll succeeds. Guarantees still advance case by case.
    const staged=JSON.parse(JSON.stringify(save)),rewards=[],cards=[],caseRewards=[];
    for(let i=0;i<count;i++){
      const result=openCase(staged,random,caseId);if(!result.ok)return result;
      const contents=result.rewards||result.cards;
      caseRewards.push(contents.slice());rewards.push(...contents);cards.push(...result.cards);
    }
    Object.assign(save,staged);
    return {ok:true,caseId,rewards,cards,caseRewards,count:rewards.length,openedCases:count,remaining:inventory(save).cases[caseId]};
  }
  function equipCard(save, carId, cardId) {
    const card = catalog.getCard(cardId);
    if (!save.owned.includes(carId)) return fail('Сначала выбери машину из своего гаража.');
    if (catalog.computeBuild(carId).car.tuningLocked) return fail('Эта версия сохраняет фиксированную сборку. Тюнинг отключён.');
    if (!card || quantity(save, cardId) < 1) return fail('Этой карточки нет в инвентаре.');
    const equipped = save.equippedCards[carId], levels = catalog.getLevels(save.upgrades[carId], equipped);
    if (levels[card.slotId] >= card.level) return fail('Эта деталь уже такого же или более высокого уровня.');
    const previous = catalog.getCard(equipped[card.slotId]);
    inventory(save).cards[card.id]--;
    if (previous) add(save, previous);
    equipped[card.slotId] = card.id;
    return { ok: true, card, returned: previous || null };
  }
  function unequipCard(save, carId, slotId) {
    if (!save.owned.includes(carId)) return fail('Этой машины нет в гараже.');
    const card = catalog.getCard(save.equippedCards[carId]?.[slotId]);
    if (!card) return fail('В этом слоте нет установленной карточки.');
    delete save.equippedCards[carId][slotId];
    add(save, card);
    return { ok: true, card };
  }
  function countRarity(save, rarity) {
    return catalog.cards.filter(card => card.rarity === rarity).reduce((sum, card) => sum + quantity(save, card.id), 0);
  }
  function craftCards(save, rarity, random = Math.random) {
    const index = rarityOrder.indexOf(rarity);
    if (index < 0 || index > 1) return fail('Красные карточки — максимальная редкость.');
    if (countRarity(save, rarity) < 10) return fail('Для крафта нужно 10 свободных карточек этой редкости.');
    const output = [chooseCard(rarityOrder[index + 1], random), chooseCard(rarityOrder[index + 1], random)];
    if (output.some(card => !card)) return fail('Каталог карточек ещё загружается.');
    let needed = 10;
    for (const card of catalog.cards.filter(item => item.rarity === rarity).sort((a,b) => a.id.localeCompare(b.id))) {
      const used = Math.min(needed, quantity(save, card.id));
      inventory(save).cards[card.id] = quantity(save, card.id) - used;
      needed -= used;
      if (!needed) break;
    }
    for (const card of output) add(save, card);
    save.career.craftedCards = (save.career.craftedCards || 0) + 2;
    return { ok: true, cards: output, consumed: 10, rarity: rarityOrder[index + 1] };
  }
  const api = { rollCard, awardCase, openCase, openCases, equipCard, unequipCard, countRarity, craftCards, quantity };
  root.NDLoot = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
