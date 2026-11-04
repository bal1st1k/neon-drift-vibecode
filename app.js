/*! NEON DRIFT | Made by bal1st1k */
/* NEON DRIFT — local arcade shell. No network, no dependencies. */
(() => {
  'use strict';
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const { Engine, tracks, cars, upgrades, engines, createTrack, clamp, computeBuild, getSwapPrice, getUpgradePrice } = NDCore;
  const STORAGE_KEY = 'neon-drift.garage.v1';
  const labels = Object.fromEntries(tracks.map(track => [track.id, { en: track.name.toUpperCase(), district: track.name.toUpperCase(), surface: track.family==='wangan'?'WANGAN / ПОТОК':track.closed === false ? 'ТОГЕ / СПРИНТ' : 'ГОРОД / КОЛЬЦО', condition: track.closed === false ? 'СТАРТ → ФИНИШ' : '3 КРУГА' }]));
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const number = value => Math.floor(value || 0).toLocaleString('ru-RU');
  const time = seconds => {
    if (!Number.isFinite(seconds) || seconds <= 0) return '—';
    const total = Math.floor(seconds * 1000 + .001);
    return `${String(Math.floor(total / 60000)).padStart(2, '0')}:${String(Math.floor(total / 1000) % 60).padStart(2, '0')}.${String(total % 1000).padStart(3, '0')}`;
  };
  const finite = (value, fallback = 0, max = 1e9) => Number.isFinite(Number(value)) ? clamp(Number(value), 0, max) : fallback;
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const { defaults, sanitize } = NDProgress;
  let storageAvailable = true;
  let startingRace = false;
  NDRenderer.preloadSprites(cars);
  let save;
  let migratedFromV1 = false;
  let migratedFromV2 = false;
  let backupSucceeded = false;
  try {
    const rawText = localStorage.getItem(STORAGE_KEY), rawSave = JSON.parse(rawText || 'null');
    migratedFromV1 = rawSave?.schema === 'neon-drift' && rawSave.version === 1;
    migratedFromV2 = rawSave?.schema === 'neon-drift' && rawSave.version === 2;
    save = sanitize(rawSave);
    if (migratedFromV1 || migratedFromV2) {
      try {
        const backupKey=STORAGE_KEY + (migratedFromV2 ? '.backup.v2' : '.backup');
        if (!localStorage.getItem(backupKey)) localStorage.setItem(backupKey, rawText);
        backupSucceeded = true;
      } catch (_) { /* The converted garage remains playable if backup storage is full. */ }
    }
  }
  catch (_) { save = defaults(); storageAvailable = false; }
  let toastTimer = 0;
  function toast(message, error = false) {
    const el = $('#toast');
    clearTimeout(toastTimer);
    $('span', el).textContent = message;
    el.classList.toggle('error', error);
    el.classList.add('show');
    toastTimer = setTimeout(() => { el.classList.remove('show'); $('span', el).textContent = ''; }, 3600);
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); storageAvailable = true; }
    catch (_) {
      if (storageAvailable) toast('Браузер запретил сохранение. Экспортируй прогресс в разделе «Рекорды».', true);
      storageAvailable = false;
    }
    for (const el of $$('[data-wallet]')) el.textContent = number(save.credits);
  }
  const audio = new NDAudio.AudioSystem();
  $('#setting-radio-station').innerHTML=NDRadio.stations.map(station=>`<option value="${station.id}">${station.name}</option>`).join('');
  const radio=new NDRadio.RadioPlayer({onState:renderRadioState});
  function renderRadioState({phase,station}){
    const labels={off:'Радио выключено',gesture:'Нажми «Запустить радио», чтобы начать эфир.',connecting:'Подключение к эфиру…',buffering:'Буферизация эфира…',playing:'В эфире: '+station.name,offline:'Нет интернета. Радио возобновится после подключения.',muted:'Звук выключен. Включи звук для радио.',paused:'Радио приостановлено.',error:'Не удалось подключиться. Повтори попытку или выбери другую станцию.',unsupported:'Этот браузер не поддерживает интернет-радио.'};
    $('#radio-status').textContent=labels[phase]||labels.off;$('#radio-status').dataset.state=phase;
    $('#radio-station-description').textContent=station.genre;$('#radio-source').href=station.website;
    $('#radio-retry').hidden=!['gesture','error','offline'].includes(phase);$('#radio-retry').disabled=phase==='offline';
    $('#radio-retry').textContent=phase==='gesture'?'ЗАПУСТИТЬ РАДИО':'ПОВТОРИТЬ ПОДКЛЮЧЕНИЕ';
  }
  const previewRenderer = new NDRenderer.Renderer($('#preview-canvas'), { quality: save.settings.quality });
  const raceRenderer = new NDRenderer.Renderer($('#race-canvas'), { quality: save.settings.quality });
  let demo = null, race = null, racing = false, paused = false, currentPage = 'home';
  let currentModal = null, focusBeforeModal = null, pendingImport = null;
  let lastLap = 1, lastCountdown = '', awarded = false, countdownEndAt = 0, lapTimer = 0;
  let frameTimestamp = 0, accumulator = 0, hudClock = 0, demoClock = 0;
  const keys = new Set(), touch = new Set();
  const adminKeys = new Set();
  let adminResumeRace = false, adminPreviousModal = null;
  const trackCache = Object.fromEntries(tracks.map(track => [track.id, createTrack(track.id)]));
  const garageUI = new NDUX.Interface({ getSave: () => save, trackCache, onReveal: () => audio.play('buy') });
  const autumn=new NDAutumn.Leaves($('#autumn-leaves'),$('#menu-shell'),$('#modal-backdrop'));
  function syncAutumn(){autumn.setContext({racing,modal:currentModal,reducedMotion:save.settings.reducedMotion,hidden:document.hidden});}
  function unlockAudio() { Promise.resolve(audio.unlock()).catch(() => {});if(['error','offline'].includes(radio.phase))radio.retry();else radio.unlock(); }
  function applySettings() {
    audio.setEnabled(save.settings.sound);
    audio.setVolume(save.settings.volume);
    audio.setMusicEnabled(save.settings.music&&!save.settings.radio);
    radio.configure({enabled:save.settings.radio,sound:save.settings.sound,stationId:save.settings.radioStation,volume:save.settings.radioVolume,masterVolume:save.settings.volume});
    previewRenderer.setQuality(save.settings.quality);
    raceRenderer.setQuality(save.settings.quality);
    document.body.classList.toggle('reduce-motion', save.settings.reducedMotion);
    $('#sound-button use').setAttribute('href', save.settings.sound ? '#i-volume' : '#i-muted');
    $('#sound-button').setAttribute('aria-label', save.settings.sound ? 'Выключить звук' : 'Включить звук');
    $('#setting-sound').checked = save.settings.sound;
    $('#setting-music').checked = save.settings.music;
    $('#setting-radio').checked=save.settings.radio;
    $('#setting-radio-station').value=save.settings.radioStation;
    $('#setting-radio-volume').value=String(Math.round(save.settings.radioVolume*100));
    $('#setting-radio-volume').disabled=!save.settings.radio;
    $('#radio-volume-label').textContent=String(Math.round(save.settings.radioVolume*100))+'%';
    $('#setting-motion').checked = save.settings.reducedMotion;
    $('#setting-volume').value = String(Math.round(save.settings.volume * 100));
    $('#volume-label').textContent = `${Math.round(save.settings.volume * 100)}%`;
    $('#pause-volume').value = String(Math.round(save.settings.volume * 100));
    $('#pause-volume-label').textContent = `${Math.round(save.settings.volume * 100)}%`;
    $('#setting-quality').value = save.settings.quality;
    syncAutumn();
  }

  function renderTracks() { garageUI.renderTracks(); }
  function renderGarage() { garageUI.renderGarage(); }
  function renderRecords() {
    const career = save.career;
    $('#career-stats').innerHTML = [['ЗАВЕРШЕНО ЗАЕЗДОВ',number(career.races)],['ПОБЕД',number(career.wins)],['ОЧКОВ ДРИФТА',number(career.totalDrift)],['ЗАРАБОТАНО КРЕДИТОВ',`<small>₡</small> ${number(career.totalCredits)}`]].map(([label,value]) => `<div class="career-stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
    const completed = tracks.filter(track => save.records[track.id]);
    $('#records-list').innerHTML = completed.length ? completed.map((track,index) => {
      const record = save.records[track.id];
      const car = cars.find(item => item.id === record.carId);
      return `<div class="record-row"><div class="record-route"><span>${String(index + 1).padStart(2,'0')}</span><div><b>${track.name}</b><small>${car ? car.name : 'МАШИНА ИЗ ПРОШЛОГО ЗАЕЗДА'}</small></div></div><div class="record-time"><span>ВРЕМЯ ЗАЕЗДА</span><b>${time(record.bestTime)}</b></div><div class="record-time"><span>${track.closed === false ? 'ЛУЧШИЙ ДРИФТ' : 'ЛУЧШИЙ КРУГ'}</span><b>${track.closed === false ? number(record.bestDrift) : time(record.bestLap)}</b></div><button class="button button-outline" data-race-track="${track.id}">НА СТАРТ ${icon('arrow')}</button></div>`;
    }).join('') + `<div class="records-next">${completed.length} из ${tracks.length} маршрутов в архиве. <button class="text-button" data-nav="home">ВЫБРАТЬ СЛЕДУЮЩИЙ МАРШРУТ ${icon('arrow')}</button></div>` : `<div class="records-empty"><strong>Здесь появится твой первый рекорд.</strong><p>Выбери маршрут и заверши заезд — время, лучший круг и машина сохранятся здесь.</p><button class="button button-lime" data-nav="home">ВЫБРАТЬ МАРШРУТ ${icon('arrow')}</button></div>`;
  }
  function updateReady() {
    $('#ready-car-name').textContent = cars.find(car=>car.id===save.selectedCar).name;
    for (const el of $$('[data-wallet]')) el.textContent = number(save.credits);
  }
  function refreshMenus() { renderTracks(); renderGarage(); renderRecords(); garageUI.renderShop(); updateReady(); }
  function refreshDemo() {
    demo = new Engine({ trackId: save.selectedTrack, carId: save.selectedCar, upgrades: save.upgrades[save.selectedCar], engineId: save.selectedEngines[save.selectedCar], cards: save.equippedCards[save.selectedCar], seed: 19 });
    // Move the live preview onto the course before revealing the camera.
    for (let index = 0; index < 390; index++) demo.update(1 / 60, demo.getAutopilotInput());
    const index = tracks.findIndex(track=>track.id===save.selectedTrack);
    $('#preview-district').textContent = `${String(index + 1).padStart(2,'0')} / ${labels[save.selectedTrack].district}`;
    $('#preview-track-name').textContent = labels[save.selectedTrack].en;
    demoClock = 0;
    previewRenderer.render(demo, 0, { attract: true, reducedMotion: save.settings.reducedMotion });
  }
  function navigate(page) {
    if (!['home','garage','records','shop'].includes(page)) return;
    currentPage = page;
    for (const view of $$('.page')) { view.hidden = view.id !== `view-${page}`; view.classList.toggle('active',!view.hidden); }
    for (const button of $$('.rail-button[data-nav]')) { const active = button.dataset.nav === page; button.classList.toggle('active',active); if (active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current'); }
    if (page === 'garage') renderGarage();
    if (page === 'records') renderRecords();
    if (page === 'shop') garageUI.renderShop();
    window.scrollTo({top:0,behavior:'instant'});
    if (page === 'home') requestAnimationFrame(()=>previewRenderer.resize());
    syncAutumn();
  }

  function openModal(name) {
    if (!currentModal) focusBeforeModal = document.activeElement;
    currentModal = name;
    for (const modal of $$('.modal')) modal.hidden = modal.id !== `modal-${name}`;
    $('#modal-backdrop').hidden = false;
    $('#menu-shell').inert = true;
    $('#race-screen').inert = true;
    document.body.style.overflow = 'hidden';
    const modal = $(`#modal-${name}`);
    const first = $('button:not(:disabled),input,select',modal);
    if (first) first.focus({preventScroll:true});
    syncAutumn();
  }
  function closeModal(restoreFocus = true) {
    if (currentModal === 'loot') garageUI.cancelReveal();
    currentModal = null;
    $('#modal-backdrop').hidden = true;
    $('#menu-shell').inert = false;
    $('#race-screen').inert = false;
    for (const modal of $$('.modal')) modal.hidden = true;
    document.body.style.overflow = racing ? 'hidden' : '';
    pendingImport = null;
    if (restoreFocus && focusBeforeModal && document.contains(focusBeforeModal) && !focusBeforeModal.closest('[hidden]')) focusBeforeModal.focus({preventScroll:true});
    focusBeforeModal = null;
    syncAutumn();
  }
  function renderAdmin(message = '') {
    $('#admin-status').textContent = `${message ? message + ' · ' : ''}₡ ${number(save.credits)} · Машины ${save.owned.length}/${cars.length} · Кейсы ${number(save.inventory.cases.street)}`;
    $('[data-admin="repair"]').disabled = !racing || race?.state === 'finished';
  }
  function closeAdmin() {
    if (adminPreviousModal) openModal(adminPreviousModal); else closeModal();
    if (adminResumeRace) { paused = false; accumulator = 0; clearControls(); unlockAudio(); }
    adminResumeRace = false; adminPreviousModal = null;
  }
  function toggleAdmin() {
    if (currentModal === 'admin') { closeAdmin(); return; }
    adminPreviousModal = currentModal;
    adminResumeRace = racing && !paused && race?.state !== 'finished';
    if (adminResumeRace) { paused = true; clearControls(); audio.update(null,0); }
    renderAdmin(); openModal('admin');
  }
  function applyAdmin(action) {
    let message = '';
    if (action === 'credits' || action === 'cases') {
      const maximum = action === 'credits' ? 1e9 : 99999;
      const input = $(`#admin-${action}`), amount = Math.floor(Number(input.value));
      if (!Number.isFinite(amount) || amount < 1 || amount > maximum) {
        renderAdmin('Введи целое число от 1 до ' + number(maximum)); input.focus(); return;
      }
      if (action === 'credits') save.credits = Math.min(1e9,save.credits+amount);
      else save.inventory.cases.street = Math.min(99999,save.inventory.cases.street+amount);
      message = action === 'credits' ? 'Кредиты начислены' : 'Кейсы добавлены';
    } else if (action === 'cars') { save.owned = cars.map(car=>car.id); message = 'Все машины открыты'; }
    else if (action === 'engines') {
      for (const car of cars) save.ownedEngines[car.id] = car.tuningLocked ? [car.stockEngineId] : engines.filter(engine=>engine.swapAllowed!==false||engine.id===car.stockEngineId).map(engine=>engine.id);
      message = 'Все моторы открыты';
    } else if (['blue','yellow','red'].includes(action)) {
      for (const card of NDCards.cards.filter(card=>card.rarity===action)) save.inventory.cards[card.id] = Math.min(99999,(save.inventory.cards[card.id]||0)+10);
      message = 'Добавлено по 10 карточек выбранной редкости';
    } else if (action === 'repair' && racing && race?.state !== 'finished') {
      race.player.integrity = 1; race.player.nitro = 1; updateHUD(); message = 'Машина восстановлена';
    } else return;
    persist(); refreshMenus(); renderAdmin(message); audio.play('buy');
  }
  function clearControls() {
    keys.clear(); touch.clear();
    for (const el of $$('[data-control]')) el.classList.remove('held');
  }
  function getInput() {
    const held = (...codes) => codes.some(code=>keys.has(code));
    return {
      throttle: held('KeyW','ArrowUp') || touch.has('throttle'), brake: held('KeyS','ArrowDown') || touch.has('brake'),
      left: held('KeyA','ArrowLeft') || touch.has('left'), right: held('KeyD','ArrowRight') || touch.has('right'),
      drift: held('Space') || touch.has('drift'), boost: held('ShiftLeft','ShiftRight') || touch.has('boost')
    };
  }
  async function startRace(trackId = save.selectedTrack) {
    if (startingRace) return;
    startingRace = true;
    unlockAudio();
    let nextRace;
    try {
      nextRace = new Engine({ trackId, carId: save.selectedCar, upgrades: save.upgrades[save.selectedCar], engineId: save.selectedEngines[save.selectedCar], cards: save.equippedCards[save.selectedCar], seed: Math.floor(Math.random() * 1e7) + 1 });
      const sprites = await NDRenderer.preloadSprites([nextRace.player, ...nextRace.rivals, ...(nextRace.traffic||[])]);
      if (sprites.length !== 4+(nextRace.traffic?.length||0) || sprites.some(sprite => sprite.status !== 'ready')) {
        toast('Не загрузились 2D-машины. Проверь папку assets/cars и обнови страницу.',true);
        return;
      }
    } finally { startingRace = false; }
    closeModal(false);
    save.selectedTrack = trackId;
    persist();
    race = nextRace;
    racing = true; paused = false; awarded = false; accumulator = 0; hudClock = 1; lastLap = 1; lastCountdown = ''; countdownEndAt = 0;
    clearControls();
    $('#menu-shell').hidden = true;
    $('#race-screen').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#race-track-label').textContent = labels[trackId].district;
    $('#countdown').hidden = false;
    $('#lap-notice').classList.remove('show');
    raceRenderer.resize();
    raceRenderer.render(race, 0, { reducedMotion: save.settings.reducedMotion });
    updateHUD();
    audio.play('start');
    $('#pause-race').focus({preventScroll:true});
    syncAutumn();
  }
  function pauseRace() {
    if (!racing || paused || race.state === 'finished') return;
    paused = true; clearControls(); audio.update(null, 0);
    openModal('pause');
  }
  function resumeRace() {
    if (!racing) return;
    closeModal(false); paused = false; accumulator = 0; clearControls(); unlockAudio();
    $('#pause-race').focus({preventScroll:true});
  }
  function exitRace() {
    closeModal(false); racing = false; paused = false; race = null; clearControls();
    $('#race-screen').hidden = true;
    $('#menu-shell').hidden = false;
    document.body.style.overflow = '';
    audio.update(null, .05);
    refreshMenus(); navigate('home'); refreshDemo();
    $('#start-race').focus({preventScroll:true});
  }
  const hud = Object.fromEntries(['position','time','lap','progress','speed','nitro','integrity','best','combo','drift'].map(key=>[key,$(`#hud-${key}`)]));
  function updateHUD() {
    if (!race) return;
    const data = race.getHUD();
    hud.position.textContent = String(data.position).padStart(2,'0');
    hud.time.textContent = data.time > 0 ? time(data.time) : '00:00.000';
    const sprint = race.track.closed === false;
    $('#hud-format').textContent = sprint ? 'МАРШРУТ' : 'КРУГ';
    hud.lap.textContent = sprint ? Math.min(100,Math.round(data.progress*100)) : Math.min(data.lap,data.totalLaps);
    $('#hud-lap-total').textContent = sprint ? '%' : '/ ' + data.totalLaps;
    $('#hud-best-label').textContent = sprint ? 'ЛИЧНЫЙ РЕКОРД' : 'ЛУЧШИЙ КРУГ';
    hud.progress.style.width = `${clamp(data.progress,0,1)*100}%`;
    hud.speed.textContent = String(Math.max(0,Math.round(data.speed))).padStart(3,'0');
    hud.nitro.style.width = `${clamp(data.nitro,0,1)*100}%`;
    hud.integrity.style.width = `${clamp(data.integrity,0,1)*100}%`;
    hud.best.textContent = time(sprint ? save.records[race.track.id]?.bestTime : data.bestLap);
    hud.combo.textContent = `×${Number(data.combo || 1).toFixed(1)}`;
    hud.drift.textContent = number(data.driftScore);
    $('#drift-feedback').classList.toggle('active',race.player.drifting);
    NDRenderer.drawMiniMap($('#minimap-canvas'),race.track,race.player,race.rivals);
    if (data.lap > lastLap && data.state !== 'finished') {
      lastLap = data.lap;
      $('#lap-notice').textContent = data.lap === 3 ? 'ПОСЛЕДНИЙ КРУГ / ДАЙ ВСЁ' : `КРУГ ${data.lap} / ${time(race.lapTimes[data.lap - 2])}`;
      $('#lap-notice').classList.add('show');
      clearTimeout(lapTimer); lapTimer = setTimeout(()=>$('#lap-notice').classList.remove('show'),2800);
      audio.play('lap');
    }
    const countdown = $('#countdown');
    if (data.state === 'countdown') {
      const value = String(Math.max(1,Math.ceil(data.countdown)));
      countdown.hidden = false;
      if (lastCountdown !== value) {
        $('b',countdown).textContent = value; $('span',countdown).textContent = 'ГОТОВ К СТАРТУ?';
        countdown.classList.remove('bump'); void countdown.offsetWidth; countdown.classList.add('bump');
        audio.play('countdown'); lastCountdown = value;
      }
    } else if (data.state === 'running' && !countdownEndAt) {
      $('b',countdown).textContent = 'GO'; $('span',countdown).textContent = 'ГОРОД ТВОЙ';
      countdown.classList.remove('bump'); void countdown.offsetWidth; countdown.classList.add('bump');
      countdownEndAt = performance.now() + 850; audio.play('go');
    } else if (countdownEndAt && performance.now() >= countdownEndAt) countdown.hidden = true;
  }
  function finishRace() {
    if (awarded || !race || !race.result) return;
    awarded = true; clearControls();
    const result = race.result, old = save.records[race.track.id], isRecord = !old || result.time < old.bestTime;
    const credits = Math.max(0,Math.floor(finite(result.credits,1000,20000)));
    save.credits += credits; save.career.races++; save.career.wins += result.position === 1 ? 1 : 0;
    save.career.totalDrift += Math.floor(result.driftScore); save.career.totalCredits += credits;
    save.records[race.track.id] = {
      bestTime: isRecord ? result.time : old.bestTime, bestLap: Math.min(old?.bestLap || Infinity,result.bestLap || Infinity),
      bestPosition: Math.min(old?.bestPosition || 4,result.position), bestDrift: Math.max(old?.bestDrift || 0,result.driftScore),
      carId: isRecord ? save.selectedCar : old.carId, races: (old?.races || 0)+1
    };
    NDLoot.awardCase(save);
    NDShop.ensureStock(save);
    persist();
    $('#result-eyebrow').textContent = result.position === 1 ? 'ЭТА НОЧЬ ПРИНАДЛЕЖИТ ТЕБЕ' : 'ЕЩЁ ОДНА НОЧЬ. ЕЩЁ ОДНА ИСТОРИЯ.';
    $('#result-medal').textContent = String(result.position).padStart(2,'0');
    $('#result-time').textContent = time(result.time);
    $('#new-record').hidden = !isRecord;
    $('#result-position').textContent = `${result.position} / 4`;
    $('#result-lap-label').textContent = race.track.closed === false ? 'МОЩНОСТЬ / МАССА' : 'ЛУЧШИЙ КРУГ';
    $('#result-lap').textContent = race.track.closed === false ? `${Math.round(race.build.hpPerTonne)} л.с./т` : time(result.bestLap);
    $('#result-drift').textContent = number(result.driftScore);
    $('#result-credits').textContent = `+ ₡ ${number(credits)}`;
    $('#result-laps').innerHTML = result.lapTimes.map((lap,index)=>`<span>${race.track.closed === false ? 'СТАРТ → ФИНИШ' : 'КРУГ 0' + (index+1)}<b>${time(lap)}</b></span>`).join('');
    $('#countdown').hidden = true;
    audio.play('finish'); openModal('results');
  }

  function frame(timestamp) {
    const dt = frameTimestamp ? Math.min((timestamp-frameTimestamp)/1000,.05) : 1/60;
    frameTimestamp = timestamp;
    if (!document.hidden) {
      if (racing && race) {
        if (!paused && race.state !== 'finished') {
          accumulator = Math.min(accumulator+dt,.12);
          const input = getInput();
          while (accumulator >= 1/120) { race.update(1/120,input); accumulator -= 1/120; }
        }
        raceRenderer.render(race,paused || race.state === 'finished' ? 0 : dt,{reducedMotion:save.settings.reducedMotion});
        audio.update(paused || race.state === 'finished' ? null : race,dt);
        hudClock += dt;
        if (hudClock >= .07) { updateHUD(); hudClock = 0; }
        if (race.state === 'finished' && !awarded) finishRace();
      } else {
        if (currentPage === 'home' && demo) {
          if (!save.settings.reducedMotion) demo.update(dt,demo.getAutopilotInput());
          if (demo.state === 'finished') refreshDemo();
          previewRenderer.render(demo,save.settings.reducedMotion ? 0 : dt,{attract:true,reducedMotion:save.settings.reducedMotion});
          demoClock += dt;
          if (demoClock > .2) { $('#preview-speed').textContent = String(Math.round(demo.getHUD().speed)); demoClock=0; }
        }
        audio.update(null,dt);
      }
    }
    requestAnimationFrame(frame);
  }

  document.addEventListener('click',event => {
    const button = event.target.closest('button,[data-nav]');
    if (!button || button.disabled) return;
    unlockAudio();
    if (!button.matches('[data-control]')) audio.play('click');
    if (button.dataset.shopJump && currentPage === 'shop') {
      const target = document.getElementById(button.dataset.shopJump);
      if (target && $('#view-shop').contains(target)) {
        const panel=target.closest('[data-shop-panel]');if(panel)garageUI.setShopTab(panel.dataset.shopPanel);
        target.scrollIntoView({block:'start',behavior:'instant'});
        target.focus({preventScroll:true});
      }
      return;
    }
    if (button.dataset.nav) { event.preventDefault(); navigate(button.dataset.nav); }
    if(button.hasAttribute('data-roadster-wink')){
      const up=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(up));
      button.setAttribute('aria-label',up?'Опустить фары Miata':'Поднять фары Miata');
      button.querySelector('[data-roadster-wink-label]').textContent=up?'ОПУСТИТЬ ФАРЫ':'ПОДНЯТЬ ФАРЫ';return;
    }
    if(button.dataset.carCard){
      const car=cars.find(item=>item.id===button.dataset.carCard);
      if(!car?.shopExclusive)return;
      $('#car-card-content').innerHTML=garageUI.rewardMarkup({type:'car',carId:car.id},true);
      $('#modal-car-card').dataset.carRarity=car.pityOnly?'purple':'gold';
      openModal('car-card');return;
    }
    if(button.dataset.mercedesPhoto!==undefined){
      const index=Number(button.dataset.mercedesPhoto),photos=NDShop.mercedes.photos['w201-evo2'];
      if(!Number.isInteger(index)||!photos[index])return;
      $('#photo-image').src=encodeURI(photos[index]);$('#photo-image').alt='Mercedes-Benz 190 E Evolution II';$('#photo-title').textContent='MERCEDES 190 E / HOMOLOGATION 502';openModal('photo');return;
    }
    if(button.dataset.brothersPhoto){
      const key=button.dataset.brothersPhoto,offer=NDShop.brothers;
      if(key!=='cover'&&!offer.carIds.includes(key))return;
      $('#photo-image').src=encodeURI(key==='cover'?offer.assets.hero:offer.photos[key][0]);
      $('#photo-image').alt=key==='cover'?'Lexus IS200 и IS300':cars.find(car=>car.id===key).name;
      $('#photo-title').textContent=$('#photo-image').alt+' / USDM BROTHERS';openModal('photo');return;
    }
    if(button.dataset.legendPhoto){
      const [carId,photoIndex]=button.dataset.legendPhoto.split(':');
      const car=cars.find(item=>item.id===carId), photos=NDShop.legends.photos[carId];
      if(!car||!photos||!['0','1'].includes(photoIndex))return;
      $('#photo-image').src=encodeURI(photos[Number(photoIndex)]);
      $('#photo-image').alt=car.name;
      $('#photo-title').textContent=car.name+' / LEGENDS OF THE INTERNET';
      openModal('photo');return;
    }
    if(button.dataset.bmwPhoto){
      const [id,index]=button.dataset.bmwPhoto.split(':');const photo=NDShop.bmw.photos[id]?.[Number(index)];if(!photo)return;
      $('#photo-image').src=photo;$('#photo-image').alt=cars.find(c=>c.id===id).name+' / '+(button.dataset.bmwCaption||'Фотогалерея');$('#photo-title').textContent=$('#photo-image').alt;openModal('photo');return;
    }
    if(button.dataset.italyPhoto){
      const [id,index]=button.dataset.italyPhoto.split(':');const photo=NDShop.italy.photos[id]?.[Number(index)];if(!photo)return;
      $('#photo-image').src=photo;$('#photo-image').alt=cars.find(c=>c.id===id).name;$('#photo-title').textContent=$('#photo-image').alt;openModal('photo');return;
    }
    if(button.dataset.photo){
      const [caseId,asset]=button.dataset.photo.split(':');
      const offer=NDShop.specialCases[caseId];
      if(!offer||!['hero','purchase','profile'].includes(asset))return;
      $('#photo-image').src=encodeURI(offer.assets[asset]);
      $('#photo-image').alt=(cars.find(car=>car.id===offer.carId)?.name||offer.label)+' / '+offer.label;
      $('#photo-title').textContent=$('#photo-image').alt;
      openModal('photo');return;
    }
    if (button.dataset.track) { save.selectedTrack=button.dataset.track; persist(); renderTracks(); refreshDemo(); }
    if (button.dataset.car) {
      const car=cars.find(item=>item.id===button.dataset.car);
      if (!car) return;
      if (!save.owned.includes(car.id)) {
        if(car.pityOnly){garageUI.shopTab='pity';navigate('shop');$('#pity-showcase').scrollIntoView({block:'start',behavior:'smooth'});toast('Эта Toyota доступна только на гаранте специальных кейсов.');return;}
        if (car.shopExclusive) { garageUI.shopTab=car.showcaseId==='bmw-showcase'?'bmw':car.showcaseId==='mustang-showcase'?'mustang':car.showcaseId==='italy-showcase'?'italy':car.showcaseId==='blackbird-showcase'?'blackbird':car.showcaseId==='mercedes-showcase'?'mercedes':car.showcaseId==='roadster-showcase'?'roadster':car.showcaseId==='brothers-showcase'?'brothers':car.showcaseId==='legends-showcase'?'legends':car.showcaseId==='takumi-showcase'?'akina':'shadow';navigate('shop'); $('#'+car.showcaseId).scrollIntoView({block:'start',behavior:'smooth'}); toast(car.name+' продаётся в магазине.'); return; }
        if (save.credits < car.price) { audio.play('error'); toast(`До ${car.name} ещё ₡ ${number(car.price-save.credits)}. Заработай их в заезде.`,true); return; }
        save.credits-=car.price; save.owned.push(car.id); audio.play('buy'); toast(`${car.name} теперь в твоём гараже.`);
      } else toast(`${car.name} на линии старта.`);
      save.selectedCar=car.id; persist(); renderGarage(); updateReady(); refreshDemo();
    }
    if (button.dataset.engine) {
      const engine = engines.find(item => item.id === button.dataset.engine), carId = save.selectedCar;
      if (!engine) return;
      if (cars.find(car=>car.id===carId).tuningLocked || cars.find(car=>car.id===carId).swapLocked) { toast('На этой машине замена мотора отключена.',true); return; }
      if(engine.swapAllowed===false&&engine.id!==cars.find(car=>car.id===carId).stockEngineId){toast('Этот мотор недоступен для свапа.',true);return;}
      const price = getSwapPrice(carId,engine.id), owned = save.ownedEngines[carId].includes(engine.id);
      if (!owned && save.credits < price) { audio.play('error'); toast('Не хватает ₡ ' + number(price-save.credits) + ' на этот свап.',true); return; }
      if (!owned) { save.credits -= price; save.ownedEngines[carId].push(engine.id); audio.play('buy'); }
      save.selectedEngines[carId] = engine.id; persist(); renderGarage(); updateReady(); refreshDemo();
      toast(engine.name + ' установлен. Мощность и масса сборки обновлены.');
    }
    if (button.dataset.action === 'map') {
      const track = tracks.find(item => item.id === save.selectedTrack);
      if (track?.sourceImage) { $('#map-title').textContent = track.name; $('#map-reference').src = track.sourceImage; $('#map-reference').alt = 'Схема трассы ' + track.name; openModal('map'); }
    }
    if (button.dataset.action === 'inventory') {
      if (racing) exitRace(); else if (currentModal) closeModal(false);
      garageUI.tab='inventory'; navigate('garage'); renderGarage();
    }
    if (button.dataset.action === 'buy-case') {
      const caseId=button.dataset.case||'street';
      const purchase=NDShop.purchaseCase(save,caseId);
      if(!purchase.ok){audio.play('error');toast(purchase.message,true);return;}
      persist();renderGarage();garageUI.renderShop();audio.play('buy');toast((NDShop.specialCases[caseId]?.label||'Touge Tuned')+' — кейс добавлен в инвентарь.');
    }
    if(button.dataset.exclusiveCar){
      const id=button.dataset.exclusiveCar;
      if(save.owned.includes(id)){
        save.selectedCar=id;persist();refreshMenus();refreshDemo();garageUI.tab='cars';navigate('garage');toast(cars.find(car=>car.id===id).name+' на линии старта.');
      }else{
        const purchase=NDShop.purchaseExclusiveCar(save,id);
        if(!purchase.ok){toast(purchase.message,true);return;}
        persist();refreshMenus();audio.play('buy');toast(cars.find(car=>car.id===id).name+' добавлена в гараж.');
      }
      return;
    }
    if (button.dataset.action === 'buy-s2000') {
      const purchase=NDShop.purchaseS2000(save);
      if(!purchase.ok){audio.play('error');toast(purchase.message,true);return;}
      persist();refreshMenus();audio.play('buy');toast('Honda S2000 добавлена в гараж. Заводская сборка готова к старту.');return;
    }
    if (button.dataset.action === 'select-s2000' && save.owned.includes('s2000')) {
      save.selectedCar='s2000';persist();refreshMenus();refreshDemo();garageUI.tab='cars';navigate('garage');toast('Honda S2000 на линии старта.');
    }
    if (button.dataset.buyCard) {
      const purchase=NDShop.purchaseCard(save,button.dataset.buyCard);
      if(!purchase.ok){audio.play('error');toast(purchase.message,true);garageUI.renderShop();return;}
      persist();renderGarage();garageUI.renderShop();audio.play('buy');toast(purchase.card.name+' — в инвентаре.');
    }
    if (button.dataset.action === 'open-case'||button.dataset.action==='open-ten-cases') {
      const caseId=button.dataset.case||'street';
      const bulk=button.dataset.action==='open-ten-cases';
      const drop=bulk?NDLoot.openCases(save,Math.random,caseId):NDLoot.openCase(save,Math.random,caseId);
      if(!drop.ok){toast(drop.message,true);return;}
      persist();renderGarage();garageUI.renderShop();garageUI.renderReveal(drop.rewards||drop.cards,'case',caseId,bulk?10:1,drop.caseRewards);audio.play('buy');openModal('loot');
    }
    if (button.dataset.equipCard) {
      const result=NDLoot.equipCard(save,save.selectedCar,button.dataset.equipCard);
      if(!result.ok){toast(result.message,true);return;}
      persist();renderGarage();updateReady();refreshDemo();audio.play('buy');toast(result.card.name+' установлен.');
    }
    if (button.dataset.unequipSlot) {
      const result=NDLoot.unequipCard(save,save.selectedCar,button.dataset.unequipSlot);
      if(!result.ok){toast(result.message,true);return;}
      persist();renderGarage();updateReady();refreshDemo();toast('Карточка возвращена в инвентарь.');
    }
    if (button.dataset.craft) {
      const result=NDLoot.craftCards(save,button.dataset.craft);
      if(!result.ok){toast(result.message,true);return;}
      persist();renderGarage();garageUI.renderReveal(result.cards,'craft');audio.play('buy');openModal('loot');
    }
    if (button.dataset.raceTrack) startRace(button.dataset.raceTrack);
    if (button.dataset.action === 'race') startRace();
    if (button.dataset.action === 'help') openModal('help');
    if (button.dataset.action === 'settings') openModal('settings');
    if (button.dataset.action === 'close-modal') { if (currentModal === 'admin') closeAdmin(); else closeModal(); }
    if (button.dataset.admin && currentModal === 'admin') applyAdmin(button.dataset.admin);
    if (button.dataset.action === 'sound') { save.settings.sound=!save.settings.sound; applySettings(); persist(); toast(save.settings.sound ? 'Звук включён.' : 'Звук выключен.'); }
  });
  $('.wordmark').addEventListener('click',event=>{event.preventDefault();navigate('home');});
  $('#start-race').addEventListener('click',()=>startRace());
  $('#pause-race').addEventListener('click',pauseRace);
  $('#resume-race').addEventListener('click',resumeRace);
  $('#restart-race').addEventListener('click',()=>startRace());
  $('#exit-race').addEventListener('click',exitRace);
  $('#race-again').addEventListener('click',()=>startRace());
  $('#results-home').addEventListener('click',exitRace);
  $('#modal-backdrop').addEventListener('click',event=>{
    if (event.target === $('#modal-backdrop')) {
      if (currentModal === 'admin') closeAdmin();
      else if (['settings','help','import','map','loot','photo','car-card'].includes(currentModal)) closeModal();
    }
  });
  for (const [id,key,eventName] of [['setting-sound','sound','change'],['setting-music','music','change'],['setting-radio','radio','change'],['setting-radio-station','radioStation','change'],['setting-radio-volume','radioVolume','input'],['setting-motion','reducedMotion','change'],['setting-volume','volume','input'],['pause-volume','volume','input'],['setting-quality','quality','change']]) {
    $(`#${id}`).addEventListener(eventName,event=>{
      save.settings[key] = ['volume','radioVolume'].includes(key) ? Number(event.target.value)/100 : ['quality','radioStation'].includes(key) ? event.target.value : event.target.checked;
      if(key==='radio'&&save.settings.radio){save.settings.music=false;save.settings.sound=true;}
      if(key==='music'&&save.settings.music)save.settings.radio=false;
      applySettings();unlockAudio();persist();
    });
  }
  $('#radio-retry').addEventListener('click',()=>{if(!save.settings.sound){save.settings.sound=true;applySettings();persist();}radio.retry();});
  window.addEventListener('pagehide',()=>radio.suspend());window.addEventListener('pageshow',()=>radio.resume());
  $('#fullscreen').addEventListener('click',async()=>{
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else toast('Используй F11 или режим полного экрана браузера.');
    } catch (_) { toast('Используй F11 или режим полного экрана браузера.'); }
  });
  document.addEventListener('fullscreenchange',()=>{previewRenderer.resize();raceRenderer.resize();});
  const gameKeys = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight']);
  document.addEventListener('keydown',event=>{
    if (['Numpad5','Numpad6'].includes(event.code)) {
      event.preventDefault(); adminKeys.add(event.code);
      if (!event.repeat && adminKeys.has('Numpad5') && adminKeys.has('Numpad6')) { adminKeys.clear(); toggleAdmin(); }
      return;
    }
    if (currentModal) {
      if (event.code === 'Escape') { event.preventDefault(); if(currentModal==='admin')closeAdmin(); else if(currentModal==='pause')resumeRace(); else if(['settings','help','import','map','loot','photo','car-card'].includes(currentModal))closeModal(); }
      if (event.code === 'Tab') {
        const focusables=$$('button:not(:disabled),input,select,[tabindex="0"]',$(`#modal-${currentModal}`)).filter(el=>!el.hidden);
        const first=focusables[0],last=focusables[focusables.length-1];
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
      }
      return;
    }
    if (racing) {
      if (event.code==='Escape' || event.code==='KeyP') { event.preventDefault(); if(!event.repeat)pauseRace(); return; }
      if(gameKeys.has(event.code)){event.preventDefault();keys.add(event.code);}
    }
  });
  document.addEventListener('keyup',event=>{adminKeys.delete(event.code);keys.delete(event.code);if(racing && !currentModal && gameKeys.has(event.code))event.preventDefault();});
  for(const button of $$('[data-control]')) {
    button.addEventListener('pointerdown',event=>{
      event.preventDefault();unlockAudio();
      if(!racing || paused || currentModal)return;
      touch.add(button.dataset.control);button.classList.add('held');button.setPointerCapture(event.pointerId);
    });
    const release=()=>{touch.delete(button.dataset.control);button.classList.remove('held');};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
    button.addEventListener('contextmenu',event=>event.preventDefault());
  }
  window.addEventListener('blur',()=>{adminKeys.clear();clearControls();if(racing && !paused)pauseRace();});
  document.addEventListener('visibilitychange',()=>{frameTimestamp=0;clearControls();if(document.hidden && racing && !paused)pauseRace();syncAutumn();});

  $('#export-save').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(save,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`NeonDrift-garage-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Копия гаража выгружена в файл.');
  });
  $('#import-save').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    if(file.size>200000){toast('Файл слишком большой. Нужен экспорт гаража Neon Drift.',true);return;}
    try{
      const data=JSON.parse(await file.text());
      if(data?.schema!=='neon-drift' || ![1,2,3].includes(data.version) || !Array.isArray(data.owned) || typeof data.credits!=='number')throw new Error('format');
      pendingImport=sanitize(data);openModal('import');
    }catch(_){toast('Этот файл не похож на гараж Neon Drift.',true);}
  });
  $('#confirm-import').addEventListener('click',()=>{
    if(!pendingImport)return;
    save=pendingImport;closeModal(false);applySettings();persist();refreshMenus();refreshDemo();toast('Гараж восстановлен. Город ждёт.');
  });
  // A small read-only diagnostics API makes the shipped build inspectable.
  window.NeonDrift=Object.freeze({version:'4.4.3',getState:()=>({page:currentPage,racing,paused,modal:currentModal,track:save.selectedTrack,car:save.selectedCar,credits:save.credits,storageAvailable,hud:race?.getHUD()||null})});
  applySettings();refreshMenus();refreshDemo();requestAnimationFrame(frame);
  if(migratedFromV1){persist();setTimeout(()=>toast('Гараж обновлён: машины перенесены, кредиты ×10.' + (backupSucceeded ? ' Копия старого прогресса сохранена.' : ' Экспортируй гараж для резервной копии.')),900);}
  if(migratedFromV2){persist();setTimeout(()=>toast('Гараж обновлён. Купленные детали и моторы сохранены; кейсы выдаются за финиш.'),900);}
  if(!storageAvailable)setTimeout(()=>toast('Сохранение недоступно. Используй экспорт прогресса.',true),1000);
})();
