/*! NEON DRIFT | Made by bal1st1k */
/* NEON DRIFT — a persistent five-race parts counter. */
(function (root) {
  'use strict';
  const cards = root.NDCards || (typeof require === 'function' ? require('./tuning-cards.js') : null);
  const prices = Object.freeze({ case: 500, card: 1000 });
  const assets = Object.freeze({
    closed: 'assets/cases/street-closed.png',
    open: 'assets/cases/street-open.png'
  });
  const s2000 = Object.freeze({
    caseId:'s2000', label:'PURPLE SHADOW', carId: 's2000', carPrice: 43000, casePrice: 1000, blueChance:.90, currencyChance:.08,
    assets: Object.freeze({
      hero: 'for promt/S2000/s2000-hero.jpg',
      purchase: 'for promt/S2000/s2000-purchase.jpg',
      closed: 'assets/cases/s2000-closed.png',
      open: 'assets/cases/s2000-open.png'
    })
  });
  const takumiRoot='for promt/призрак акины/';
  const takumi=Object.freeze([
    Object.freeze({caseId:'ae86-akina',label:'AKINA SPEC',carId:'ae86-akina',carPrice:23000,casePrice:1000,blueChance:.90,currencyChance:.08,
      assets:Object.freeze({hero:takumiRoot+'ae86-akina-hero.jpg',purchase:takumiRoot+'ae86-akina-purchase.jpg',closed:'assets/cases/akina-closed.png',open:'assets/cases/akina-open.png'})}),
    Object.freeze({caseId:'ae86-project-d',label:'PROJECT D SPEC',carId:'ae86-project-d',carPrice:54000,casePrice:2000,blueChance:.91,currencyChance:.08,
      assets:Object.freeze({hero:takumiRoot+'ae86-project-d-hero.jpg',purchase:takumiRoot+'ae86-project-d-purchase.jpg',card:takumiRoot+'ae86-project-d-card.jpg',closed:'assets/cases/project-d-closed.png',open:'assets/cases/project-d-open.png'})})
  ]);
  const legendRoot='for promt/легенды интернета/';
  const legends=Object.freeze({caseId:'legends',label:'ЛЕГЕНДЫ ИНТЕРНЕТА',carId:'fd2',carIds:['fd2','nb8c','s30','z33'],casePrice:2000,blueChance:.90,currencyChance:.085, assets:{closed:'assets/cases/legends-closed.png',open:'assets/cases/legends-open.png'}, photos:{fd2:[legendRoot+'honda civic (fd2)/fd2-photo-01.jpg',legendRoot+'honda civic (fd2)/fd2-photo-02.jpg'],nb8c:[legendRoot+'Mazda Roadster RS (NB8C)/nb8c-photo-01.jpg',legendRoot+'Mazda Roadster RS (NB8C)/nb8c-photo-02.jpg'],s30:[legendRoot+'Nissan Fairlady Z (S30)/s30-photo-01.jpg',legendRoot+'Nissan Fairlady Z (S30)/s30-photo-02.jpg'],z33:[legendRoot+'Nissan Fairlady Z Version S (Z33)/z33-photo-01.jpg',legendRoot+'Nissan Fairlady Z Version S (Z33)/z33-photo-02.jpg']}});
  const brothersRoot='for promt/«Заокеанские братья»/';
  const brothers=Object.freeze({caseId:'brothers',label:'ЗАОКЕАНСКИЕ БРАТЬЯ',carId:'is200',carIds:['is200','is300'],casePrice:1500,blueChance:.80,yellowChance:.10,currencyChance:.09,carChance:.01,maxRewards:3,assets:{hero:brothersRoot+'brothers-hero.jpg',closed:'assets/cases/brothers-closed.png',open:'assets/cases/brothers-open.png'},photos:{is200:[brothersRoot+'card.jpg',brothersRoot+'card.jpg'],is300:[brothersRoot+'is300-photo-02.webp',brothersRoot+'is300-photo-02.webp']}});
  const roadsterRoot='for promt/Всегда правильный ответ/';
  const roadster=Object.freeze({caseId:'roadster',label:'ВСЕГДА ПРАВИЛЬНЫЙ ОТВЕТ',carId:'na6ce',carIds:['na6ce'],casePrice:1500,blueChance:.80,yellowChance:.10,currencyChance:.09,carChance:.01,maxRewards:3,assets:{hero:roadsterRoot+'roadster-hero.jpg',purchase:roadsterRoot+'roadster-card.jpg',card:roadsterRoot+'roadster-card.jpg',closed:'assets/cases/roadster-closed.png',open:'assets/cases/roadster-open.png'}});
  const mercedesRoot='for promt/major update 4.0/Mercedes-Benz 190E 2.5-16 Evolution II (W201)/';
  const mercedes=Object.freeze({caseId:'mercedes',label:'HOMOLOGATION 502',carId:'w201-evo2',carIds:['w201-evo2'],casePrice:1500,blueChance:.80,yellowChance:.10,currencyChance:.09,carChance:.01,maxRewards:3,assets:{hero:mercedesRoot+'card.jpg',purchase:mercedesRoot+'w201-evo2-photo-02.jpg',card:mercedesRoot+'card.jpg',closed:'assets/cases/mercedes-closed.png',open:'assets/cases/mercedes-open.png'},photos:{'w201-evo2':[mercedesRoot+'card.jpg',mercedesRoot+'w201-evo2-photo-02.jpg',mercedesRoot+'w201-evo2-photo-03.jpg',mercedesRoot+'w201-evo2-photo-04.jpg',mercedesRoot+'w201-evo2-photo-05.jpg']}});
  const blackbird=Object.freeze({caseId:'blackbird',label:'BLACKBIRD',carId:'930-blackbird',carIds:['930-blackbird'],casePrice:1500,blueChance:.80,yellowChance:.10,currencyChance:.09,carChance:.01,maxRewards:3,assets:{hero:'for promt/blackbird/blackbird-hero.webp',card:'for promt/blackbird/blackbird-hero.webp',purchase:'for promt/blackbird/930-autobahn.jpg',profile:'for promt/blackbird/930-profile.jpg',closed:'assets/cases/blackbird-closed.png',open:'assets/cases/blackbird-open.png'}});
  const italy=Object.freeze({caseId:'italy',label:'И ВАМ ПРИВЕТ ИЗ ИТАЛИИ',carId:'fiat-coupe',carIds:['fiat-coupe','alfa-155','alfa-gtv','delta-evo2'],casePrice:1500,blueChance:.79,yellowChance:.10,currencyChance:.09,carChance:.02,maxRewards:3,assets:{closed:'assets/cases/italy-closed.png',open:'assets/cases/italy-open.png'},photos:Object.fromEntries(['fiat-coupe','alfa-155','alfa-gtv','delta-evo2'].map(id=>[id,['assets/italy/'+id+'-hero-hq.webp','assets/italy/'+id+'-photo-2.webp']]))});
  const mustang=Object.freeze({caseId:'mustang',label:'АМЕРИКАНСКАЯ ЛОШАДКА',carId:'mustang-gt',carIds:['mustang-gt'],casePrice:1500,blueChance:.80,yellowChance:.10,currencyChance:.09,carChance:.01,maxRewards:3,assets:{hero:'assets/mustang/gt-2005.webp',card:'assets/mustang/gt-2005.webp',closed:'assets/cases/mustang-closed-western.png',open:'assets/cases/mustang-open-western.png'}});
  const bmw=Object.freeze({caseId:'bmw',label:'BMW MOTORSPORT',carId:'m3-e30',carIds:['m3-e30','m3-e36','m3-e46'],casePrice:1500,blueChance:.795,yellowChance:.10,currencyChance:.09,carChance:.015,maxRewards:3,cardPhotos:Object.fromEntries(['m3-e30','m3-e36','m3-e46'].map(id=>[id,'assets/bmw/'+id+'-photo-1.webp'])),assets:{closed:'assets/cases/bmw-closed.png',open:'assets/cases/bmw-open.png'},photos:Object.fromEntries(['m3-e30','m3-e36','m3-e46'].map(id=>[id,[1,2,3,4,5,6].map(i=>'assets/bmw/'+id+'-photo-'+i+'.webp')]))});
  const specialCases=Object.freeze(Object.fromEntries([s2000,...takumi,legends,brothers,roadster,mercedes,blackbird,italy,mustang,bmw].map(item=>[item.caseId,item])));
  const pityLimit=30;
  const pityCars=Object.freeze(['jzz30','jzx90','jzx81']);
  const pityRoot='for promt/гарант/';
  const pityOffer=Object.freeze({label:'ГАРАНТ / TOYOTA',carIds:pityCars,assets:{},photos:{
    jzz30:[pityRoot+'Toyota Soarer 2.5 GT-T (JZZ30)/jzz30-card.jpg',pityRoot+'Toyota Soarer 2.5 GT-T (JZZ30)/jzz30-card.jpg'],
    jzx90:[pityRoot+'Toyota Mark II Tourer V (JZX90)/card.jpg',pityRoot+'Toyota Mark II Tourer V (JZX90)/card.jpg'],
    jzx81:[pityRoot+'Toyota Chaser GT Twin Turbo (JZX81)/card.jpg',pityRoot+'Toyota Chaser GT Twin Turbo (JZX81)/card.jpg']
  }});
  function getCarOffer(carId){return Object.values(specialCases).find(item=>item.carId===carId||item.carIds?.includes(carId))||(pityCars.includes(carId)?pityOffer:null);}
  function getPity(save,caseId){
    if(!Object.hasOwn(specialCases,caseId))return null;
    const raw=save.pity?.[caseId],count=typeof raw==='number'&&Number.isFinite(raw)?Math.max(0,Math.min(pityLimit-1,Math.floor(raw))):0;
    return {count,limit:pityLimit,remaining:pityLimit-count};
  }
  const cycleOf = save => Math.floor(Math.max(0, Number(save.career.races) || 0) / 5);
  function ensureStock(save) {
    const cycle = cycleOf(save);
    if (!save.shop || save.shop.cycle !== cycle) save.shop = { cycle, purchased: [] };
    save.shop.purchased = [...new Set((Array.isArray(save.shop.purchased) ? save.shop.purchased : []).filter(index => Number.isInteger(index) && index >= 0 && index < 5))];
    return save.shop;
  }
  function getStock(save) {
    const state = ensureStock(save);
    let seed = Math.imul(state.cycle + 1, 2654435761) >>> 0;
    const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
    const pool = cards.cards.slice(), stock = [];
    for (let index = 0; index < 5; index++) {
      const chance = random(), rarity = chance < .88 ? 'blue' : chance < .99 ? 'yellow' : 'red';
      const candidates = pool.filter(card => card.rarity === rarity);
      const card = candidates[Math.floor(random() * candidates.length)];
      pool.splice(pool.indexOf(card), 1);
      stock.push({ id: `${state.cycle}:${index}`, card, purchased: state.purchased.includes(index) });
    }
    return stock;
  }
  function remainingRaces(save) { return 5 - Math.max(0, Math.floor(Number(save.career.races) || 0)) % 5; }
  function purchaseCase(save, caseId = 'street') {
    if (caseId !== 'street' && !Object.hasOwn(specialCases,caseId)) return { ok: false, message: 'Такого кейса нет в магазине.' };
    const price = caseId === 'street' ? prices.case : specialCases[caseId].casePrice;
    if (save.credits < price) return { ok: false, message: `Не хватает монет: кейс стоит ₡ ${price.toLocaleString('ru-RU')}.` };
    if (save.inventory.cases[caseId] >= 99999) return { ok: false, message: 'Инвентарь кейсов заполнен.' };
    save.credits -= price; save.inventory.cases[caseId] = (save.inventory.cases[caseId] || 0) + 1;
    return { ok: true, caseId, price };
  }
  function purchaseExclusiveCar(save,carId) {
    const offer=Object.values(specialCases).find(item=>item.carId===carId || item.carIds?.includes(carId));
    if(!offer)return {ok:false,message:'Этой машины нет в магазине.'};
    const car=cards.computeBuild(carId).car;
    if (save.owned.includes(carId)) return { ok: false, message: car.name+' уже в твоём гараже.' };
    const price=offer.carIds ? car.price : offer.carPrice;
    if (save.credits < price) return { ok: false, message: 'Для покупки нужно ₡ '+price.toLocaleString('ru-RU')+'.' };
    save.credits -= price; save.owned.push(carId);
    return { ok: true, carId, price }; 
  }
  function purchaseS2000(save){return purchaseExclusiveCar(save,s2000.carId);}
  function purchaseCard(save, offerId) {
    const offer = getStock(save).find(item => item.id === offerId);
    if (!offer) return { ok: false, message: 'Ассортимент обновился. Выбери карточку заново.' };
    if (offer.purchased) return { ok: false, message: 'Эта карточка уже куплена.' };
    if (save.credits < prices.card) return { ok: false, message: 'Не хватает монет: карточка стоит ₡ 1 000.' };
    const quantity = Math.max(0, Math.floor(Number(save.inventory.cards[offer.card.id]) || 0));
    if (quantity >= 99999) return { ok: false, message: 'Инвентарь этой карточки заполнен.' };
    save.credits -= prices.card;
    save.inventory.cards[offer.card.id] = quantity + 1;
    save.shop.purchased.push(Number(offer.id.split(':')[1]));
    return { ok: true, card: offer.card, price: prices.card };
  }
  const api = { prices, assets, s2000, takumi, legends, brothers, roadster, mercedes, blackbird, italy, mustang, bmw, specialCases, pityLimit, pityCars, pityOffer, getCarOffer, getPity, ensureStock, getStock, remainingRaces, purchaseCase, purchaseCard, purchaseS2000, purchaseExclusiveCar };
  root.NDShop = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
