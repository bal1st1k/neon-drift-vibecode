/*! NEON DRIFT | Made by bal1st1k */
(function (root) {
  'use strict';
  const id = 'ttrs-8j';
  const palette = root.NDCatalog.audiPaints;
  const source = 'https://www.audi.com/en/highlights-from-40-years-of-audi-sport-gmbh-15337/the-return-of-a-unique-concept-15347';
  const press = 'https://www.netcarshow.com/audi/2010-tt_rs/';
  const number = value => value.toLocaleString('ru-RU');
  const views = ['Передний ¾','Профиль','Задний ¾','Сзади','Спереди','Передний ¾ справа'];
  const photo = (paint, view = 0) => `assets/audi/${paint}-${view}.webp`;
  const rings = '<svg class="audi-rings" viewBox="0 0 100 35" aria-label="Audi"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="17" r="14"/><circle cx="39" cy="17" r="14"/><circle cx="60" cy="17" r="14"/><circle cx="81" cy="17" r="14"/></g></svg>';

  function render(save, previewPaint, view = 0) {
    const car = root.NDCore.cars.find(item => item.id === id), offer = root.NDShop.audi;
    const chosen = previewPaint || save.paints[id] || car.paint;
    const paint = Object.hasOwn(palette, chosen) ? chosen : car.paint;
    const [name] = palette[paint], owned = save.owned.includes(id), count = save.inventory.cases.audi || 0;
    const sprite = root.NDCatalog.getCarSprite(car, paint, true);
    return `
      <div class="audi-showcase">
        <header class="audi-masthead"><span>Городской спорткласс</span>${rings}<span>TT RS / 8J / 2009</span></header>
        <div class="audi-hero">
          <img src="assets/audi/hero.png" alt="Визуализация Audi TT RS 8J в цвете Misano Red Pearl" fetchpriority="high">
          <div class="audi-hero-copy"><span class="audi-kicker">AUDI SPORT · ПЕРВОЕ ПОКОЛЕНИЕ TT RS</span>
            <h2>Audi TT RS Coupé.</h2>
            <p>Пять цилиндров. 340 PS. Полный привод quattro.</p>
            <div class="audi-actions"><a class="audi-button" href="#audi-configurator">Выбрать свой TT RS</a><a class="audi-button audi-button-outline" href="#audi-case">Кейс Audi Sport</a></div>
          </div>
        </div>
        <div class="audi-stats audi-spec-strip" aria-label="Заводские характеристики">
          <div><span>Мощность</span><strong>340 <small>PS</small></strong></div>
          <div><span>Крутящий момент</span><strong>450 <small>Н·м</small></strong></div>
          <div><span>0–100 км/ч</span><strong>4,6 <small>с</small></strong></div>
        </div>

        <section class="audi-section audi-configurator" id="audi-configurator" aria-labelledby="audi-config-title">
          <div class="audi-section-heading"><span class="audi-kicker">ЦВЕТ ТВОЕГО ХАРАКТЕРА</span><h3 id="audi-config-title">Твой RS. Твой цвет.</h3><p>Шесть оттенков из палитры Audi RS. Выбранный цвет будет виден в гараже и на трассе.</p></div>
          <div class="audi-car-stage"><button type="button" data-audi-photo="car" aria-label="Увеличить Audi TT RS в выбранном цвете"><img src="${photo(paint,view)}" alt="Audi TT RS · ${name} · ${views[view]}"><span class="audi-zoom">Рассмотреть ↗</span></button></div>
          <div class="audi-view-nav" aria-label="Ракурс автомобиля"><button type="button" data-audi-step="-1" aria-label="Предыдущий ракурс">←</button><span aria-live="polite">${view+1} / ${views.length} · ${views[view]}</span><button type="button" data-audi-step="1" aria-label="Следующий ракурс">→</button></div>
          <div class="audi-views">${views.map((label,i)=>`<button type="button" data-audi-view="${i}" aria-pressed="${i===view}">${label}</button>`).join('')}</div>
          <fieldset class="audi-palette"><legend class="sr-only">Цвет кузова</legend><div>${Object.entries(palette).map(([code,[label,hex]]) =>
            `<button type="button" data-audi-paint="${code}" aria-pressed="${code===paint}" aria-label="${label} · ${code}" title="${label}"><span style="background:${hex}"></span></button>`).join('')}</div>
            <p aria-live="polite"><strong>${name}</strong><small>${paint} · ${palette[paint][1]}</small></p>
          </fieldset>
          <details class="audi-game-preview"><summary>Как машина выглядит в гонке</summary><img src="${sprite}" alt="Игровой спрайт Audi TT RS · ${name}" loading="lazy"></details>
          <div class="audi-purchase"><div><span class="audi-kicker">${owned?'В ТВОЁМ ГАРАЖЕ':'ПРЯМАЯ ПОКУПКА'}</span><strong>₡ ${number(car.price)}</strong><small>Игровая цена по заданию · исторический ориентир €55 800</small></div>
            <div class="audi-purchase-actions"><button type="button" class="audi-button" data-exclusive-car="${id}" ${!owned&&save.credits<car.price?'disabled':''}>${owned?'Выбрать из гаража':'Купить TT RS'}</button>
              <button type="button" class="audi-text-button" data-car-card="${id}">Карточка машины ↗</button></div>
          </div>
        </section>

        <section class="audi-section audi-highlights" aria-labelledby="audi-highlights-title"><span class="audi-kicker">В ДЕТАЛЯХ</span><h3 id="audi-highlights-title">Характер RS.</h3><div class="audi-highlight-grid">
          <article><button type="button" data-audi-editorial="detail"><img src="assets/audi/detail-archive.webp" alt="Архивная фотография красного Audi TT RS 8J в движении" loading="lazy"></button><h4>Узнаваем с первого взгляда.</h4><p>Компактное купе, расширенные арки и серебристые акценты RS.</p></article>
          <article><button type="button" data-audi-editorial="engine"><img src="assets/audi/engine.webp" alt="Визуализация моторного отсека пятицилиндрового 2.5 TFSI" loading="lazy"></button><h4>Пять цилиндров. Один характер.</h4><p>340 PS и особенный ритм турбированного 2.5 TFSI.</p></article>
          <article><button type="button" data-audi-editorial="motion"><img src="assets/audi/motion.webp" alt="Audi TT RS на горной дороге в вечернем свете" loading="lazy"></button><h4>Дорога зовёт.</h4><p>Полный привод quattro и 450 Н·м для следующего поворота.</p></article>
        </div></section>

        <section class="audi-section audi-engine" aria-labelledby="audi-engine-title">
          <div><span class="audi-kicker">2.5 TFSI · CEPA</span><h3 id="audi-engine-title">Пятый цилиндр.<br>Первый в памяти.</h3>
            <p>В 2009 году TT RS вернул пятицилиндровый бензиновый мотор в линейку Audi. Компактный EA855 развернули поперёк кузова, усилили блок и совместили турбонаддув с непосредственным впрыском.</p>
            <p>Характерный ритм создаёт порядок работы 1–2–4–5–3. Тяга 450 Н·м доступна уже с 1 600 об/мин, а масса самого двигателя составляет около 183 кг при длине всего 49 см.</p>
            <a href="${source}" target="_blank" rel="noopener noreferrer">История пятицилиндрового TT RS · Audi ↗</a>
          </div>
          <button type="button" class="audi-editorial-photo" data-audi-editorial="engine" aria-label="Рассмотреть моторный отсек"><img src="assets/audi/engine.webp" alt="Кинематографичная визуализация моторного отсека 2.5 TFSI" loading="lazy"><span>2.5 TFSI · ПЯТИЦИЛИНДРОВЫЙ ХАРАКТЕР ↗</span></button>
        </section>

        <section class="audi-section audi-quattro" aria-labelledby="audi-quattro-title"><div class="audi-quattro-story"><button type="button" class="audi-editorial-photo" data-audi-editorial="motion" aria-label="Увеличить кадр на горной дороге"><img src="assets/audi/motion.webp" alt="Красный TT RS на горном серпантине в закатном свете" loading="lazy"><span>TT RS COUPÉ · QUATTRO ↗</span></button><div><span class="audi-kicker">QUATTRO</span><h3 id="audi-quattro-title">Тяга на четыре.</h3><p>Для компактного TT RS инженеры выбрали схему Haldex с муфтой подключения задней оси. На старте и на выходе из поворота полный привод помогает реализовать тягу турбопятёрки.</p></div></div>
          <div class="audi-stats"><div><span>Снаряжённая масса</span><strong>1 450 <small>кг</small></strong></div><div><span>Мощность на тонну</span><strong>234 <small>PS/т</small></strong></div><div><span>Привод</span><strong>quattro</strong></div></div>
          <details class="audi-specs"><summary>Полный технический паспорт</summary><dl>
            <div><dt>Двигатель</dt><dd>CEPA · I5 DOHC 20V · 2,5 л</dd></div><div><dt>Блок цилиндров</dt><dd>CGI · чугун с вермикулярным графитом</dd></div>
            <div><dt>Наддув</dt><dd>BorgWarner K16 · 1,2 бар</dd></div><div><dt>Мощность</dt><dd>340 PS при 5 400–6 500 об/мин</dd></div>
            <div><dt>Крутящий момент</dt><dd>450 Н·м при 1 600–5 300 об/мин</dd></div><div><dt>Отсечка</dt><dd>6 800 об/мин</dd></div>
            <div><dt>0–100 км/ч</dt><dd>4,6 с</dd></div><div><dt>Максимальная скорость</dt><dd>280 км/ч · заводская опция</dd></div>
            <div><dt>Игровая сборка</dt><dd>Тюнинг доступен · штатный CEPA</dd></div></dl><p>Характеристики из задания. Максимальная скорость приведена как паспортный ориентир.</p></details>
        </section>

        <section class="audi-section audi-case" id="audi-case" aria-labelledby="audi-case-title">
          <div class="audi-case-art"><img src="${offer.assets.closed}" alt="Закрытый кейс Audi Sport RS" loading="lazy"></div>
          <div><span class="audi-kicker">КЕЙС / AUDI SPORT RS</span><h3 id="audi-case-title">Городской спорткласс.</h3><p>Одна попытка — от одной до трёх наград. TT RS, детали для сборки или монеты на следующий шаг.</p>
            <div class="audi-case-odds"><span><b>80%</b>Синие детали</span><span><b>10%</b>Жёлтые детали</span><span><b>9%</b>Монеты</span><span><b>1%</b>Audi TT RS</span></div>
            <p class="audi-fineprint">Шанс каждой награды вне гаранта. Монеты — 500–2 000 с шагом 100. Повтор машины даёт красную деталь.</p>
            <div class="audi-case-price"><span>Цена кейса</span><strong>₡ 1 500</strong></div>
            <button type="button" class="audi-button" data-action="buy-case" data-case="audi" ${save.credits<offer.casePrice?'disabled':''}>Купить кейс</button>
            <button type="button" class="audi-button audi-button-outline" data-action="open-case" data-case="audi" ${count?'':'disabled'}>Открыть свой кейс · ×${count}</button>
          </div>
        </section>
        <footer class="audi-sources"><p>Студийные ракурсы и атмосферные кадры — визуализации. Фото красного TT RS в движении — архив Audi / Autoevolution. Палитра и игровые характеристики заданы в техпаспорте проекта.</p><p><a href="${source}" target="_blank" rel="noopener noreferrer">История TT RS · Audi</a><a href="https://media.audiusa.com/releases/655" target="_blank" rel="noopener noreferrer">50 лет пятицилиндровых Audi</a><a href="https://www.autoevolution.com/cars/audi-tt-rs-coupe-2009.html" target="_blank" rel="noopener noreferrer">Архивная фотография TT RS</a><a href="${press}" target="_blank" rel="noopener noreferrer">Архив первого TT RS</a></p></footer>
      </div>`;
  }
  root.NDAudi = { render, views, photo };
})(globalThis);
