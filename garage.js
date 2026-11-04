/*! NEON DRIFT | Made by bal1st1k */
/* NEON DRIFT — route library, dealership and build workbench. */
(function (root) {
  'use strict';
  const { cars, tracks, upgrades, engines, computeBuild, getSwapPrice, getUpgradePrice } = root.NDCore;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const trackSearchAliases = {
    akagi:'акаги',akina:'акина', 'enna-skyline':'энна энна скайлайн',hakone:'хаконе',happogahara:'хаппогахара',irohazaka:'ирохазака ироха',
    'momiji-line':'момидзи момидзилайн',myogi:'мёги моги',nagao:'нагао',nanamagari:'нанамагари',sadamine:'садаминэ',tsubaki:'цубаки тсубаки',
    tsukuba:'цукуба',usui:'усуи усуй',yabitsu:'ябица',tsuchisaka:'тсучисака цутисака',harbor:'неоновый порт',ridge:'горный сигнал',downtown:'после полуночи',
    'wangan-east':'ванган восток ист', 'wangan-west':'ванган запад вест'
  };
  const normalizeTrackSearch = value => String(value ?? '').toLocaleLowerCase('ru-RU').replaceAll('ё','е');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const n = (value, digits = 0) => Number(value || 0).toLocaleString('ru-RU', { maximumFractionDigits: digits });
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const editionBadge = car => car.edition || car.team ? `<span class="edition-badge">[${esc(car.edition||car.team)}]</span>` : '';
  const carCardLink = car => car.shopExclusive ? `<button class="text-button custom-car-card-link" data-car-card="${car.id}">ПОСМОТРЕТЬ КАРТОЧКУ ${icon('arrow')}</button>` : '';
  const revButton = (engineId, build = false) => {
    const engine = engines.find(item => item.id === engineId);
    return `<button type="button" class="rev-button" data-rev-engine="${engineId}" ${build?'data-rev-build':''} aria-pressed="false" aria-label="Погазовать · ${esc(engine.name)} · удерживай"><span>${icon('volume')} Погазовать</span><small>Удерживай</small></button>`;
  };
  const carCardArt = (car,offer,paint) => car.paint && paint ? root.NDCatalog.vwPhoto(car.id,paint) : offer.cardPhotos?.[car.id] || offer.photos?.[car.id]?.[1] || offer.assets.card || offer.assets.hero;
  const timestamp = seconds => {
    const ms = Math.floor(seconds * 1000);
    return `${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;
  };
  const spec = (label, value, unit = '') => `<div><span>${label}</span><strong>${value}<small>${unit}</small></strong></div>`;
  const spriteNoseUp = new Set(['ae86','s30','mr2','nb8c','delta-evo2','fiat-coupe','fd2','bnr34','bnr32','bnr32-vspec','z33','evo7','evo4','evo5','ae86-project-d']);
  const spriteNoseDown = new Set(['eg6','nsx','gc8']);
  const spritePadded = new Set(['ae86-akina','fd3s','dc2','supra','s2000','evo6','evo3']);
  const carSpriteClass = car => {
    if (!car) return '';
    if (spriteNoseUp.has(car.id)) return ' sprite-nose-up';
    if (spriteNoseDown.has(car.id)) return ' sprite-nose-down';
    if (spritePadded.has(car.id)) return ' sprite-padded';
    return '';
  };
  const engineCategory = engine => {
    const text = `${engine.id} ${engine.name} ${engine.description}`.toLowerCase();
    if (/\bv8\b|modular-46|1uz-fe/.test(text)) return 'v8';
    if (/rotary|wankel|renesis|13b|20b/.test(text)) return 'rotary';
    if (/turbo/.test(text)||/(?:gte|det|dett)$/.test(engine.id.toLowerCase())) return 'turbo';
    return 'na';
  };
  class Interface {
    constructor({ getSave, trackCache, onReveal = () => {} }) {
      this.getSave = getSave; this.trackCache = trackCache;
      this.onReveal = onReveal; this.reveal = null; this.revealTimer = null;
      this.shopTab='cases';this.italyModel='fiat-coupe';this.bmwModel='m3-e30';this.vwModel=NDShop.vw.carId;this.vwView=0;this.vwPreviewPaint=null;
      this.tab = 'cars'; this.carPage = 0; this.query = ''; this.brand = 'all'; this.sort = 'ratio'; this.onlyOwned = false;
      this.engineCompatibility='compatible';this.engineType='all';this.engineSort='name';
      this.trackFamily = tracks.find(track=>track.id===getSave().selectedTrack)?.family==='wangan'?'wangan':tracks.find(track=>track.id===getSave().selectedTrack)?.closed === false ? 'touge' : 'city';
      this.trackQuery = ''; this.inventoryRarity='all'; this.inventorySlot='all';
      $('#inventory-slot').innerHTML='<option value="all">Все детали</option>'+NDCards.slots.map(slot=>`<option value="${slot.id}">${esc(slot.name)}</option>`).join('');
      $('#inventory-rarity').addEventListener('change',event=>{this.inventoryRarity=event.target.value;this.renderInventory();});
      $('#inventory-slot').addEventListener('change',event=>{this.inventorySlot=event.target.value;this.renderInventory();});
      $('#car-brand').innerHTML = '<option value="all">Все марки</option>' + [...new Set(cars.map(car=>car.brand))].sort().map(brand=>`<option value="${esc(brand)}">${esc(brand)}</option>`).join('');
      $('#car-search').addEventListener('input',event=>{this.query=event.target.value;this.carPage=0;this.renderCars();});
      $('#car-brand').addEventListener('change',event=>{this.brand=event.target.value;this.carPage=0;this.renderCars();});
      $('#car-sort').addEventListener('change',event=>{this.sort=event.target.value;this.carPage=0;this.renderCars();});
      $('#owned-filter').addEventListener('click',()=>{this.onlyOwned=!this.onlyOwned;this.carPage=0;this.renderCars();});
      $('#engine-compatibility').addEventListener('change',event=>{this.engineCompatibility=event.target.value;this.renderEngines();});
      $('#engine-type').addEventListener('change',event=>{this.engineType=event.target.value;this.renderEngines();});
      $('#engine-sort').addEventListener('change',event=>{this.engineSort=event.target.value;this.renderEngines();});
      $('#track-search').addEventListener('input',event=>{this.trackQuery=event.target.value;this.renderTracks();});
      document.addEventListener('click',event=>{
        const button=event.target.closest('button');if(!button)return;
        if(button.dataset.action==='next-loot'||button.dataset.action==='unseal-case')this.advanceReveal();
        if(button.dataset.garageTab){this.tab=button.dataset.garageTab;this.renderInventory();this.renderTabs();}
        if(button.dataset.cardSlot){this.tab='inventory';this.inventorySlot=button.dataset.cardSlot;$('#inventory-slot').value=this.inventorySlot;this.renderInventory();this.renderTabs();$('.garage-tabs').scrollIntoView({block:'start',behavior:'instant'});}
        if(button.dataset.vwModel || button.hasAttribute('data-vw-view') || button.dataset.vwPaint){
          const {vwModel,vwView,vwPaint}=button.dataset;
          if(vwModel && vwModel!==this.vwModel){this.vwModel=vwModel;this.vwView=0;this.vwPreviewPaint=null;}
          if(vwView!==undefined)this.vwView=Number(vwView);
          if(vwPaint)this.vwPreviewPaint=vwPaint;
          this.refreshVWShop();
          const selector=vwModel?`[data-vw-model="${vwModel}"]`:vwPaint?`[data-vw-paint="${vwPaint}"]`:`[data-vw-view="${vwView}"]`;
          $(selector)?.focus({preventScroll:true});
        }
        if(button.dataset.bmwModel){this.bmwModel=button.dataset.bmwModel;this.renderBMWShop();this.renderShopRevButtons();this.renderPityMeters();document.querySelector('[data-bmw-model="'+this.bmwModel+'"]').focus({preventScroll:true});}
        if(button.dataset.italyModel){this.italyModel=button.dataset.italyModel;this.renderItalyShop();this.renderShopRevButtons();this.renderPityMeters();document.querySelector('[data-italy-model="'+this.italyModel+'"]').focus({preventScroll:true});}
        if(button.dataset.trackFamily){this.trackFamily=button.dataset.trackFamily;this.renderTracks();}
        if(button.dataset.carPage){this.carPage=Math.max(0,this.carPage+Number(button.dataset.carPage));this.renderCars();$('#car-search').scrollIntoView({block:'center',behavior:'instant'});}
      });
      $('#shop-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-shop-tab]');if(!button)return;this.setShopTab(button.dataset.shopTab);});
      for(const el of $$('[data-car-count]'))el.textContent=String(cars.length);
      for(const el of $$('[data-engine-count]'))el.textContent=String(engines.length);
      for(const el of $$('[data-touge-count]'))el.textContent=String(tracks.filter(track=>track.closed===false&&track.family!=='wangan').length);
    }
    renderTabs() {
      for(const button of $$('[data-garage-tab]')){const active=button.dataset.garageTab===this.tab;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
      for(const name of ['cars','workshop','engines','inventory'])$(`#garage-pane-${name}`).hidden=name!==this.tab;
    }
    currentBuild() {
      const save=this.getSave();return NDCards.computeBuild(save.selectedCar,save.upgrades[save.selectedCar],save.selectedEngines[save.selectedCar],save.equippedCards[save.selectedCar]);
    }
    renderGarage() {
      const save=this.getSave(),build=this.currentBuild(),car=build.car;
      const ownedCars=cars.filter(item=>save.owned.includes(item.id));
      $('#owned-car-count').textContent=String(ownedCars.length);
      $('#owned-car-list').innerHTML=ownedCars.map(item=>{
        const selected=item.id===save.selectedCar;
        return `<button class="owned-car${selected?' selected':''}" data-car="${item.id}" aria-pressed="${selected}" ${selected?'disabled':''}><span class="owned-car-photo"><img class="${carSpriteClass(item)}" src="${esc(encodeURI(root.NDCatalog.getCarSprite(item,save.paints[item.id])))}" alt="" loading="lazy"></span><span class="owned-car-name"><strong>${esc(item.name)}</strong>${editionBadge(item)}<small>${selected?'НА СТАРТЕ':'ВЫБРАТЬ'} · ${item.drivetrain}</small></span>${selected?icon('check'):icon('arrow')}</button>`;
      }).join('');
      $('#build-summary').innerHTML=`<div class="build-photo"><img class="${carSpriteClass(car)}" src="${esc(encodeURI(root.NDCatalog.getCarSprite(car,save.paints[car.id])))}" alt="${esc(car.name)}"><span>${esc(car.tag)}</span></div><div class="build-data"><span class="eyebrow">НА ЛИНИИ СТАРТА / ТВОЯ СБОРКА</span><h2>${esc(car.name)}</h2>${editionBadge(car)}<div class="build-engine">${icon('settings')} ${esc(build.engine.name)} <span>${build.engineId===car.stockEngineId?'ШТАТНЫЙ':'СВАП'}</span></div><div class="build-specs">${spec('МОЩНОСТЬ',n(build.powerHp),'л.с.')}${spec('МАССА',n(build.weightKg),'кг')}${spec('УДЕЛЬНАЯ МОЩНОСТЬ',n(build.hpPerTonne),'л.с./т')}</div><div class="build-actions"><button class="text-button" data-garage-tab="workshop">В МАСТЕРСКУЮ ${icon('arrow')}</button><button class="text-button" data-garage-tab="engines">ЗАМЕНИТЬ МОТОР ${icon('arrow')}</button></div></div>`;
      if(car.tuningLocked)$('#build-summary .build-actions').innerHTML='<span class="stock-build-badge">ФИКСИРОВАННАЯ СБОРКА / ТЮНИНГ ОТКЛЮЧЁН</span>'+carCardLink(car);
      else if(car.shopExclusive)$('#build-summary .build-actions').insertAdjacentHTML('beforeend',carCardLink(car));
      $('#build-summary .build-data').insertAdjacentHTML('beforeend',revButton(build.engineId,true));
      if(car.paint)$('#build-summary .build-data').insertAdjacentHTML('beforeend',root.NDVW.paintChoices(save.paints[car.id]||car.paint,'garage',car.id));
      this.renderCars();this.renderUpgrades();this.renderEngines();this.renderInventory();this.renderTabs();
    }
    renderCars() {
      const save=this.getSave(),query=this.query.toLocaleLowerCase('ru-RU').trim();
      const filtered=cars.filter(car=>(!car.shopExclusive||save.owned.includes(car.id))&&(this.brand==='all'||car.brand===this.brand)&&(!this.onlyOwned||save.owned.includes(car.id))&&(!query||`${car.name} ${car.id} ${car.stockEngineId}`.toLocaleLowerCase('ru-RU').includes(query)));
      filtered.sort((a,b)=>this.sort==='name'?a.name.localeCompare(b.name):this.sort==='ratio-desc'?b.stockPowerHp/b.weightKg-a.stockPowerHp/a.weightKg:a.stockPowerHp/a.weightKg-b.stockPowerHp/b.weightKg);
      const pageSize=9,pages=Math.max(1,Math.ceil(filtered.length/pageSize));this.carPage=Math.min(this.carPage,pages-1);
      const visible=filtered.slice(this.carPage*pageSize,(this.carPage+1)*pageSize);
      $('#car-results-count').textContent=`${filtered.length?this.carPage*pageSize+1:0}–${Math.min((this.carPage+1)*pageSize,filtered.length)} / ${filtered.length} МАШИН`;
      $('#owned-filter').setAttribute('aria-pressed',String(this.onlyOwned));$('#owned-filter').classList.toggle('active',this.onlyOwned);
      $('#car-grid').innerHTML=visible.length?visible.map(car=>{
        const owned=save.owned.includes(car.id),selected=save.selectedCar===car.id;
        const action=selected?`${icon('check')} НА СТАРТЕ`:owned?`ВЫБРАТЬ ${icon('arrow')}`:`${icon('lock')} ₡ ${n(car.price)}`;
        return `<article class="car-card${selected?' selected':''}"><div class="car-illustration sprite-art"><span class="car-type">${esc(car.brand.toUpperCase())} / ${esc(car.drivetrain)}</span><img class="${carSpriteClass(car)}" src="${esc(encodeURI(root.NDCatalog.getCarSprite(car,save.paints[car.id])))}" loading="lazy" decoding="async" alt="${esc(car.name)}">${selected?`<span class="car-badge">${icon('check')} ВЫБРАНА</span>`:owned?'<span class="car-badge">В ГАРАЖЕ</span>':''}</div><div class="car-content">${editionBadge(car)}<h2>${esc(car.name)}</h2><p class="car-motor-label">${esc(car.stockEngineLabel||engines.find(engine=>engine.id===car.stockEngineId)?.name||car.stockEngineId)} / СТОК</p><div class="car-real-specs">${spec('Л.С.',n(car.stockPowerHp))}${spec('КГ',n(car.weightKg))}${spec('Л.С./КГ',n(car.stockPowerHp/car.weightKg,3))}</div><div class="car-market-price"><span>ЦЕНА КУЗОВА</span><strong>₡ ${n(car.price)}</strong></div>${owned?'':revButton(car.stockEngineId)}<button class="button ${selected?'button-outline':'button-lime'}" data-car="${car.id}" ${selected?'disabled':''}>${action}</button>${carCardLink(car)}</div></article>`;
      }).join(''):'<div class="empty-state">По этому запросу машин нет. Попробуй другую марку или модель.</div>';
      $('#car-pagination').innerHTML=`<button class="button button-outline" data-car-page="-1" ${this.carPage===0?'disabled':''}>← НАЗАД</button><span>${this.carPage+1} / ${pages}</span><button class="button button-outline" data-car-page="1" ${this.carPage>=pages-1?'disabled':''}>ДАЛЬШЕ →</button>`;
    }
    renderUpgrades() {
      const save=this.getSave(),carId=save.selectedCar,build=this.currentBuild();
      $('#upgrade-car-name').textContent=build.car.name;
      $('#garage-pane-workshop .economy-note').hidden=build.car.tuningLocked;
      $('#garage-pane-workshop .section-note').hidden=build.car.tuningLocked;
      $('#garage-pane-workshop h2').innerHTML=build.car.tuningLocked?'Заводской характер<span>.</span>':'Каждая деталь решает<span>.</span>';
      if(build.car.tuningLocked){$('#upgrade-grid').innerHTML=`<div class="empty-state stock-lock"><strong>${esc(build.car.edition||build.car.name)} / фиксированная сборка.</strong><p>${esc(build.engine.name)} · ${n(build.powerHp)} PS · ${n(build.weightKg)} кг. На этой машине нельзя устанавливать карточки, менять мотор или повышать уровни деталей.</p></div>`;return;}
      const levels=NDCards.getLevels(save.upgrades[carId],save.equippedCards[carId]);
      $('#upgrade-grid').innerHTML=NDCards.slots.map(slot=>{
        const equipped=NDCards.getCard(save.equippedCards[carId][slot.id]),level=levels[slot.id];
        const rarity=level===3?'red':level===2?'yellow':'blue';
        const card=equipped||NDCards.getCardForSlot(slot.id,rarity);
        return `<article class="card-slot rarity-${level?rarity:'empty'}"><div class="slot-top"><span>${esc(slot.name)}</span><b>${level} / 3</b></div><div class="slot-art${level?'':' empty-art'}"><img src="${esc(encodeURI(card.image))}" loading="lazy" alt="${esc(card.name)}"></div><div class="slot-data"><h3>${level?esc(card.name):'Слот свободен'}</h3><p>${level?esc(card.effectText):'Получи карточку этой детали в кейсе или крафте.'}</p><span class="slot-status">${equipped?'КАРТОЧКА УСТАНОВЛЕНА':level?'СОХРАНЁННАЯ ДЕТАЛЬ':'БАЗОВАЯ КОМПЛЕКТАЦИЯ'}</span><button class="button button-outline full-width" data-card-slot="${slot.id}">КАРТОЧКИ ДЕТАЛИ ${icon('arrow')}</button>${equipped?`<button class="text-button full-width" data-unequip-slot="${slot.id}">СНЯТЬ В ИНВЕНТАРЬ</button>`:''}</div></article>`;
      }).join('');
    }
    cardMarkup(card, amount, reveal=false, offer=null) {
      const save=this.getSave(),levels=NDCards.getLevels(save.upgrades[save.selectedCar],save.equippedCards[save.selectedCar]);
      const locked=cars.find(car=>car.id===save.selectedCar).tuningLocked;
      const rarity=NDCards.rarities[card.rarity],canEquip=!locked&&amount>0&&card.level>levels[card.slotId];
      const buy=offer?`<button class="button ${offer.purchased?'button-outline':'button-lime'} full-width" data-buy-card="${offer.id}" ${offer.purchased?'disabled':''}>${offer.purchased?'КУПЛЕНО':'КУПИТЬ / ₡ 1 000'}</button>`:null;
      return `<article class="tuning-card rarity-${card.rarity}${reveal?' revealed':''}"><div class="tuning-card-art"><img src="${esc(encodeURI(card.image))}" loading="${reveal?'eager':'lazy'}" alt="${esc(card.name)}, ${esc(rarity.label)}, уровень ${card.level}">${!reveal?`<span class="card-quantity">×${amount}</span>`:''}</div><div class="tuning-card-data"><span class="card-rarity">${esc(rarity.name.toUpperCase())} / УРОВЕНЬ ${card.level}</span><h3>${esc(card.name)}</h3><p>${esc(card.effectText)}</p><small>ИГРОВЫЕ ХАРАКТЕРИСТИКИ</small>${offer?buy:!reveal?`<button class="button button-outline full-width" data-equip-card="${card.id}" ${canEquip?'':'disabled'}>${locked?'ФИКСИРОВАННАЯ СБОРКА / ТЮНИНГ ОТКЛЮЧЁН':canEquip?'УСТАНОВИТЬ НА МАШИНУ':levels[card.slotId]>=card.level?'УРОВЕНЬ УЖЕ ЕСТЬ':'НЕТ СВОБОДНОЙ КАРТЫ'}</button>`:''}</div></article>`;
    }
    renderInventory() {
      const save=this.getSave(),cases=save.inventory.cases.street,special=save.inventory.cases.s2000;
      const totalCases=Object.values(save.inventory.cases).reduce((sum,count)=>sum+count,0);
      const total=NDCards.cards.reduce((sum,card)=>sum+NDLoot.quantity(save,card.id),0);
      for(const el of $$('[data-case-count]'))el.textContent=String(totalCases);
      for(const el of $$('[data-spare-count]'))el.textContent=n(total);
      $('#inventory-car-name').textContent=cars.find(car=>car.id===save.selectedCar).name;
      $('#case-panel').innerHTML=`<div class="owned-case-image"><img src="${esc(encodeURI(NDShop.assets.closed))}" alt="Кейс Touge Tuned"></div><div><span class="eyebrow">КЕЙСЫ В ГАРАЖЕ / ×${cases}</span><h3>Touge Tuned<span>.</span></h3><p>В каждом кейсе от 1 до 3 карточек. Открой заработанный кейс или загляни в магазин за новым.</p></div><div class="owned-case-actions"><button class="button button-lime" data-action="open-case" ${cases?'':'disabled'}>ОТКРЫТЬ КЕЙС ${icon('arrow')}</button><button class="text-button" data-nav="shop">В МАГАЗИН ${icon('arrow')}</button></div>`;
      $('#s2000-owned-case').hidden=!special;
      $('#s2000-owned-count').textContent=String(special);
      $('#s2000-owned-image').src=encodeURI(NDShop.s2000.assets.closed);
      const legends=NDShop.legends, legendCount=save.inventory.cases.legends;
      $('#legends-owned-case').innerHTML=legendCount ? `<div class="case-panel owned-case-panel"><div class="owned-case-image"><img src="${esc(encodeURI(legends.assets.closed))}" alt="Кейс Легенды интернета"></div><div><span class="eyebrow">ЛЕГЕНДЫ ИНТЕРНЕТА / ×${legendCount}</span><h3>Четыре легенды<span>.</span></h3><p>От одной до трёх наград в каждом кейсе.</p></div><div class="owned-case-actions"><button class="button button-gold" data-action="open-case" data-case="legends">ОТКРЫТЬ КЕЙС ${icon('arrow')}</button></div></div>` : '';
      $('#takumi-owned-cases').innerHTML=NDShop.takumi.filter(offer=>save.inventory.cases[offer.caseId]>0).map(offer=>`<div class="case-panel owned-case-panel takumi-owned-case"><div class="owned-case-image"><img src="${esc(encodeURI(offer.assets.closed))}" alt="Кейс ${offer.label}"></div><div><span class="eyebrow">${offer.label} / ×${save.inventory.cases[offer.caseId]}</span><h3>Призрак Акины<span>.</span></h3><p>Синяя деталь, монеты или AE86 [${offer.caseId==='ae86-akina'?'Akina Spec':'Project D Spec'}].</p></div><div class="owned-case-actions"><button class="button button-gold" data-action="open-case" data-case="${offer.caseId}">ОТКРЫТЬ КЕЙС ${icon('arrow')}</button></div></div>`).join('');
      const brothersCount=save.inventory.cases.brothers||0;
      const roadsterCount=save.inventory.cases.roadster||0;
      $('#roadster-owned-case').innerHTML=roadsterCount?`<div class="case-panel owned-case-panel takumi-owned-case"><div class="owned-case-image"><img src="${esc(NDShop.roadster.assets.closed)}" alt="Кейс Всегда правильный ответ"></div><div><span class="eyebrow">SMILES PER HOUR / ×${roadsterCount}</span><h3>Всегда правильный ответ<span>.</span></h3><p>Синие и жёлтые детали, монеты или Mazda Roadster NA6CE. Базовый шанс машины — 1% на награду.</p></div><div class="owned-case-actions"><button class="button button-gold" data-action="open-case" data-case="roadster">ОТКРЫТЬ КЕЙС ${icon('arrow')}</button></div></div>`:'';
      const vwCount=save.inventory.cases.vw||0;
      $('#vw-owned-case').innerHTML=vwCount?`<div class="case-panel owned-case-panel"><div class="owned-case-image"><img src="${NDShop.vw.assets.closed}" alt="Кейс Wolfsburg Edition"></div><div><h3>Народный калибр ×${vwCount}</h3><p>1–3 награды · 2% на пять Volkswagen вместе за награду вне гаранта.</p></div><button class="button" data-action="open-case" data-case="vw">ОТКРЫТЬ КЕЙС</button></div>`:'';
      const bmwCount=save.inventory.cases.bmw||0;
      $('#bmw-owned-case').innerHTML=bmwCount?`<div class="case-panel owned-case-panel"><div class="owned-case-image"><img src="${NDShop.bmw.assets.closed}" alt="Кейс BMW Motorsport"></div><div><h3>BMW Motorsport ×${bmwCount}</h3><p>1–3 награды · 1,5% на три M3 вместе, по 0,5% на каждую.</p></div><button class="button" data-action="open-case" data-case="bmw">ОТКРЫТЬ КЕЙС</button></div>`:'';
      const mustangCount=save.inventory.cases.mustang||0;
      $('#mustang-owned-case').innerHTML=mustangCount?`<div class="case-panel owned-case-panel"><div class="owned-case-image"><img src="${NDShop.mustang.assets.closed}" alt="Кейс American Pony"></div><div><h3>Американская лошадка ×${mustangCount}</h3><p>1–3 награды · Mustang GT: 1% на награду вне гаранта.</p></div><button class="button" data-action="open-case" data-case="mustang">ОТКРЫТЬ КЕЙС</button></div>`:'';
      const italyCount=save.inventory.cases.italy||0;
      $('#italy-owned-case').innerHTML=italyCount?`<div class="case-panel owned-case-panel"><div class="owned-case-image"><img src="assets/cases/italy-closed.png" alt="Кейс Reparto Corse"></div><div><h3>И вам привет из Италии</h3><p>1–3 награды · 2% на одну из четырёх машин. В наличии: ×${italyCount}</p></div><button class="button" data-action="open-case" data-case="italy">ОТКРЫТЬ КЕЙС</button></div>`:'';
      const blackbirdCount=save.inventory.cases.blackbird||0;
      $('#blackbird-owned-case').innerHTML=blackbirdCount?`<div class="case-panel owned-case-panel"><div class="owned-case-image"><img src="${NDShop.blackbird.assets.closed}" alt="Кейс Blackbird"></div><div><span class="eyebrow">BLACKBIRD / ×${blackbirdCount}</span><h3>Porsche 911 Turbo 3.3</h3><p>1–3 награды. Шанс Blackbird — 1% на награду вне гаранта.</p></div><div class="owned-case-actions"><button class="button button-gold" data-action="open-case" data-case="blackbird">ОТКРЫТЬ КЕЙС ${icon('arrow')}</button></div></div>`:'';
      const mercedesCount=save.inventory.cases.mercedes||0;
      $('#mercedes-owned-case').innerHTML=mercedesCount?`<div class="case-panel owned-case-panel takumi-owned-case"><div class="owned-case-image"><img src="${esc(NDShop.mercedes.assets.closed)}" alt="Кейс Homologation 502"></div><div><span class="eyebrow">HOMOLOGATION 502 / ×${mercedesCount}</span><h3>Mercedes Evo II<span>.</span></h3><p>Детали, монеты или Mercedes. Шанс машины — 1% на награду.</p></div><div class="owned-case-actions"><button class="button button-gold" data-action="open-case" data-case="mercedes">ОТКРЫТЬ КЕЙС ${icon('arrow')}</button></div></div>`:'';
      $('#brothers-owned-case').innerHTML=brothersCount?`<div class="case-panel owned-case-panel takumi-owned-case"><div class="owned-case-image"><img src="${esc(encodeURI(NDShop.brothers.assets.closed))}" alt="Кейс Заокеанские братья"></div><div><span class="eyebrow">USDM BROTHERS / ×${brothersCount}</span><h3>Заокеанские братья<span>.</span></h3><p>Синие и жёлтые детали, монеты или Lexus. Шанс каждой машины — 0,5% на награду.</p></div><div class="owned-case-actions"><button class="button button-gold" data-action="open-case" data-case="brothers">ОТКРЫТЬ КЕЙС ${icon('arrow')}</button></div></div>`:'';
      const specialCars=cars.filter(car=>car.shopExclusive&&save.owned.includes(car.id));
      $('#inventory-car-cards').innerHTML=specialCars.length ? `<div class="inventory-car-cards-heading"><span class="eyebrow">КОЛЛЕКЦИЯ / ТВОИ МАШИНЫ</span><h3>Карточки особых машин<span>.</span></h3><p>Посмотри карточки машин, которые уже есть в гараже.</p></div><div class="inventory-car-cards-grid">${specialCars.map(car=>{const offer=NDShop.getCarOffer(car.id); const art=carCardArt(car,offer,save.paints[car.id]); return `<button class="inventory-car-card rarity-${car.pityOnly?'purple':'gold'}" data-car-card="${car.id}" aria-label="Посмотреть карточку ${esc(car.name)}"><img src="${esc(encodeURI(art))}" alt="" loading="lazy"><span>${editionBadge(car)}<strong>${esc(car.name)}</strong><small>ПОСМОТРЕТЬ КАРТОЧКУ ${icon('arrow')}</small></span></button>`}).join('')}</div>` : '';
      $('#craft-panel').innerHTML=['blue','yellow'].map(rarity=>{
        const count=NDLoot.countRarity(save,rarity),next=rarity==='blue'?'yellow':'red';
        return `<article class="craft-card"><div class="craft-equation"><span class="rarity-${rarity}">10 <small>${rarity==='blue'?'СИНИХ':'ЖЁЛТЫХ'}</small></span><i>→</i><span class="rarity-${next}">2 <small>${next==='yellow'?'ЖЁЛТЫЕ':'КРАСНЫЕ'}</small></span></div><p>Любые свободные карты этой редкости. Две новые детали выбираются случайно.</p><div class="craft-bottom"><span>ДОСТУПНО <b>${n(count)} / 10</b></span><button class="button button-outline" data-craft="${rarity}" ${count>=10?'':'disabled'}>СОЗДАТЬ</button></div></article>`;
      }).join('');
      const available=NDCards.cards.filter(card=>NDLoot.quantity(save,card.id)>0&&(this.inventoryRarity==='all'||card.rarity===this.inventoryRarity)&&(this.inventorySlot==='all'||card.slotId===this.inventorySlot));
      available.sort((a,b)=>b.level-a.level||a.name.localeCompare(b.name));
      $('#inventory-grid').innerHTML=available.length?available.map(card=>this.cardMarkup(card,NDLoot.quantity(save,card.id))).join(''):'<div class="empty-state inventory-empty"><strong>Здесь начинается твоя сборка.</strong><p>Свободных карточек по этому фильтру пока нет. Открой кейс после финиша или выбери другой тип детали. Установленные карточки находятся в мастерской.</p></div>';
      this.renderPityMeters();
    }
    renderTakumiShop() {
      const save=this.getSave();
      const cover=NDShop.takumi[0];
      $('#takumi-showcase').innerHTML=`
        <header class="akina-masthead"><span>TOUGE ARCHIVE <b>/ 086</b></span><span>TAKUMI FUJIWARA · TWO CHAPTERS</span></header>
        <div class="akina-cover">
          <div class="akina-cover-copy"><span class="akina-kicker">TOYOTA SPRINTER TRUENO / GT-APEX</span><h2>Призрак<br><em>Акины.</em></h2><p>Пока город спит,<br>перевал запоминает имена.</p><div class="akina-cover-bottom"><strong>AE86</strong><span>ЛЁГКИЙ КУЗОВ.<br>ТЯЖЁЛЫЙ ХАРАКТЕР.</span></div></div>
          <button class="akina-cover-art" data-photo="${cover.caseId}:hero" aria-label="Открыть обложку Призрак Акины на весь экран"><img src="${esc(encodeURI(cover.assets.hero))}" alt="Такуми и белая Toyota AE86 на фоне летнего неба" width="736" height="414"><span>ИЗ АРХИВА / TAKUMI & TRUENO ${icon('full')}</span></button>
        </div>
        <nav class="akina-chapters" aria-label="Главы истории AE86"><button data-shop-jump="akina-chapter-1"><b>01</b><span>РОЖДЕНИЕ ЛЕГЕНДЫ<small>AKINA SPEC / 150 PS</small></span>${icon('arrow')}</button><button data-shop-jump="akina-chapter-2"><b>02</b><span>СЛЕДУЮЩИЙ ПОВОРОТ<small>PROJECT D SPEC / 240 PS</small></span>${icon('arrow')}</button></nav>
        <div class="akina-editorial"><span>НЕ ВСЁ РЕШАЕТ МОТОР.</span><p>Одна AE86. Две главы истории. Сначала — знакомый спуск Акины, затем — дороги за его пределами. Выбери ту версию, с которой начнётся твоя история.</p><svg viewBox="0 0 210 80" aria-hidden="true"><path d="M3 68h48c32 0 8-49 46-49h38c37 0-14 44 18 44h54"/></svg></div>
      `+NDShop.takumi.map((offer,index)=>{
        const car=cars.find(item=>item.id===offer.carId),owned=save.owned.includes(car.id),count=save.inventory.cases[offer.caseId];
        const carChance=Math.round((1-offer.blueChance-offer.currencyChance)*100);
        const history=index===0?'На этой Trueno Такуми начинал гоняться на Акине. Лёгкий кузов, атмосферный 4A-GEU и знакомые шпильки — первая глава истории.':'Следующая глава — Project D. Под чёрным капотом уже TRD 4A-GE Group A, а более лёгкая сборка развивает 240 PS.';
        return `<article class="takumi-stage" id="akina-chapter-${index+1}" tabindex="-1">
          <div class="akina-chapter-label"><span>ГЛАВА / 0${index+1}</span><span>${index===0?'THE LOCAL HERO':'THE NEXT STAGE'}</span></div>
          <div class="takumi-stage-heading"><span class="takumi-stage-number">0${index+1}</span><div>${editionBadge(car)}<h3>${index===0?'С чего всё<br>началось.':'За пределами<br>Акины.'}</h3><p>${history}</p></div><span class="akina-chapter-mark" aria-hidden="true">${index===0?'86':'D.'}</span></div>
          <div class="akina-spec-strip"><div><b>${car.stockPowerHp}<small> PS</small></b><span>МОЩНОСТЬ</span></div><div><b>${n(car.weightKg)}<small> КГ</small></b><span>МАССА</span></div><div><b>${esc(car.stockEngineLabel)}</b><span>АТМОСФЕРНЫЙ МОТОР</span></div><div><b>FR</b><span>ЗАДНИЙ ПРИВОД</span></div></div>
          <div class="takumi-photos ${index===0?'takumi-photos-akina':'takumi-photos-project-d'}"><button class="takumi-photo" data-photo="${offer.caseId}:hero" aria-label="Открыть фото AE86 ${car.edition} на весь экран"><img src="${esc(encodeURI(offer.assets.hero))}" width="736" height="${index===0?414:358}" alt="AE86 — ${car.edition}" loading="lazy"><span><b>01 / МАШИНА</b> НА ВЕСЬ ЭКРАН ${icon('full')}</span></button><button class="takumi-photo" data-photo="${offer.caseId}:purchase" aria-label="Открыть фото Такуми ${car.edition} на весь экран"><img src="${esc(encodeURI(offer.assets.purchase))}" width="${index===0?735:600}" height="${index===0?375:809}" alt="Такуми и его Toyota Sprinter Trueno" loading="lazy"><span><b>02 / ИЗ АРХИВА</b> НА ВЕСЬ ЭКРАН ${icon('full')}</span></button></div>
          <div class="takumi-products shop-jump-target" id="shop-exclusive-${offer.caseId}" tabindex="-1"><div class="takumi-case"><div class="akina-case-visual"><span>КОЛЛЕКЦИОННЫЙ КЕЙС</span><img class="takumi-case-art" src="${esc(encodeURI(offer.assets.closed))}" alt="Кейс ${car.edition}" loading="lazy"><b>0${index+1} / ${index===0?'AKINA':'PROJECT D'}</b></div><div class="takumi-case-info"><span class="eyebrow">КЕЙС / ${offer.label}</span><h4>Шанс встретить<br>призрака.</h4><div class="s2000-case-odds"><span class="rarity-blue"><b>${Math.round(offer.blueChance*100)}%</b>СИНЯЯ ДЕТАЛЬ</span><span class="rarity-yellow"><b>8%</b>₡ 500–2 000</span><span class="rarity-gold"><b>${carChance}%</b>AE86</span></div><p>Базовые шансы вне гаранта. Одна награда в кейсе. Повтор этой версии машины — случайная красная деталь.</p><strong class="takumi-case-price">₡ ${n(offer.casePrice)}</strong><button class="button button-gold full-width" data-action="buy-case" data-case="${offer.caseId}" ${save.credits<offer.casePrice||count>=99999?'disabled':''}>КУПИТЬ КЕЙС ${icon('arrow')}</button><button class="button button-outline full-width" data-action="open-case" data-case="${offer.caseId}" ${count?'':'disabled'}>ОТКРЫТЬ СВОЙ КЕЙС ×${count}</button></div></div><div class="takumi-car"><span class="eyebrow">${owned?'УЖЕ В ТВОЁМ ГАРАЖЕ':'ПРЯМАЯ ПОКУПКА / БЕЗ СЛУЧАЙНОСТИ'}</span><div class="takumi-car-sprite"><img src="${esc(encodeURI(car.raceSprite))}" alt="Спрайт AE86 ${car.edition}"></div>${editionBadge(car)}<h4>Toyota Sprinter Trueno<br>GT-APEX (AE86)</h4><p>${car.stockEngineLabel} · ${car.stockPowerHp} PS · ${car.weightKg} кг</p><small>Фиксированная сборка. Тюнинг и замена двигателя отключены.</small><strong class="takumi-direct-price">₡ ${n(car.price)}</strong><button class="button button-gold full-width" data-exclusive-car="${car.id}" ${!owned&&save.credits<car.price?'disabled':''}>${owned?'ВЫБРАТЬ ИЗ ГАРАЖА':'КУПИТЬ МАШИНУ'} ${icon('arrow')}</button>${carCardLink(car)}</div></div>
        </article>`;
      }).join('')+`<footer class="akina-colophon"><strong>НЕ КОНЕЦ.<br>СЛЕДУЮЩИЙ ПОВОРОТ.</strong><span>TOUGE ARCHIVE / 086<br>AKINA → PROJECT D</span></footer>`;
    }
    setShopTab(tab) {
      if(!$$('[data-shop-tab]').some(button=>button.dataset.shopTab===tab))return;
      this.shopTab=tab;this.renderShopTabs();
      const button=$(`[data-shop-tab="${tab}"]`),strip=$('#shop-tabs');
      strip.scrollTo({left:button.offsetLeft-strip.offsetLeft-12,behavior:'smooth'});
    }
    renderShopTabs() {
      const tab=this.shopTab||'cases';
      for(const button of $$('[data-shop-tab]')){const active=button.dataset.shopTab===tab;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
      for(const panel of $$('[data-shop-panel]'))panel.hidden=panel.dataset.shopPanel!==tab;
    }
    renderShop() {
      const save=this.getSave(),stock=NDShop.getStock(save),remaining=NDShop.remainingRaces(save);
      $('#shop-case-image').src=encodeURI(NDShop.assets.closed);
      const special=NDShop.s2000,owned=save.owned.includes(special.carId);
      $('#s2000-hero').src=encodeURI(special.assets.hero);$('#s2000-car-image').src=encodeURI(special.assets.purchase);$('#s2000-case-image').src=encodeURI(special.assets.closed);
      $('#s2000-case-count').textContent=String(save.inventory.cases.s2000);
      $('#s2000-case-buy').disabled=save.credits<special.casePrice||save.inventory.cases.s2000>=99999;
      $('#s2000-case-open').disabled=!save.inventory.cases.s2000;
      $('#s2000-car-buy').dataset.action=owned?'select-s2000':'buy-s2000';
      $('#s2000-car-buy').disabled=!owned&&save.credits<special.carPrice;
      $('#s2000-car-buy').innerHTML=(owned?'ВЫБРАТЬ ИЗ ГАРАЖА':'КУПИТЬ МАШИНУ')+' '+icon('arrow');
      $('#s2000-car-status').textContent=owned?'УЖЕ В ТВОЁМ ГАРАЖЕ':'ЭКСКЛЮЗИВ МАГАЗИНА';
      $('#shop-case-count').textContent=String(save.inventory.cases.street);
      $('#shop-open-case').disabled=!save.inventory.cases.street;
      $('#shop-case-buy').disabled=save.credits<NDShop.prices.case||save.inventory.cases.street>=99999;
      $('#shop-refresh-count').textContent=String(remaining);
      $('#shop-cycle').textContent=String(save.shop.cycle+1).padStart(2,'0');
      $('#shop-race-progress').style.width=String((5-remaining)/5*100)+'%';
      $('#shop-card-grid').innerHTML=stock.map(offer=>this.cardMarkup(offer.card,1,false,offer)).join('');
      this.renderTakumiShop();
      this.renderLegendsShop();
      this.renderBrothersShop();
      this.renderRoadsterShop();
      this.renderMercedesShop();
      this.renderBlackbirdShop();
      this.renderItalyShop();this.renderMustangShop();this.renderBMWShop();this.renderVWShop();
      this.renderPityShop();
      this.renderShopRevButtons();
      this.renderPityMeters();
      this.renderShopShortcuts();
      this.explainDisabledPurchases(stock);
      this.renderShopTabs();
    }
    renderShopShortcuts(){
      for(const panel of $$('#view-shop [data-shop-panel]')){
        panel.querySelector('.shop-product-nav')?.remove();
        if(['cases','parts','akina','pity'].includes(panel.dataset.shopPanel))continue;
        const targets=[['Машина',panel.querySelector('[data-exclusive-car]')],['Характеристики',panel.querySelector('[class*="specs"],[class*="spec-strip"]')],['Кейс',panel.querySelector('[data-action="buy-case"]')]].filter(([,target])=>target);
        if(targets.length<2)continue;
        const links=targets.map(([label,target],index)=>{
          target.id ||= `shop-${panel.dataset.shopPanel}-target-${index}`;
          if(!target.matches('button,a'))target.tabIndex=-1;
          return `<button type="button" data-shop-jump="${target.id}">${label}</button>`;
        }).join('');
        panel.insertAdjacentHTML('afterbegin',`<nav class="shop-product-nav" aria-label="Быстрый переход по витрине">${links}</nav>`);
      }
    }
    renderShopRevButtons(){
      for(const button of $$('#view-shop [data-exclusive-car], #s2000-car-buy, #pity-showcase [data-car-card]')){
        if(button.previousElementSibling?.hasAttribute('data-rev-engine'))continue;
        const id=button.dataset.exclusiveCar || button.dataset.carCard || NDShop.s2000.carId;
        const car=cars.find(item=>item.id===id);
        button.insertAdjacentHTML('beforebegin',revButton(car.stockEngineId));
      }
    }
    explainDisabledPurchases(stock){
      const save=this.getSave();
      for(const note of $$('#view-shop .purchase-block-reason'))note.remove();
      for(const button of $$('#view-shop [data-action="buy-case"]')){
        const caseId=button.dataset.case||'street',price=caseId==='street'?NDShop.prices.case:NDShop.specialCases[caseId].casePrice;
        const reason=(save.inventory.cases[caseId]||0)>=99999?'Достигнут предел: 99 999 кейсов.':save.credits<price?`Не хватает ₡ ${n(price-save.credits)}.`:'';
        button.disabled=!!reason;
        if(reason)button.insertAdjacentHTML('afterend',`<span class="purchase-block-reason">${reason}</span>`);
      }
      for(const button of $$('#view-shop [data-exclusive-car]')){
        const car=cars.find(item=>item.id===button.dataset.exclusiveCar),reason=!save.owned.includes(car.id)&&save.credits<car.price?`Не хватает ₡ ${n(car.price-save.credits)}.`:'';
        button.disabled=!!reason;
        if(reason)button.insertAdjacentHTML('afterend',`<span class="purchase-block-reason">${reason}</span>`);
      }
      for(const button of $$('#shop-card-grid [data-buy-card]')){
        const offer=stock.find(item=>item.id===button.dataset.buyCard);
        const reason=offer.purchased?'Эта деталь уже куплена.':(save.inventory.cards[offer.card.id]||0)>=99999?'Инвентарь этой детали заполнен.':save.credits<NDShop.prices.card?`Не хватает ₡ ${n(NDShop.prices.card-save.credits)}.`:'';
        button.disabled=!!reason;
        if(reason)button.insertAdjacentHTML('afterend',`<span class="purchase-block-reason">${reason}</span>`);
      }
    }
    pityMarkup(caseId,inline=false){
      const state=NDShop.getPity(this.getSave(),caseId);if(!state)return '';
      return `<aside class="pity-meter"${inline?' data-inline-pity':''} data-pity-case="${caseId}"><div><span>ГАРАНТ / 50 НА 50</span><strong>${state.count} / ${state.limit}</strong></div><div class="pity-track" role="progressbar" aria-label="Открытия без машины баннера" aria-valuenow="${state.count}" aria-valuemin="0" aria-valuemax="${state.limit}"><i style="width:${state.count/state.limit*100}%"></i></div><p>${state.remaining===1?'Следующий кейс — гарант.':'До гаранта: '+state.remaining+' открытий.'} 50% — машина этого баннера, 50% — Toyota из тройки гаранта.</p></aside>`;
    }
    renderPityMeters(){
      for(const meter of $$('.pity-meter[data-inline-pity]'))meter.remove();
      for(const button of $$('[data-inline-bulk]'))button.remove();
      for(const button of $$('[data-action="open-case"]')){
        const caseId=button.dataset.case||'street',count=this.getSave().inventory.cases[caseId]||0;
        button.insertAdjacentHTML('afterend',`<button class="button button-outline full-width bulk-case-open" data-inline-bulk data-action="open-ten-cases" data-case="${caseId}" ${count<10?'disabled':''} title="${count<10?'Нужно 10 кейсов. В наличии: '+count:'Открыть 10 кейсов этого типа'}">ОТКРЫТЬ 10 КЕЙСОВ ${icon('arrow')}</button>`+this.pityMarkup(caseId,true));
      }
    }
    renderPityShop(){
      const save=this.getSave();
      const pool=NDShop.pityCars.map(id=>{const car=cars.find(item=>item.id===id),owned=save.owned.includes(id);return `<article class="pity-car"><img src="${esc(encodeURI(NDShop.pityOffer.photos[id][0]))}" alt="${esc(car.name)}" loading="lazy"><div>${editionBadge(car)}<h3>${esc(car.name)}</h3><p>1JZ-GTE · 180 PS · ${car.weightKg} кг · FR</p><small>Тюнинг и замена мотора доступны.</small><button class="text-button" data-car-card="${id}">ПОСМОТРЕТЬ КАРТОЧКУ ${icon('arrow')}</button>${owned?`<button class="button button-gold full-width" data-car="${id}">ВЫБРАТЬ ИЗ ГАРАЖА ${icon('arrow')}</button>`:'<span class="pity-exclusive">ТОЛЬКО НА ГАРАНТЕ</span>'}</div></article>`;}).join('');
      $('#pity-showcase').innerHTML=`<div class="pity-heading"><span class="eyebrow">SPECIAL CASES / SECOND CHANCE</span><h2>Поворот удачи<span>.</span></h2><p>Каждый специальный кейс ведёт свой счёт до ${NDShop.pityLimit}. На гарантированном открытии ты получаешь одну награду:</p></div><div class="pity-rules"><div><b>50%</b><strong>Машина баннера</strong><p>В коллекционных кейсах — случайная машина из коллекции этого кейса.</p></div><div><b>50%</b><strong>Одна из трёх Toyota</strong><p>Soarer, Mark II или Chaser. Шансы внутри тройки равны.</p></div></div><p class="pity-explanation">Раннее выпадение машины баннера и любой гарант обнуляют только счётчик этого кейса. Повтор любой машины заменяется случайной красной деталью. После каждого гаранта снова действует 50/50. Прямая покупка машины не сбрасывает прогресс. Счёт начинается с этого обновления; у обычного Touge Tuned гаранта нет.</p><div class="pity-counters">${Object.values(NDShop.specialCases).map(offer=>`<section><h3>${esc(offer.label)}</h3>${this.pityMarkup(offer.caseId)}</section>`).join('')}</div><div class="pity-car-grid">${pool}</div>`;
    }
    renderLegendsShop() {
      const save=this.getSave(), offer=NDShop.legends, count=save.inventory.cases.legends;
      const stories={
        fd2:{title:'Седан с характером Type R.',text:'Civic Type R поколения FD2 появился в Японии в 2007 году. Вместо привычного хэтчбека Honda выбрала кузов седан, сохранив высокооборотный атмосферный мотор и точное шасси. В игре эта версия готова к тюнингу.'},
        nb8c:{title:'Родстер для удовольствия.',text:'Второе поколение Roadster дебютировало в 1998 году. Оно сохранило лёгкий двухместный кузов и задний привод, но получило обычные фары вместо подъёмных. NB8C продолжает простую идею MX-5: открытая дорога и удовольствие от управления.'},
        s30:{title:'Первая глава Z.',text:'Fairlady Z поколения S30 появилась в 1969 году. Длинный капот и кузов купе сделали её узнаваемой во всём мире; за пределами Японии семья стала известна также как Datsun Z. Так началась история спортивных машин Nissan Z.'},
        z33:{title:'Возвращение легенды.',text:'В 2002 году Z33 вернула Fairlady Z после двухлетнего перерыва. За пределами Японии её знали как 350Z. Атмосферный V6 и задний привод соединили наследие серии с новым обликом; в игре Version S сохраняет штатную сборку.'}
      };
      const stages=offer.carIds.map((id,index)=>{
        const car=cars.find(item=>item.id===id),owned=save.owned.includes(id),story=stories[id];
        const photos=offer.photos[id].map((src,photoIndex)=>`<button class="takumi-photo legends-stage-photo" data-legend-photo="${id}:${photoIndex}" aria-label="Открыть фото ${esc(car.name)} на весь экран"><img src="${esc(encodeURI(src))}" alt="${esc(car.name)}" loading="lazy"><span>НА ВЕСЬ ЭКРАН ${icon('full')}</span></button>`).join('');
        return `<article class="takumi-stage legends-stage"><div class="news-story-meta"><span>ПОЛОСА 0${index+1} / ${esc(car.brand.toUpperCase())}</span><span>${esc(car.drivetrain)} · ${car.stockPowerHp} PS</span></div><div class="takumi-stage-heading"><span class="takumi-stage-number">0${index+1}</span><div>${editionBadge(car)}<h3>${story.title}</h3><p>${story.text}</p></div></div><div class="news-model-name">${esc(car.name)}</div><div class="takumi-photos legends-stage-photos">${photos}</div><div class="legends-stage-product"><div class="legends-stage-sprite"><img src="${esc(encodeURI(car.raceSprite))}" alt="Спрайт ${esc(car.name)}" loading="lazy"></div><div class="takumi-car legends-stage-info"><span class="eyebrow">${owned?'УЖЕ В ТВОЁМ ГАРАЖЕ':'ОБЪЯВЛЕНИЕ / ЭКСКЛЮЗИВ МАГАЗИНА'}</span>${editionBadge(car)}<h4>${esc(car.name)}</h4><p>${esc(car.stockEngineLabel)} · ${car.stockPowerHp} PS · ${car.weightKg} кг · ${car.drivetrain}</p><small>${car.tuningLocked?'Фиксированная сборка. Тюнинг и замена двигателя отключены.':'Доступны тюнинг и замена двигателя.'}</small><strong class="takumi-direct-price">₡ ${n(car.price)}</strong><button class="button button-gold full-width" data-exclusive-car="${id}" ${!owned&&save.credits<car.price?'disabled':''}>${owned?'ВЫБРАТЬ ИЗ ГАРАЖА':'КУПИТЬ МАШИНУ'} ${icon('arrow')}</button>${carCardLink(car)}</div></div></article>`;
      }).join('');
      $('#legends-showcase').innerHTML=`<div class="news-edition"><span>ЯПОНСКАЯ АВТОМОБИЛЬНАЯ ГАЗЕТА</span><span>ОСЕННИЙ СПЕЦВЫПУСК / №04</span></div><div class="takumi-heading"><div><span class="eyebrow">THE INTERNET MOTOR GAZETTE</span><h2>Легенды<br><span>интернета.</span></h2></div><p>Четыре машины. Миллионы историй.<br>Специальный выпуск о тех, кого узнают с первого кадра.</p></div><div class="news-running-line"><span>HONDA CIVIC TYPE R</span><span>MAZDA ROADSTER</span><span>NISSAN FAIRLADY Z</span></div><div class="news-editorial"><strong>Из ленты —<br>в твой гараж.</strong><p>Одни машины запоминаются силуэтом, другие — звуком мотора или любимым кадром. В этом выпуске собраны четыре разных характера. Листай фотографии, читай их истории и выбирай свою легенду.</p></div><div class="legends-case"><img src="${esc(encodeURI(offer.assets.closed))}" alt="Кейс Легенды интернета"><div><span class="eyebrow">ОБЪЯВЛЕНИЯ / КОЛЛЕКЦИОННЫЙ КЕЙС</span><h3>Объявляется розыск:<br>твоя легенда<span>.</span></h3><div class="s2000-case-odds"><span class="rarity-blue"><b>90%</b>СИНЯЯ ДЕТАЛЬ</span><span class="rarity-yellow"><b>8,5%</b>₡ 500–2 000</span><span class="rarity-gold"><b>1,5%</b>МАШИНА</span></div><p>Базовые шансы вне гаранта. От 1 до 3 наград; по 0,375% на каждую машину в одной награде. Повтор машины заменяется случайной красной деталью.</p><strong class="takumi-case-price">₡ 2 000</strong><div class="legends-case-actions"><button class="button button-gold" data-action="buy-case" data-case="legends" ${save.credits<2000||count>=99999?'disabled':''}>КУПИТЬ КЕЙС ${icon('arrow')}</button><button class="button button-outline" data-action="open-case" data-case="legends" ${count?'':'disabled'}>ОТКРЫТЬ СВОЙ КЕЙС ×${count}</button></div></div></div><div class="news-section-title"><span>ЛЮДИ УХОДЯТ ИЗ СЕТИ. ЛЕГЕНДЫ ОСТАЮТСЯ.</span><b>ЧЕТЫРЕ ПОЛОСЫ / ЧЕТЫРЕ ХАРАКТЕРА</b></div><div class="legends-stages">${stages}</div><footer class="news-colophon"><span>LEGENDS OF THE INTERNET</span><span>КОНЕЦ СПЕЦВЫПУСКА / TOUGE SUPPLY</span></footer>`;
    }
    renderBrothersShop() {
      const save=this.getSave(),offer=NDShop.brothers,count=save.inventory.cases.brothers||0;
      const stories={is200:{kicker:'01 / TWO-LITRE STRAIGHT SIX',title:'Первый шаг в мир IS.',text:'IS200 вышел на британский рынок в 1999 году. Компактный седан сочетал задний привод, двухлитровую рядную шестёрку и подвеску на двойных поперечных рычагах. Его характер строился вокруг баланса и точного управления.'},is300:{kicker:'02 / THREE-LITRE STRAIGHT SIX',title:'Больше объёма. Больше характера.',text:'В США IS300 появился как модель 2001 года; в Великобритании он присоединился к линейке осенью 2001-го. Под капотом — атмосферный 2JZ, а в основе та же идея компактного спортивного седана с задним приводом.'}};
      const products=offer.carIds.map(id=>{
        const car=cars.find(c=>c.id===id),owned=save.owned.includes(id),story=stories[id];
        return `<article class="dealer-spread"><button class="dealer-photo" data-brothers-photo="${id}" aria-label="Открыть фотографию ${esc(car.name)}"><img src="${esc(encodeURI(offer.photos[id][0]))}" alt="${esc(car.name)}" loading="lazy"><span>СМОТРЕТЬ ФОТО ${icon('full')}</span></button><div class="dealer-copy"><span class="dealer-kicker">${story.kicker}</span>${editionBadge(car)}<h3>${esc(car.name)}</h3><h4>${story.title}</h4><p>${story.text}</p><div class="dealer-specs"><span><b>${car.stockPowerHp}</b> PS</span><span><b>${car.weightKg}</b> КГ</span><span><b>${car.stockEngineLabel}</b> FR</span></div><p class="dealer-tuning">Тюнинг и свап доступны. ${car.stockEngineLabel} можно установить и в другие кузова.</p><div class="dealer-price"><small>${owned?'В ТВОЕЙ КОЛЛЕКЦИИ':'ПРЯМАЯ ПОКУПКА'}</small><strong>₡ ${n(car.price)}</strong></div><button class="button dealer-buy full-width" data-exclusive-car="${id}" ${!owned&&save.credits<car.price?'disabled':''}>${owned?'ВЫБРАТЬ ИЗ ГАРАЖА':'КУПИТЬ МАШИНУ'} ${icon('arrow')}</button>${carCardLink(car)}</div></article>`;
      }).join('');
      $('#brothers-showcase').innerHTML=`<div class="dealer-masthead"><span>TOUGE MOTOR JOURNAL</span><span>SPECIAL ISSUE / 03</span></div><header class="dealer-cover"><span class="dealer-kicker">LEXUS IS / THE FIRST GENERATION</span><h2>Заокеанские<br><em>братья.</em></h2><p>Японские корни. Два характера.<br>IS200 и IS300 в одном специальном выпуске.</p><button class="dealer-photo dealer-cover-photo" data-brothers-photo="cover" aria-label="Открыть фотографию двух Lexus"><img src="${esc(encodeURI(offer.assets.hero))}" alt="Lexus IS200 и IS300" loading="lazy"><span>СМОТРЕТЬ ФОТО ${icon('full')}</span></button><div class="dealer-editorial"><strong>Intelligent Sports.</strong><p>Так Lexus расшифровывает имя IS. Первое поколение сделало спортивный седан компактнее, сохранив задний привод и рядные шестицилиндровые моторы. Выбирай свою версию и собирай её под собственный стиль.</p></div></header>${products}<section class="dealer-case"><div><span class="dealer-kicker">THE COLLECTOR’S CASE</span><img src="${esc(encodeURI(offer.assets.closed))}" alt="Кейс Заокеанские братья" loading="lazy"></div><div><h3>Шанс на своего<br>заокеанского брата.</h3><div class="dealer-odds"><span><b>80%</b>СИНИЕ</span><span><b>10%</b>ЖЁЛТЫЕ</span><span><b>9%</b>МОНЕТЫ</span><span><b>1%</b>LEXUS</span></div><p>От 1 до 3 наград. По 0,5% на IS200 и IS300 в каждой награде. Монеты: 500–2000 с шагом 100. Повтор машины заменяется случайной красной деталью.</p><strong class="dealer-case-price">₡ 1 500</strong><button class="button button-gold full-width" data-action="buy-case" data-case="brothers" ${save.credits<offer.casePrice||count>=99999?'disabled':''}>КУПИТЬ КЕЙС ${icon('arrow')}</button><button class="button button-outline full-width" data-action="open-case" data-case="brothers" ${count?'':'disabled'}>ОТКРЫТЬ СВОЙ КЕЙС ×${count}</button></div></section><footer class="dealer-colophon"><span>USDM BROTHERS / TOUGE SUPPLY</span><details><summary>История моделей — источники Lexus</summary><a href="https://media.lexus.co.uk/vehicles/is-200-archive-1999/" target="_blank" rel="noopener">IS200: архив Lexus UK</a><a href="https://pressroom.lexus.com/lexus-is-the-evolution-of-an-icon/" target="_blank" rel="noopener">IS300: Lexus USA</a><a href="https://media.lexus.co.uk/lexus-announces-pricing-of-the-much-awaited-is300-and-enhanced-specification-for-is200/" target="_blank" rel="noopener">Линейка IS: Lexus UK, 2001</a></details></footer>`;
    }
    renderVWShop(){
      $('#vw-showcase').innerHTML=root.NDVW.render(this.getSave(),this.vwModel,this.vwView,this.vwPreviewPaint);
    }
    refreshVWShop(){
      this.renderVWShop();
      this.renderShopRevButtons();
      this.renderShopShortcuts();
      this.renderPityMeters();
      this.explainDisabledPurchases(NDShop.getStock(this.getSave()));
    }
    renderBMWShop(){ $('#bmw-showcase').innerHTML=root.NDBMW.render(this.getSave(),this.bmwModel); }
    renderMustangShop() {
      const save=this.getSave(),offer=NDShop.mustang,car=cars.find(c=>c.id===offer.carId),owned=save.owned.includes(car.id),count=save.inventory.cases.mustang||0;
      $('#mustang-showcase').innerHTML=`<div class="tx-paper">
        <div class="tx-meta"><span>★ TEXAS · MOTORING & OPEN ROADS</span><span>СПЕЦИАЛЬНЫЙ ВЫПУСК / № 005</span></div>
        <header class="tx-masthead"><strong>The Lone Star Motor Gazette</strong><span>ПЫЛЬ НА БУМАГЕ. БЕНЗИН В КРОВИ.</span></header>
        <div class="tx-edition"><span>EST. 1964 · ДУХ БОЛЬШИХ ДОРОГ</span><span>НЕЗАВИСИМАЯ ГАЗЕТА ГАРАЖА NEON DRIFT</span><span>2005 / S197</span></div>
        <section class="tx-headline"><span class="tx-kicker">АМЕРИКАНСКАЯ ЛОШАДКА / EXTRA! EXTRA!</span><h2>Дикий нрав.<br><em>Восемь цилиндров.</em></h2><p>Ford Mustang GT — когда горизонт становится приглашением.</p><span class="tx-stamp">300 PS · V8 · REAR WHEEL DRIVE<br>AMERICAN PONY / STOCK EDITION</span></section>
        <section class="tx-lead"><button class="tx-photo" data-photo="mustang:hero" aria-label="Рассмотреть Ford Mustang GT 2005"><img src="${offer.assets.hero}" alt="Серебристый Ford Mustang GT 2005 в движении" width="1221" height="733"><span>01 / FORD MUSTANG GT · S197 · ФОТО НА ВЕСЬ ЭКРАН ↗</span></button><aside class="tx-sale"><span class="tx-kicker">ОБЪЯВЛЕНИЯ / ТВОЙ СЛЕДУЮЩИЙ ГАРАЖ</span><h3>Один Mustang.<br>Тысяча дорог.</h3><p>Длинный капот, короткая корма и V8 под правой ногой. Забирай ключи от GT 2005 года и выбирай свою линию.</p><span class="tx-price">₡ ${n(car.price)}</span><button class="tx-button" data-exclusive-car="${car.id}" ${!owned&&save.credits<car.price?'disabled':''}>${owned?'Выбрать Mustang':'Приобрести Mustang'}</button><button class="tx-button tx-outline" data-car-card="${car.id}">Карточка автомобиля ↗</button><div class="tx-note">ЗАВОДСКОЙ ХАРАКТЕР<br>Фиксированная сборка.<br>Без тюнинга и замены двигателя.</div></aside></section>
        <div class="tx-specs"><div><b>300 PS</b><span>МОЩНОСТЬ V8</span></div><div><b>434 Н·м</b><span>КРУТЯЩИЙ МОМЕНТ</span></div><div><b>5,2 с</b><span>0–100 КМ/Ч</span></div><div><b>1570 кг</b><span>МАССА / FR</span></div></div>
        <section class="tx-story"><article><span class="tx-kicker">01 / ВОЗВРАЩЕНИЕ ЛЕГЕНДЫ</span><h3>Будущее с лицом<br>шестидесятых.</h3><p class="tx-drop">В 2005 году Mustang начал новую главу. Поколение S197 получило новый кузов и шасси, а его силуэт вернул узнаваемые мотивы ранних Mustang: длинный нос, короткую корму и решётку с бегущей лошадью.</p><p>Это ретро, которому не нужен музей. На страницах нашей техасской газеты ему достались пыль, солнце и открытая дорога.</p></article><article><span class="tx-kicker">02 / ИЗ МОТОРНОГО ЦЕХА</span><h3>Большое сердце.<br>Простой рецепт.</h3><p>В GT работает атмосферный 4,6-литровый Modular V8: алюминиевый блок, один распредвал на каждую головку и три клапана на цилиндр — всего 24.</p><p>Пятиступенчатая механика и задний привод дополняют характер pony car. Никакой турбины: только тяга восьми цилиндров и длинный разгон под басовитый голос выхлопа.</p></article><article><span class="tx-kicker">03 / ЗАМЕТКИ РЕДАКТОРА</span><h3>Не отпускай<br>поводья.</h3><p>У GT этого поколения сохранился неразрезной задний мост. Его новая трёхрычажная подвеска с тягой Панара стала частью характера S197.</p><p>В игре это тяжёлый заднеприводный автомобиль. Заходи в поворот с запасом, береги скорость и открывай газ плавно.</p><div class="tx-note">ТЕХПАСПОРТ ГАРАЖА<br>4.6L Modular 3V · ≈205 кг<br>245 км/ч — справочная скорость<br>300 PS / 1570 кг — данные сборки</div></article></section>
        <section class="tx-case"><div class="tx-case-art"><span class="tx-kicker">★ AMERICAN PONY ★</span><img src="${offer.assets.closed}" alt="Кейс American Pony с кремовыми полосами и латунными замками" loading="lazy"><span class="tx-kicker">ПРИБЫЛО С УТРЕННЕЙ ПОЧТОЙ</span></div><div><span class="tx-kicker">ОБЪЯВЛЕНИЕ / КОЛЛЕКЦИОННЫЙ КЕЙС</span><h3>Удача любит<br>смелых, партнёр.</h3><p>От одной до трёх наград: детали для гаража, монеты или ключи от Mustang GT.</p><div class="tx-odds"><span><b>80%</b>Синие детали</span><span><b>10%</b>Жёлтые детали</span><span><b>9%</b>Монеты</span><span><b>1%</b>Mustang GT</span></div><small>Базовые шансы на каждую награду вне гаранта. Монеты: 500–2000 с шагом 100. Повтор машины заменяется случайной красной деталью.</small><span class="tx-price">₡ ${n(offer.casePrice)}</span><button class="tx-button" data-action="buy-case" data-case="mustang" ${save.credits<offer.casePrice||count>=99999?'disabled':''}>Приобрести кейс</button><button class="tx-button tx-outline" data-action="open-case" data-case="mustang" ${count?'':'disabled'}>Открыть свой кейс ×${count}</button></div></section>
        <footer class="tx-footer"><p>МАТЕРИАЛЫ РЕДАКЦИИ: <a href="https://www.mustangspecs.com/2005-ford-mustang/" target="_blank" rel="noopener">История S197 ↗</a> · <a href="https://www.mustangspecs.com/2005-ford-mustang-gt/" target="_blank" rel="noopener">Mustang GT 2005 и фото ↗</a></p><p>Характеристики сборки — по вашему техпаспорту. Техасская газета — художественное оформление. Цена — игровой баланс.</p><p>★ END OF EDITION · KEEP THE DUST, CHASE THE HORIZON ★</p></footer>
      </div>`;
    }
    renderItalyShop() {
      const save=this.getSave(),offer=NDShop.italy,id=offer.carIds.includes(this.italyModel)?this.italyModel:offer.carId,car=cars.find(c=>c.id===id),owned=save.owned.includes(id),count=save.inventory.cases.italy||0;
      const stories={
        'fiat-coupe':{brand:'FIAT',title:'Coupé',trim:'20V Turbo',motto:'Смелость быть другим.',role:'ПРЯМЫЕ / ХАЙВЕЙ',seconds:'6,3',heading:'Пять цилиндров. Ни одной случайной линии.',text:'Fiat Coupé появился на автосалоне в Брюсселе в 1993 году. Команда Centro Stile под руководством Криса Бэнгла создала кузов с резкими прорезями над колёсами; Pininfarina отвечала за интерьер и сборку. Цветная полоса на панели приборов продолжала цвет кузова внутри салона.',extra:'В 1996 году семейство получило пятицилиндровый 20-клапанный мотор. Турбоверсия выдавала 220 л.с. и развивала заявленные 250 км/ч. В игре её характер раскрывается на длинной прямой: передний привод и ровная тяга под наддувом.',caption:'Fiat Coupé 20V Turbo · фотографии из коллекции'},
        'alfa-155':{brand:'ALFA ROMEO',title:'155 Q4',trim:'2.0 Turbo · Integrale',motto:'Темперамент под контролем.',role:'КОЛЬЦО / ЗАТЯЖНЫЕ ПОВОРОТЫ',seconds:'7,0',heading:'Строгий силуэт. Полный привод.',text:'155 Q4 соединяет угловатый кузов итальянского седана с двухлитровым турбомотором и полным приводом. Здесь выразительность — в деталях: узкий щиток решётки, низкая посадка и прямая линия плеча.',extra:'В этой коллекции Q4 занимает место уверенного универсала: 190 PS, четыре ведущих колеса и запас тяги на выходе из дуги. Настраивай подвеску, шины и мощность, сохраняя штатный AR 67203.',caption:'Alfa Romeo 155 · фотографии семейства, комплектации могут отличаться'},
        'alfa-gtv':{brand:'ALFA ROMEO',title:'GTV',trim:'3.0 V6 24V · Busso',motto:'Сначала слушаешь. Потом влюбляешься.',role:'ЗВУК / СКОРОСТНЫЕ ДУГИ',seconds:'6,7',heading:'Шесть цилиндров с итальянским акцентом.',text:'Низкий клиновидный кузов, четыре круглых глаза под общим капотом и короткая корма. GTV превращает обычную поездку в повод выбрать длинную дорогу. В центре внимания этой версии — трёхлитровый V6 Busso с 24 клапанами.',extra:'220 PS передаются на передние колёса. В игре GTV любит плавные скоростные дуги, а отдельный синтезированный профиль V6 подчёркивает её характер. Штатный мотор остаётся на месте; тюнинг доступен.',caption:'Alfa Romeo GTV · включая референс Cup; игровая версия — 3.0 V6 24V'},
        'delta-evo2':{brand:'LANCIA',title:'Delta',trim:'HF Integrale · Evoluzione II',motto:'Компактная форма. Большие амбиции.',role:'РАЗГОН / УЗКИЕ ШПИЛЬКИ',seconds:'5,7',heading:'Каждый поворот — приглашение.',text:'Расширенные крылья, высокая крыша и почти вертикальная корма: Delta сохраняет практичный силуэт хэтчбека, но выглядит готовой к старту. В Evoluzione II двухлитровая турбочетвёрка работает вместе с полным приводом.',extra:'По заданным характеристикам коллекции — 215 PS и 1340 кг. Её территория в игре — тесные шпильки и короткие разгоны между поворотами. Детали позволяют развивать сборку вокруг штатного 835A8.046.',caption:'Lancia Delta · референсы Evo I и Evo II; игровая версия — Evoluzione II'}
      },d=stories[id],photo=(i,cls)=>`<button class="it-photo ${cls}" data-italy-photo="${id}:${i}" aria-label="Рассмотреть ${esc(car.name)}, фото ${i+1}"><img src="${offer.photos[id][i]}" alt="${esc(d.caption)}" ${i?'loading="lazy"':''}><span>GALLERIA / 0${i+1} ↗</span></button>`;
      $('#italy-showcase').innerHTML=`<div class="it-salone">
        <header class="it-header"><span class="it-wordmark">salone<span>ITALIANO</span></span><span class="it-header-note">COLLEZIONE NOVANTA<br>И вам привет из Италии</span><i class="it-tricolore" aria-label="Итальянский триколор"></i></header>
        <div class="it-welcome"><span>QUATTRO AUTOMOBILI. UNA PASSIONE.</span><p>Четыре характера.<br><em>Одна страсть.</em></p><small>FIAT · ALFA ROMEO · LANCIA</small></div>
        <div class="it-models" role="group" aria-label="Выберите автомобиль">${offer.carIds.map((key,i)=>`<button data-italy-model="${key}" aria-pressed="${key===id}"><small>0${i+1} / ${stories[key].brand}</small><strong>${stories[key].title}</strong><span>${stories[key].trim}</span></button>`).join('')}</div>
        <section class="it-display" aria-label="${esc(car.name)}"><div class="it-display-copy"><span class="it-kicker">${d.brand} / COLLEZIONE PRIVATA</span><h2>${d.title}<em>${d.trim}</em></h2><p>${d.motto}</p><div class="it-purchase"><strong>₡ ${n(car.price)}</strong><button class="it-button" data-exclusive-car="${id}" ${!owned&&save.credits<car.price?'disabled':''}>${owned?'Выбрать из гаража':'Приобрести автомобиль'} ↗</button><button class="it-link" data-car-card="${id}">Карточка автомобиля →</button></div></div>${photo(0,'it-main-photo')}</section>
        <div class="it-specs"><div><small>МОЩНОСТЬ</small><strong>${car.stockPowerHp}<i>PS</i></strong></div><div><small>МАССА</small><strong>${car.weightKg}<i>кг</i></strong></div><div><small>0 — 100 КМ/Ч</small><strong>${d.seconds}<i>с</i></strong></div><div><small>ПРИВОД</small><strong>${car.drivetrain==='AWD'?'4WD':car.drivetrain}</strong></div></div>
        <section class="it-editorial">${photo(1,'it-detail-photo')}<div><span class="it-kicker">IL CARATTERE / ${d.role}</span><h3>${d.heading}</h3><p>${d.text}</p><p>${d.extra}</p><details><summary>Технический паспорт <span>＋</span></summary><dl><dt>Двигатель</dt><dd>${car.stockEngineLabel}</dd><dt>Масса двигателя</dt><dd>${engines.find(e=>e.id===car.stockEngineId).weightKg} кг</dd><dt>Тюнинг</dt><dd>Доступен</dd><dt>Замена мотора</dt><dd>Недоступна</dd></dl><small>Игровые характеристики — по материалам коллекции. Фотографии показывают семейство модели и могут отличаться комплектацией.</small></details></div></section>
        <section class="it-case"><div class="it-case-visual"><span class="it-kicker">REPARTO CORSE / COLLECTION CASE</span><img src="${offer.assets.closed}" alt="Закрытый кейс Reparto Corse" loading="lazy"><span>IL PROSSIMO CAPITOLO È TUO.</span></div><div class="it-case-copy"><span class="it-kicker">И ВАМ ПРИВЕТ ИЗ ИТАЛИИ</span><h3>Ключи от новой<br><em>истории.</em></h3><p>Один кейс. От одной до трёх наград. Четыре автомобиля коллекции с равными шансами внутри автомобильного пула.</p><div class="it-odds"><span><b>79%</b>Синие</span><span><b>10%</b>Жёлтые</span><span><b>9%</b>Монеты</span><span><b>2%</b>Машины</span></div><small>Базовые шансы на каждую награду вне гаранта. По 0,5% на каждую машину. Монеты: 500–2000 с шагом 100. Повтор автомобиля — случайная красная деталь.</small><div class="it-case-buy"><strong>₡ 1 500</strong><button class="it-button" data-action="buy-case" data-case="italy" ${save.credits<1500||count>=99999?'disabled':''}>Приобрести кейс ↗</button></div><button class="it-button it-outline" data-action="open-case" data-case="italy" ${count?'':'disabled'}>Открыть свой кейс ×${count}</button></div></section>
        <footer class="it-footer"><span>SALONE ITALIANO / NEON DRIFT</span><details><summary>Источники и коллекция ↗</summary><p>Характеристики и вторые фотографии предоставлены пользователем. Главные фото: Classic & Sports Car, AB car pix / Retro Rides, Bozhdynsky и PCARMARKET. Цвет и комплектация фото могут отличаться. Цены автомобилей — игровой баланс.</p><a href="https://www.classicandsportscar.com/features/buyers-guide-fiat-coupe" target="_blank" rel="noopener">Classic & Sports Car · fiat-coupe</a><a href="https://forum.retro-rides.org/thread/213260/1994-alfa-romeo-cloverleaf-integrale" target="_blank" rel="noopener">AB car pix / Retro Rides · alfa-155</a><a href="https://www.bozhdynsky.com/for-sale-alfa-romeo-gtv-3-0-v6-24v-red-style/" target="_blank" rel="noopener">Bozhdynsky / GTV Red Style · alfa-gtv</a><a href="https://www.pcarmarket.com/results/1994-lancia-delta-integrale-evo2" target="_blank" rel="noopener">PCARMARKET / Dealers Collection · delta-evo2</a><a href="https://www.stellantisheritage.com/en-uk/heritage/stories/fiat-coupe" target="_blank" rel="noopener">История Fiat Coupé · Stellantis Heritage</a><a href="https://www.ruotedasogno.com/en/" target="_blank" rel="noopener">Вдохновение: итальянская галерея Ruote da Sogno</a></details><i class="it-tricolore" aria-hidden="true"></i></footer></div>`;
    }
    renderBlackbirdShop() {
      const save=this.getSave(),offer=NDShop.blackbird,car=cars.find(c=>c.id===offer.carId),owned=save.owned.includes(car.id),count=save.inventory.cases.blackbird||0;
      $('#blackbird-showcase').innerHTML=`<div class="bb-page">
        <header class="bb-header"><span>PORSCHE</span><small>NEON DRIFT / BLACKBIRD SPEC</small></header>
        <section class="bb-intro"><span class="bb-ghost" aria-hidden="true">930</span><button class="bb-hero-photo" data-photo="blackbird:hero" aria-label="Рассмотреть чёрный Porsche 930"><img src="${offer.assets.hero}" alt="Чёрный Porsche 911 Turbo 930 — студийная визуализация" width="1698" height="926"></button><div class="bb-model"><span class="bb-pill">Blackbird Spec</span><h2>911 Turbo 3.3</h2><p>Ночь принадлежит тебе.</p><div class="bb-actions"><button class="bb-button" data-exclusive-car="${car.id}" ${!owned&&save.credits<car.price?'disabled':''}>${owned?'Выбрать Blackbird':'Приобрести за ₡ '+n(car.price)}</button><button class="bb-button bb-outline" data-car-card="${car.id}">Карточка автомобиля ↗</button></div></div></section>
        <section class="bb-performance" aria-label="Характеристики Blackbird"><div><strong>300<small> PS</small></strong><p>Мощность</p></div><div><strong>3,3<small> л</small></strong><p>Оппозитная шестёрка Turbo</p></div><div><strong>1300<small> кг</small></strong><p>Масса автомобиля</p></div><div><strong>RR</strong><p>Мотор сзади. Привод задний.</p></div></section>
        <section class="bb-story"><div><span class="bb-eyebrow">ИСТОКИ TURBO</span><h3>Икона.<br>В самом чистом виде.</h3><p>Узнаваемый силуэт 911, широкие задние крылья и большое антикрыло. В 930 эти формы стали частью характера Turbo: сдержанный снаружи, требовательный к водителю и стремительный под наддувом.</p><p>Версия 3.3 получила промежуточный охладитель воздуха под увеличенным задним спойлером. Для дорожного 930 это означало 300 PS — и новое прочтение знакомого силуэта.</p></div><button class="bb-archive-photo" data-photo="blackbird:profile" aria-label="Открыть архивное фото Porsche 930"><img src="${offer.assets.profile}" alt="Архивный Porsche 911 Turbo 3.3 в бронзовом цвете" loading="lazy"><span>930 Turbo 3.3 · Архив Porsche ↗</span></button></section>
        <section class="bb-drive"><button data-photo="blackbird:purchase" aria-label="Открыть фотографию Porsche на автобане"><img src="${offer.assets.purchase}" alt="Porsche 930 Turbo 3.3 на автобане — архив Porsche" loading="lazy"></button><div><span class="bb-eyebrow">AIR-COOLED. TURBOCHARGED.</span><h3>Сердце — сзади.<br>Взгляд — вперёд.</h3><p>Type 930/60. 3,3 литра, шесть горизонтально расположенных цилиндров, воздушное охлаждение и турбонаддув. Двигатель за задней осью задаёт особый баланс классического 911.</p></div></section>
        <section class="bb-details"><h3>Blackbird в деталях.</h3><div class="bb-detail-grid"><article><span>01</span><h4>Заднемоторная компоновка.</h4><p>RR: двигатель за задней осью, ведущие колёса — задние. Сборка сохраняет штатный Type 930/60.</p></article><article><span>02</span><h4>Собственный характер.</h4><p>Устанавливай карточки деталей, меняй настройки сборки и развивай машину. Тюнинг разрешён; замена двигателя отключена.</p></article></div><details><summary>Все технические данные <span>+</span></summary><dl><div><dt>Двигатель</dt><dd>Type 930/60 · 3.3L Flat-6 Turbo</dd></div><div><dt>Охлаждение</dt><dd>Воздушное</dd></div><div><dt>Мощность</dt><dd>300 PS</dd></div><div><dt>Масса автомобиля / двигателя</dt><dd>1300 кг / ≈225 кг</dd></div><div><dt>Компоновка / привод</dt><dd>RR / задний</dd></div><div><dt>Тюнинг / свап</dt><dd>Доступен / отключён</dd></div></dl></details></section>
        <section class="bb-acquire"><div><span class="bb-eyebrow">THE BLACKBIRD CASE</span><h3>Твой следующий<br>ночной заезд.</h3><p>От одной до трёх наград. Blackbird, детали или монеты для следующей сборки.</p><div class="bb-odds"><span><b>80%</b>Синие</span><span><b>10%</b>Жёлтые</span><span><b>9%</b>Монеты</span><span><b>1%</b>Blackbird</span></div><small>Базовые шансы на награду вне гаранта. Монеты: 500–2000. Повтор автомобиля — случайная красная деталь.</small><div class="bb-case-controls"><strong>₡ ${n(offer.casePrice)}</strong><button class="bb-button" data-action="buy-case" data-case="blackbird" ${save.credits<offer.casePrice||count>=99999?'disabled':''}>Приобрести кейс</button><button class="bb-button bb-outline" data-action="open-case" data-case="blackbird" ${count?'':'disabled'}>Открыть свой ×${count}</button></div></div><img class="bb-case-art" src="${offer.assets.closed}" alt="Кейс Blackbird" loading="lazy"></section>
        <footer class="bb-footer"><span>930 / BLACKBIRD SPEC</span><details><summary>История и фотографии</summary><a href="https://www.porsche.com/stories/innovation/brief-history-of-porsche-911-turbo/" target="_blank" rel="noopener">История 911 Turbo · Porsche</a><a href="https://www.porsche.com/international/accessoriesandservice/classic/models/911-g/911-turbo/" target="_blank" rel="noopener">Архив Porsche Classic · фото и история 930</a><p>Архивные фотографии — Porsche. Студийная визуализация Blackbird создана для игры. Характеристики Blackbird Spec заданы для NEON DRIFT.</p></details></footer>
      </div>`;
    }
    renderMercedesShop() {
      const save=this.getSave(),offer=NDShop.mercedes,car=cars.find(c=>c.id===offer.carId),owned=save.owned.includes(car.id),count=save.inventory.cases.mercedes||0;
      const photos=offer.photos[car.id];
      const photo=(i,cls,label)=>`<button class="mb-image ${cls}" data-mercedes-photo="${i}" aria-label="Открыть фото: ${esc(label)}"><img src="${esc(encodeURI(photos[i]))}" alt="${esc(label)}" loading="lazy"><span>${esc(label)} <b>↗</b></span></button>`;
      $('#mercedes-showcase').innerHTML=`<div class="mb-page">
        <div class="mb-mast"><b>HOMOLOGATION / 502</b><span>STUTTGART · 1990 / W 201</span><span>TOUGE SUPPLY / SPECIAL EDITION</span></div>
        <header class="mb-cover"><div class="mb-cover-text"><span class="mb-kicker">РОЖДЁН ДЛЯ ГОНОК / СОЗДАН ДЛЯ ДОРОГ</span><h2>Эволюция<br><em>без компромиссов.</em></h2><p>Mercedes-Benz 190 E<br>2.5-16 Evolution II</p><div class="mb-cover-line"><b>W201</b><span>GROUP A<br>HOMOLOGATION</span></div></div>${photo(0,'mb-cover-image','190 E Evolution II / вид спереди')}</header>
        <div class="mb-numbers"><div><b>502</b><span>ЭКЗЕМПЛЯРА</span></div><div><b>235<small> PS</small></b><span>АТМОСФЕРНЫЙ M102</span></div><div><b>1990</b><span>ДЕБЮТ В ЖЕНЕВЕ</span></div><div><b>FR</b><span>ЗАДНИЙ ПРИВОД</span></div></div>
        <section class="mb-chapter"><div class="mb-copy"><span class="mb-kicker">01 / ОТ КОМПАКТНОГО СЕДАНА К GROUP A</span><h3>Гражданский<br>билет на старт.</h3><p>Компактный W201 появился в 1982 году. За строгим силуэтом скрывались новая подвеска и инженерные решения, благодаря которым небольшой Mercedes получил собственный характер. В спорте эта основа стала отправной точкой для серии Evolution.</p><p>Правила Group A требовали выпустить дорожную серию, прежде чем новые решения можно было применить на гоночной машине. В марте 1990 года в Женеве представили Evolution II: дорожный седан, созданный вокруг требований гоночной трассы. Всего изготовили 502 экземпляра.</p><a href="https://www.mercedes-benz.com/en/vehicles/mercedes-benz-classic/classic-cars/history-of-the-c-class-201-series/" target="_blank" rel="noopener">ИСТОРИЯ W201 / MERCEDES-BENZ ↗</a></div>${photo(1,'mb-profile','Силуэт и большое заднее антикрыло')}</section>
        <section class="mb-aero"><div class="mb-aero-title"><span class="mb-kicker">02 / AERODYNAMICS & ENGINEERING</span><h3>Каждая линия<br>работает.</h3><p>Широкие арки, передний спойлер и высокий задний аэродинамический пакет изменили силуэт 190 E. В Evolution II подвеску и тормоза приспособили к 17-дюймовым колёсам, а атмосферная 2,5-литровая четвёрка развивала 235 PS.</p></div><div class="mb-gallery">${photo(2,'mb-gallery-wide','Задняя часть / Evolution')}${photo(3,'','Колесо и расширенная арка')}${photo(4,'','Фонарь и аэродинамика')}</div></section>
        <div class="mb-build-note"><span class="mb-kicker">GARAGE / FACTORY ENGINE</span><p><strong>Твой Evolution.</strong> Штатный M102.992 остаётся на машине. Детали можно улучшать и устанавливать, замена двигателя отключена.</p><span>235 PS / 1340 КГ / FR</span></div>
        <div class="mb-products"><article><span class="mb-kicker">01 / ПРЯМАЯ ПОКУПКА</span><img class="mb-sprite" src="${esc(car.raceSprite)}" alt="Игровая модель Mercedes сверху"><h3>190 E<br>Evolution II</h3><p>M102.992 · 235 PS · 1340 КГ · FR</p><strong>₡ ${n(car.price)}</strong><button class="button full-width" data-exclusive-car="${car.id}" ${!owned&&save.credits<car.price?'disabled':''}>${owned?'ВЫБРАТЬ ИЗ ГАРАЖА':'КУПИТЬ МАШИНУ'} ${icon('arrow')}</button>${carCardLink(car)}</article><article id="shop-exclusive-mercedes" tabindex="-1"><span class="mb-kicker">02 / HOMOLOGATION CASE</span><img class="mb-case" src="${esc(offer.assets.closed)}" alt="Кейс Homologation 502"><h3>Дело № 502.</h3><div class="mb-odds"><span><b>80%</b> СИНИЕ</span><span><b>10%</b> ЖЁЛТЫЕ</span><span><b>9%</b> МОНЕТЫ</span><span><b>1%</b> EVO II</span></div><p>1–3 награды. Монеты 500–2000; повтор машины превращается в случайную красную деталь. Шансы на награду вне гаранта.</p><strong>₡ ${n(offer.casePrice)}</strong><button class="button full-width" data-action="buy-case" data-case="mercedes" ${save.credits<offer.casePrice||count>=99999?'disabled':''}>КУПИТЬ КЕЙС ${icon('arrow')}</button><button class="button button-outline full-width" data-action="open-case" data-case="mercedes" ${count?'':'disabled'}>ОТКРЫТЬ СВОЙ КЕЙС ×${count}</button></article></div><footer class="mb-footer"><span>HOMOLOGATION 502 / W201</span><span>1990 → NEON DRIFT</span></footer></div>`;
    }
    renderRoadsterShop() {
      const save=this.getSave(),offer=NDShop.roadster,car=cars.find(c=>c.id===offer.carId),owned=save.owned.includes(car.id),count=save.inventory.cases.roadster||0;
      $('#roadster-showcase').innerHTML=`
        <header class="rd-masthead"><b>SMILES PER HOUR</b><span>MAZDA ROADSTER / NA6CE / SINCE 1989</span></header>
        <div class="rd-cover"><div class="rd-cover-copy"><span class="rd-kicker">МАЛЕНЬКИЙ РОДСТЕР. БОЛЬШАЯ ЛЮБОВЬ.</span>${editionBadge(car)}<h2>Всегда<br>правильный<br><em>ответ.</em></h2><p>Больше улыбок на каждый поворот.<br>Знакомься: твоя первая Miata.</p><button class="rd-wink" data-roadster-wink aria-pressed="false" aria-label="Поднять фары Miata"><svg viewBox="0 0 160 65" aria-hidden="true"><path d="M6 58V33Q80 14 154 33V58Z"/><g class="rd-eye"><path d="M22 36V5H57V36Z"/><circle cx="39.5" cy="20" r="11"/></g><g class="rd-eye"><path d="M103 36V5H138V36Z"/><circle cx="120.5" cy="20" r="11"/></g><path class="rd-grille" d="M57 46Q80 59 103 46"/></svg><span data-roadster-wink-label>ПОДНЯТЬ ФАРЫ</span></button></div><button class="rd-photo rd-cover-photo" data-photo="roadster:hero" aria-label="Открыть фото красной Mazda Roadster"><img src="${esc(encodeURI(offer.assets.hero))}" width="735" height="488" alt="Красная Mazda Roadster NA с поднятыми фарами"><span>POP-UP HEADLIGHTS. PERMANENT SMILE. ${icon('full')}</span><i class="rd-sticker" aria-hidden="true">100%<small>DRIVING<br>HAPPINESS</small></i></button></div>
        <div class="rd-specs"><div><b>116<small> PS</small></b><span>БОЛЬШЕ ЧЕМ ЦИФРА</span></div><div><b>960<small> КГ</small></b><span>ЛЁГКОСТЬ В КАЖДОМ ПОВОРОТЕ</span></div><div><b>B6-ZE</b><span>1.6 / DOHC / 16V</span></div><div><b>FR</b><span>ДЛЯ ТВОЕГО СТИЛЯ</span></div></div>
        <div class="rd-story"><div><span class="rd-kicker">JINBA ITTAI / МАШИНА И ВОДИТЕЛЬ</span><h3>Меньше веса.<br>Больше поворотов.</h3><p>В 1989 году Mazda вернула простую идею лёгкого двухместного спорткара: открытый верх, задний привод и удовольствие от самой дороги. В основе — Jinba Ittai, единство водителя и машины.</p><p>В твоём гараже история продолжается по-своему. Оставь лёгкий B6-ZE, поставь другой мотор или собери собственный набор деталей — здесь доступны и тюнинг, и свап.</p><a href="https://www.mazda.com/en/about/history/greatcar/roadster/01/" target="_blank" rel="noopener">ИСТОРИЯ МОДЕЛИ / АРХИВ MAZDA ↗</a></div><button class="rd-photo" data-photo="roadster:purchase" aria-label="Открыть фото Mazda Roadster в профиль"><img src="${esc(encodeURI(offer.assets.purchase))}" width="735" height="543" alt="Красная Mazda MX-5 первого поколения в профиль" loading="lazy"><span>ЛАКОНИЧНО СНАРУЖИ. БЕЗГРАНИЧНО В ГАРАЖЕ. ${icon('full')}</span></button></div>
        <div class="rd-products"><article class="rd-car"><span class="rd-kicker">ТВОЙ ОТВЕТ / ПРЯМАЯ ПОКУПКА</span><div class="rd-car-art"><span aria-hidden="true">NA.</span><img src="${esc(car.raceSprite)}" alt="Игровой спрайт красной Mazda Roadster NA6CE" loading="lazy"></div>${editionBadge(car)}<h3>Mazda Roadster<br><span>NA6CE</span></h3><p>B6-ZE · 116 PS · 960 кг · FR</p><small>Тюнинг и свап доступны. Мотор B6-ZE — 120 кг; можно установить в другие машины.</small><div class="rd-price"><span>${owned?'УЖЕ В ТВОЁМ ГАРАЖЕ':'МАШИНА БЕЗ СЛУЧАЙНОСТИ'}</span><strong>₡ ${n(car.price)}</strong></div><button class="button rd-buy full-width" data-exclusive-car="${car.id}" ${!owned&&save.credits<car.price?'disabled':''}>${owned?'ВЫБРАТЬ ИЗ ГАРАЖА':'КУПИТЬ МАШИНУ'} ${icon('arrow')}</button>${carCardLink(car)}</article>
        <article class="rd-case"><span class="rd-kicker">THE SMILES PER HOUR CASE</span><h3>Удача тоже<br>любит улыбки.</h3><img class="rd-case-art" src="${esc(offer.assets.closed)}" alt="Красный кейс Smiles Per Hour" loading="lazy"><div class="rd-odds"><span><b>80%</b>СИНИЕ</span><span><b>10%</b>ЖЁЛТЫЕ</span><span><b>9%</b>МОНЕТЫ</span><span><b>1%</b>ROADSTER</span></div><p>Базовые шансы вне гаранта, на каждую награду. От 1 до 3 наград в кейсе. Монеты: 500–2 000 с шагом 100. Повтор машины заменяется случайной красной деталью.</p><div class="rd-price"><span>ОДИН КЕЙС</span><strong>₡ ${n(offer.casePrice)}</strong></div><button class="button rd-case-buy full-width" data-action="buy-case" data-case="roadster" ${save.credits<offer.casePrice||count>=99999?'disabled':''}>КУПИТЬ КЕЙС ${icon('arrow')}</button><button class="button button-outline full-width" data-action="open-case" data-case="roadster" ${count?'':'disabled'}>ОТКРЫТЬ СВОЙ КЕЙС ×${count}</button></article></div>
        <footer class="rd-footer"><strong>НА ЛЮБОЙ ВОПРОС —<br>ЕЩЁ ОДИН ПОВОРОТ.</strong><span>ALWAYS THE ANSWER.<br>MAZDA ROADSTER / NA6CE</span></footer>`;
    }
    stopReveal() {
      if(this.revealTimer!==null)clearTimeout(this.revealTimer);
      this.revealTimer=null;
    }
    cancelReveal() {
      this.stopReveal();this.reveal=null;
    }
    rewardKind(reward) {
      return reward.type==='car'||reward.duplicate&&reward.carId?'car':reward.type==='currency'?'currency':'parts';
    }
    revealReducedMotion() {
      return this.getSave().settings.reducedMotion||typeof root.matchMedia==='function'&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    rewardMarkup(reward,preview=false,paint) {
      const car=reward.type==='car'?cars.find(item=>item.id===reward.carId):null;
      const offer=car?NDShop.getCarOffer(car.id):null;
      const cardArt=car?carCardArt(car,offer,paint||this.getSave().paints[car.id]):null;
      const art=car?`<img${offer.assets.card||offer.photos?' class="custom-car-art"':''} src="${esc(encodeURI(cardArt))}" alt="${esc(car.name)}">`:`<div class="currency-reward-art"><span>₡</span><strong>${n(reward.amount)}</strong></div>`;
      const carLabel=car?(car.pityOnly?'ГАРАНТ / TOYOTA':reward.guaranteed?'ГАРАНТ / МАШИНА БАННЕРА':offer.label+' / '+(offer.carIds?n((offer.carChance||.015)*100/offer.carIds.length,3):Math.round((1-offer.blueChance-offer.currencyChance)*100))+'%'):'';
      const rarity=car?(car.pityOnly?'purple':'gold'):'purple';
      return `<article class="tuning-card special-prize rarity-${rarity} revealed"><div class="special-prize-art">${art}</div><div class="tuning-card-data"><span class="card-rarity">${car?esc(carLabel):'ДЕНЕЖНАЯ НАГРАДА'}</span>${car?editionBadge(car):''}<h3>${car?esc(car.name):'Монеты для новой сборки'}</h3><p>${car?esc(car.stockEngineLabel)+' · '+car.stockPowerHp+' PS · '+car.weightKg+' кг':'+₡ '+n(reward.amount)+' уже на твоём счёте.'}</p><small>${car?(preview?'КАРТОЧКА МАШИНЫ':'МАШИНА ДОБАВЛЕНА В ГАРАЖ / ЗАВОДСКАЯ СБОРКА'):'МОНЕТЫ УЖЕ НАЧИСЛЕНЫ'}</small></div></article>`;
    }
    renderReveal(cards,kind,caseId='street',batchCount=1,caseRewards=null) {
      this.stopReveal();
      const groups=batchCount>1?(caseRewards||Array.from({length:batchCount},(_,i)=>cards.slice(Math.floor(i*cards.length/batchCount),Math.floor((i+1)*cards.length/batchCount)))).map(group=>group.slice()):[cards.slice()];
      this.reveal={cards:cards.slice(),caseRewards:groups,caseIndex:0,index:-1,kind,caseId,batchCount,phase:kind==='case'?'sealed':'revealed'};
      $('#modal-loot').dataset.revealPhase=this.reveal.phase;
      $('#modal-loot').classList.toggle('loot-batch',false);
      $('#modal-loot').classList.toggle('loot-sequence',batchCount>1);
      $('#modal-loot').classList.toggle('s2000-opening',caseId==='s2000');
      $('#modal-loot').classList.toggle('takumi-opening',NDShop.takumi.some(offer=>offer.caseId===caseId));
      $('#loot-title').innerHTML=kind==='craft'?'Новый уровень<span>.</span>':'Твоя удача внутри<span>.</span>';
      $('#loot-reveal-grid').classList.remove('multiple');
      $('#loot-reveal-grid').classList.remove('is-batch');
      $('#loot-reveal-grid').innerHTML='';
      $('#loot-stage').hidden=kind!=='case';
      $('#loot-stage').innerHTML='';
      $('#loot-progress').innerHTML=Array.from({length:batchCount>1?batchCount:cards.length},(_,i)=>`<span aria-label="${batchCount>1?'Кейс':'Карточка'} ${i+1}">${String(i+1).padStart(2,'0')}</span>`).join('');
      $('#loot-eyebrow').textContent=kind==='craft'?'КРАФТ / 10 → 2':(NDShop.specialCases[caseId]?.label||'TOUGE TUNED')+' / ГОТОВ К ОТКРЫТИЮ';
      $('#loot-caption').textContent='Все награды уже сохранены. Можно закрыть окно в любой момент.';
      $('#loot-next').hidden=false;$('#loot-next').disabled=false;$('#loot-next').textContent='ОТКРЫТЬ КЕЙС';
      $('#modal-loot').scrollTop=0;
      if(kind==='case')this.prepareCaseReveal();else this.showNextReveal();
    }
    prepareCaseReveal() {
      const session=this.reveal;if(!session)return;
      this.stopReveal();session.index=-1;session.phase='sealed';
      const number=String(session.caseIndex+1).padStart(2,'0'),bulk=session.batchCount>1,first=bulk&&session.caseIndex===0;
      const contents=bulk?session.cards:session.caseRewards[session.caseIndex];
      const signal=contents.some(r=>this.rewardKind(r)==='car')?'car':contents.some(r=>this.rewardKind(r)==='currency')?'currency':'parts';
      const signalLabel=signal==='car'?'МАШИНА':signal==='currency'?'ВАЛЮТА':'ДЕТАЛИ',assets=NDShop.specialCases[session.caseId]?.assets||NDShop.assets;
      $('#modal-loot').dataset.revealPhase='sealed';$('#modal-loot').dataset.rewardKind=signal;
      $('#loot-title').innerHTML=first?'Десять шансов<span>.</span>':bulk?`Кейс ${number} из ${session.batchCount}<span>.</span>`:'Твоя удача внутри<span>.</span>';
      $('#loot-eyebrow').textContent=(NDShop.specialCases[session.caseId]?.label||'TOUGE TUNED')+(bulk?' / ОТКРЫВАЕМ ПО ОДНОМУ':' / ГОТОВ К ОТКРЫТИЮ');
      $('#loot-stage').hidden=false;
      $('#loot-stage').innerHTML=`<button id="loot-open-case" class="opening-case" data-action="unseal-case" aria-label="Открыть кейс${bulk?' '+(session.caseIndex+1)+' из '+session.batchCount:''}. ${bulk?'Общий сигнал':'Сигнал'}: ${signalLabel.toLowerCase()}"><img class="case-closed" src="${esc(encodeURI(assets.closed))}" alt="" aria-hidden="true"><img class="case-open" src="${esc(encodeURI(assets.open))}" alt="" aria-hidden="true"><i class="case-light" aria-hidden="true"></i>${bulk?`<b class="case-batch-count">${first?'×10':number+' / '+session.batchCount}</b>`:''}<span class="case-tap-hint">НАЖМИ НА ЯЩИК ${icon('arrow')}</span></button><p class="loot-signal"><i aria-hidden="true"></i>${bulk?'ОБЩИЙ СИГНАЛ':'СИГНАЛ'} / ${signalLabel}</p>`;
      $('#loot-reveal-grid').innerHTML='';
      $('#loot-next').hidden=false;$('#loot-next').disabled=false;$('#loot-next').textContent=bulk?'ОТКРЫТЬ КЕЙС '+number+' / '+session.batchCount:'ОТКРЫТЬ КЕЙС';
      $('#loot-caption').textContent=bulk?'Каждый кейс раскрывается отдельно. Все награды десятки уже сохранены.':'Все награды уже сохранены. Можно закрыть окно в любой момент.';
      if(bulk)[...$('#loot-progress').children].forEach((step,i)=>{step.classList.toggle('seen',i<session.caseIndex);step.classList.toggle('current',i===session.caseIndex);});
      $('#modal-loot').scrollTop=0;
      if(session.caseIndex>0)$('#loot-open-case').focus({preventScroll:true});
    }
    advanceReveal() {
      const session=this.reveal;if(!session)return;
      if(session.phase==='sealed'){
        session.phase='opening';$('#modal-loot').dataset.revealPhase='opening';
        $('#loot-open-case').disabled=true;$('#loot-next').disabled=true;$('#loot-next').textContent='ОТКРЫВАЕМ…';
        $('#loot-eyebrow').textContent=(NDShop.specialCases[session.caseId]?.label||'TOUGE TUNED')+' / ОТКРЫВАЕМ КЕЙС'+(session.batchCount>1?' '+(session.caseIndex+1)+' ИЗ '+session.batchCount:'');
        if(this.revealReducedMotion())this.showNextReveal();
        else {const caseIndex=session.caseIndex;this.revealTimer=setTimeout(()=>{if(this.reveal===session&&session.phase==='opening'&&session.caseIndex===caseIndex)this.showNextReveal();},780);}
      }else if(session.phase==='revealed'){
        if(session.batchCount>1&&session.index===session.caseRewards[session.caseIndex].length-1){
          if(session.caseIndex<session.batchCount-1){session.caseIndex++;this.prepareCaseReveal();}
          else this.showBatchReveal();
        }else this.showNextReveal();
      }
    }
    showNextReveal() {
      const session=this.reveal;if(!session||!['opening','revealed'].includes(session.phase))return;
      const contents=session.batchCount>1?session.caseRewards[session.caseIndex]:session.cards;
      if(session.index>=contents.length-1)return;
      this.stopReveal();
      const moveFocus=$('#loot-stage').contains(document.activeElement)||document.activeElement===$('#loot-next');
      session.phase='revealed';$('#modal-loot').dataset.revealPhase='revealed';
      session.index++;
      const card=contents[session.index];
      $('#modal-loot').dataset.rewardKind=this.rewardKind(card);
      if(session.kind==='case')$('#loot-title').innerHTML='Вот твоя награда<span>.</span>';
      $('#loot-stage').hidden=true;
      $('#loot-caption').textContent=card.type==='card'&&card.duplicate?(cars.find(item=>item.id===card.carId)?.name||'Машина')+' уже есть в гараже — вместо повтора выпала случайная красная деталь. Карточка сохранена в инвентаре.':'Награда уже сохранена. Можно закрыть окно без потери награды.';
      $('#loot-reveal-grid').innerHTML=card.type&&card.type!=='card'?this.rewardMarkup(card):this.cardMarkup(card.type==='card'?NDCards.getCard(card.cardId):card,0,true);
      const caseLabel=session.batchCount>1?`КЕЙС ${session.caseIndex+1} / ${session.batchCount} · `:'';
      $('#loot-eyebrow').textContent=`${caseLabel}${session.kind==='craft'?'КРАФТ':NDShop.specialCases[session.caseId]?.label||'TOUGE TUNED'} / НАГРАДА ${session.index+1} ИЗ ${contents.length}`;
      if(card.guaranteed){$('#loot-eyebrow').textContent=caseLabel+'ГАРАНТ / '+(card.pityOutcome==='banner'?'МАШИНА БАННЕРА':'TOYOTA / ВТОРОЙ ШАНС');$('#loot-caption').textContent+=(card.pityOutcome==='banner'?' Гарант 50/50: машина баннера.':' Гарант 50/50: Toyota из дополнительной тройки.')+' Счётчик этого кейса обнулён.';}
      const stepIndex=session.batchCount>1?session.caseIndex:session.index;
      [...$('#loot-progress').children].forEach((step,i)=>{step.classList.toggle('seen',i<=stepIndex);step.classList.toggle('current',i===stepIndex);});
      const last=session.index===contents.length-1;
      $('#loot-next').disabled=false;$('#loot-next').hidden=last&&session.batchCount===1;
      $('#loot-next').textContent=last&&session.batchCount>1?(session.caseIndex<session.batchCount-1?`СЛЕДУЮЩИЙ КЕЙС / ${session.caseIndex+2} ИЗ ${session.batchCount}`:'ПОКАЗАТЬ ИТОГ ДЕСЯТИ КЕЙСОВ'):`СЛЕДУЮЩАЯ КАРТОЧКА / ${session.index+2} ИЗ ${contents.length}`;
      if(moveFocus)($('#loot-next').hidden?$('#modal-loot [data-action="inventory"]'):$('#loot-next')).focus({preventScroll:true});
      $('#modal-loot').scrollTop=0;
      this.onReveal(card);
    }
    showBatchReveal() {
      const session=this.reveal;if(!session||session.phase!=='revealed'||session.batchCount<=1||session.caseIndex!==session.batchCount-1||session.index!==session.caseRewards[session.caseIndex].length-1)return;
      this.stopReveal();session.phase='summary';
      $('#modal-loot').dataset.revealPhase='summary';$('#modal-loot').classList.toggle('loot-batch',true);$('#loot-stage').hidden=true;
      $('#modal-loot').dataset.rewardKind=session.cards.some(r=>this.rewardKind(r)==='car')?'car':session.cards.some(r=>this.rewardKind(r)==='currency')?'currency':'parts';
      $('#loot-title').innerHTML='Вот твои награды<span>.</span>';
      $('#loot-eyebrow').textContent=(NDShop.specialCases[session.caseId]?.label||'TOUGE TUNED')+' / '+session.cards.length+' НАГРАД';
      const parts=session.cards.filter(r=>!r.type||r.type==='card').length,money=session.cards.reduce((sum,r)=>sum+(r.type==='currency'?r.amount:0),0),vehicles=session.cards.filter(r=>r.type==='car').length;
      $('#loot-reveal-grid').classList.add('is-batch');
      $('#loot-reveal-grid').innerHTML=`<div class="batch-summary"><span>ДЕТАЛИ <b>${parts}</b></span><span>МОНЕТЫ <b>₡ ${n(money)}</b></span><span>МАШИНЫ <b>${vehicles}</b></span></div>`+session.cards.map((reward,i)=>`<div class="batch-reward"><span class="batch-reward-label">${reward.duplicate?'ПОВТОР МАШИНЫ → КРАСНАЯ ДЕТАЛЬ':reward.guaranteed?'ГАРАНТ / '+(reward.pityOutcome==='banner'?'МАШИНА БАННЕРА':'TOYOTA'):'НАГРАДА '+String(i+1).padStart(2,'0')}</span>${reward.type&&reward.type!=='card'?this.rewardMarkup(reward):this.cardMarkup(reward.type==='card'?NDCards.getCard(reward.cardId):reward,0,true)}</div>`).join('');
      [...$('#loot-progress').children].forEach(step=>step.classList.toggle('seen',true));
      $('#loot-next').disabled=false;$('#loot-next').hidden=true;
      $('#loot-caption').textContent='Все награды из 10 кейсов уже сохранены в инвентаре.'+(session.cards.some(r=>r.duplicate)?' Повторы машин заменены красными деталями.':'');
      $('#modal-loot [data-action="close-modal"]').focus({preventScroll:true});
      $('#modal-loot').scrollTop=0;
      $('#loot-reveal-grid').scrollTop=0;
    }
    renderEngines() {
      const save=this.getSave(),carId=save.selectedCar,build=this.currentBuild();
      $('#garage-pane-engines .economy-note').hidden=build.car.tuningLocked;
      $('#garage-pane-engines .section-note').hidden=build.car.tuningLocked;
      const toolbar=$('#engine-toolbar');
      if(build.car.tuningLocked||build.car.swapLocked){toolbar.hidden=true;$('#engine-grid').innerHTML=`<div class="empty-state stock-lock"><strong>Штатный ${esc(build.engine.name)}.</strong><p>${n(build.powerHp)} PS · масса мотора ${n(build.engine.weightKg)} кг. Эта версия сохраняет штатный мотор. ${build.engine.swapAllowed!==false?'Этот двигатель доступен для свапа в другие машины.':'Этот двигатель недоступен для свапа в другие машины.'}</p></div>`;return;}
      toolbar.hidden=false;
      const available=engine=>engine.swapAllowed!==false||engine.id===build.car.stockEngineId;
      const sorters={name:(a,b)=>a.name.localeCompare(b.name,'en',{numeric:true}),'weight-asc':(a,b)=>a.weightKg-b.weightKg||a.name.localeCompare(b.name,'en',{numeric:true}),'weight-desc':(a,b)=>b.weightKg-a.weightKg||a.name.localeCompare(b.name,'en',{numeric:true}),'power-asc':(a,b)=>a.powerHp-b.powerHp||a.name.localeCompare(b.name,'en',{numeric:true}),'power-desc':(a,b)=>b.powerHp-a.powerHp||a.name.localeCompare(b.name,'en',{numeric:true})};
      const visibleEngines=engines.filter(engine=>(this.engineCompatibility==='all'||available(engine))&&(this.engineType==='all'||engineCategory(engine)===this.engineType)).sort(sorters[this.engineSort]||sorters.name);
      $('#engine-results-count').textContent=`${visibleEngines.length} / ${engines.length} МОТОРОВ`;
      $('#engine-grid').innerHTML=visibleEngines.length?visibleEngines.map(engine=>{
        const canInstall=available(engine),current=save.selectedEngines[carId]===engine.id,owned=save.ownedEngines[carId].includes(engine.id),price=getSwapPrice(carId,engine.id);
        const next=canInstall?NDCards.computeBuild(carId,save.upgrades[carId],engine.id,save.equippedCards[carId]):null,dp=next?next.powerHp-build.powerHp:0,dw=next?next.weightKg-build.weightKg:0;
        const basePower=engine.id===build.car.stockEngineId?build.car.stockPowerHp:engine.powerHp;
        const action=!canInstall?'НЕДОСТУПЕН ДЛЯ СВАПА':current?`${icon('check')} УСТАНОВЛЕН`:owned?'УСТАНОВИТЬ БЕСПЛАТНО':`КУПИТЬ / ₡ ${n(price)}`;
        const priceReference=['fixed','game'].includes(engine.priceBasis)?'₡ '+n(engine.gamePrice):String.fromCharCode(36)+n(engine.referenceUsd[0])+'–'+String.fromCharCode(36)+n(engine.referenceUsd[1]);
        const discount=price<engine.gamePrice;
        return `<article class="engine-card${current?' installed':''}"><div class="engine-card-top"><span class="eyebrow">${!canInstall?'ШТАТНЫЙ / БЕЗ СВАПА':engine.id===build.car.stockEngineId?'ШТАТНЫЙ ДЛЯ КУЗОВА':owned?'КУПЛЕН ДЛЯ КУЗОВА':'СВАП / ЛЮБОЙ КУЗОВ'}</span>${icon('settings')}</div><h3>${esc(engine.name)}</h3><div class="engine-base-specs"><span>${n(basePower)} <small>л.с. в базе</small></span><span>≈${n(engine.weightKg)} <small>кг</small></span></div><p>${esc(engine.description)}</p>${next?`<div class="engine-build-delta"><div><span>МОЩНОСТЬ С ТЮНИНГОМ</span><strong>${n(next.powerHp)} л.с. <small class="${dp>=0?'positive':'negative'}">${dp>=0?'+':''}${n(dp)}</small></strong></div><div><span>МАССА СБОРКИ</span><strong>${n(next.weightKg)} кг <small class="${dw<=0?'positive':'negative'}">${dw>=0?'+':''}${n(dw)}</small></strong></div></div>`:'<div class="engine-game-price">ДОСТУПЕН ТОЛЬКО В ШТАТНОЙ СБОРКЕ</div>'}<div class="engine-reference"><span>${engine.priceBasis==='game'?'ИГРОВАЯ ЦЕНА':engine.priceBasis==='fixed'?'ЦЕНА МОТОРА':engine.priceBasis==='offer'?'ОРИЕНТИР ПРОДАВЦА':'ОЦЕНКА ПО СЕМЕЙСТВУ'}</span><b>${priceReference}</b>${engine.sourceUrl?'<a href="'+esc(engine.sourceUrl)+'" target="_blank" rel="noopener">Источник ↗</a>':''}</div>${canInstall?`<div class="engine-game-price">${discount&&!owned?'ЦЕНА СНИЖЕНА ПОД ЭТОТ КУЗОВ':owned?'ПОВТОРНАЯ УСТАНОВКА БЕСПЛАТНА':engine.priceBasis==='fixed'?'ГОНОЧНЫЙ МОТОР ДЛЯ СВАПА':'ИГРОВАЯ ЦЕНА СО СКИДКОЙ ДЛЯ БАЛАНСА'}</div>`:''}<button class="button ${current||!canInstall?'button-outline':'button-lime'} full-width" data-engine="${engine.id}" ${current||!canInstall?'disabled':''}>${action}</button></article>`;
      }).join(''):'<div class="empty-state">Под эти фильтры моторы не найдены.</div>';
    }
    renderTracks() {
      const save=this.getSave(),query=normalizeTrackSearch(this.trackQuery.trim()),searchAll=!!query;
      $('#track-format-note').textContent=searchAll?'ПОИСК ПО ВСЕМ МАРШРУТАМ':this.trackFamily==='wangan'?'WANGAN / 3 ПОЛОСЫ / ПОПУТНЫЙ ПОТОК':this.trackFamily==='city'?'ГОРОД / 4 ГОНЩИКА / 3 КРУГА':'ТОГЕ / 4 ГОНЩИКА / СТАРТ → ФИНИШ';
      const filtered=tracks.filter(track=>{
        const inFamily=searchAll||(this.trackFamily==='wangan'?track.family==='wangan':this.trackFamily==='touge'?track.closed===false&&track.family!=='wangan':track.closed!==false);
        const searchable=normalizeTrackSearch(`${track.name} ${track.id} ${track.subtitle||''} ${track.description||''} ${trackSearchAliases[track.id]||''}`);
        return inFamily&&(!query||searchable.includes(query));
      });
      for(const button of $$('[data-track-family]')){const active=!searchAll&&button.dataset.trackFamily===this.trackFamily;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
      $('#track-grid').innerHTML=filtered.length?filtered.map(track=>{
        const course=this.trackCache[track.id],record=save.records[track.id],index=tracks.indexOf(track),open=course.closed===false;
        const {minX,minY,maxX,maxY}=course.bounds,scale=Math.min(185/(maxX-minX),84/(maxY-minY)),ox=110-(minX+maxX)/2*scale,oy=50-(minY+maxY)/2*scale;
        const coords=course.points.map(point=>({x:point.x*scale+ox,y:point.y*scale+oy}));
        const d=coords.map((point,i)=>`${i?'L':'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')+(open?'':'Z');
        const start=coords[0],finish=coords[coords.length-1],length=track.lengthMeters?`${n(track.lengthMeters/1000,2)} КМ`:(open?'СЕРПАНТИН':'НОЧНОЙ ЗАЕЗД');
        const rework=track.reworked?'<span class="track-rework-banner"><span aria-hidden="true">★</span> РЕВОРК / '+esc(track.reworkLabel||'ГОРНЫЙ ПЕРЕВАЛ')+'</span>':'';
        const mountains=track.reworked?`<g class="track-mountains" style="${track.sceneryTheme==='iroha-autumn-night'?'filter:hue-rotate(270deg) brightness(.65)':''}" stroke="none"><path d="M-8 94 40 30 74 66 109 12 166 74 195 39 233 97Z" fill="#314535"/><path d="m40 30 34 36-23-12Zm69-18 57 62-44-27Zm86 27 38 58-29-28Z" fill="#53634a"/></g>`:'';
        const viaduct=track.sceneryTheme==='usui-gorge-night'?'<g fill="none" stroke="#b7805c" stroke-width="5"><path d="M88 45h93M90 46v20m22-20v20m22-20v20m22-20v20m22-20v20"/><path d="M90 61q11-25 22 0m0 0q11-25 22 0m0 0q11-25 22 0m0 0q11-25 22 0" stroke-width="3"/></g>':'';
        return `<button class="track-card${track.reworked?' reworked'+(track.sceneryTheme==='iroha-autumn-night'?' iroha-night':track.sceneryTheme==='usui-gorge-night'?' usui-night':track.sceneryTheme==='tsuchisaka-forest-day'?' tsuchisaka-day':''):''}${save.selectedTrack===track.id?' selected':''}" data-track="${track.id}" aria-pressed="${save.selectedTrack===track.id}" aria-label="${esc(track.name)}, ${esc(track.difficulty)}${track.reworked?', РЕВОРК — '+esc(track.reworkLabel||'горный перевал'):''}">${rework}<div class="track-art" style="--track-color:${track.accent}"><span class="track-number">${String(index+1).padStart(2,'0')}</span><span class="track-badge">${esc(track.difficulty.toUpperCase())}</span><svg viewBox="0 0 220 100" aria-hidden="true">${mountains}${viaduct}<path d="${d}" stroke-width="8" stroke-opacity=".08"/><path d="${d}" stroke-width="1.6"/><circle cx="${start.x}" cy="${start.y}" r="2.5" fill="#d4ff42" stroke="none"/>${open?`<rect x="${finish.x-2}" y="${finish.y-2}" width="4" height="4" fill="#f4f5ed" stroke="none"/>`:''}</svg></div><div class="track-info"><h3>${esc(track.name)}</h3><p>${track.family==='wangan'?'WANGAN / ПОТОК':open?'ТОГЕ / СПРИНТ':'ГОРОД / 3 КРУГА'} <span>·</span> ${length}</p><span class="track-record">${record?`РЕКОРД ${timestamp(record.bestTime)}`:open?'СТАРТ → ФИНИШ':'ТВОЯ ЛИНИЯ'}</span><span class="track-selected-mark">${icon('check')}</span></div></button>`;
      }).join(''):'<div class="empty-state">Маршрут не найден. Попробуй другое название.</div>';
      const track=tracks.find(item=>item.id===save.selectedTrack);
      $('#route-summary').innerHTML=`<div><span class="eyebrow">ВЫБРАННЫЙ МАРШРУТ</span><strong>${esc(track.name)} <small>${track.family==='wangan'?'SPRINT / HIGHWAY':track.closed===false?'SPRINT / TOUGE':'CIRCUIT / NIGHT CITY'}</small></strong><p>${esc(track.description)}</p>${track.referencePhotos?`<div class="wangan-reference-strip">${track.referencePhotos.map((src,i)=>`<img src="${esc(encodeURI(src))}" alt="${esc(track.name)} — ориентир ${i+1}" loading="lazy">`).join('')}</div>`:''}</div>${track.sourceImage?`<button class="button button-outline" data-action="map">СХЕМА ТРАССЫ ${icon('arrow')}</button>`:''}`;
    }
  }
  root.NDUX={Interface};
})(globalThis);
