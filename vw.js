/*! NEON DRIFT | Made by bal1st1k */
(function (root) {
  'use strict';
  const { cars, engines, vwModels, vwPaints, vwPhoto, getCarSprite } = root.NDCatalog;
  const views = ['Передний ¾', 'Профиль', 'Задний ¾', 'Сзади', 'Спереди', 'Передний ¾ справа'];
  const priceSources = {
    'vw-mk2-gti': ['26 825 DM · 1987','https://www.autobild.de/klassik/artikel/sportler-der-achtziger-vw-golf-gti-16v-3770996.html'],
    'vw-rallye': ['46 500 DM · 1989','https://www.autobild.de/artikel/vw-golf-rallye-1990-gebrauchtwagen-27756625.html'],
    'vw-corrado': ['47 900 DM · модельный год 1992','https://www.corrado.com.pl/artykuly/volksporsche.htm'],
    'vw-r32': ['32 600 € · каталог ADAC','https://www.adac.de/rund-ums-fahrzeug/autokatalog/marken-modelle/vw/golf/iv/995322/'],
    'vw-mk5-gti': ['24 200 € · старт продаж 2004','https://www.autobild.de/artikel/der-preis-fuer-den-staerksten-vw-golf-47069.html']
  };
  const histories = {
    'vw-mk2-gti': {
      title:'Красная полоска, шестнадцать клапанов',
      origin:'В марте 1986 года Volkswagen запустил в серию Golf GTI 16V. Два распредвала и четыре клапана на цилиндр подняли отдачу 1,8-литрового мотора до 139 PS в версии без катализатора. В августе 1989-го GTI получил массивные бамперы. Именно этот поздний облик представлен в салоне.',
      character:'Под капотом остался атмосферный KR с механическим впрыском Bosch K-Jetronic. Пик мощности приходится на 6 100 об/мин, поэтому на разгоне этому Golf стоит дать раскрутиться.',
      angle:4, detail:'Двойные круглые фары и красная окантовка решётки.',
      source:'https://www.volkswagen-newsroom.com/en/golf-2-gti-19841991-19502'
    },
    'vw-rallye': {
      title:'Golf, которому нужен был допуск к ралли',
      origin:'Golf Rallye появился в конце восьмидесятых ради омологации. Правила группы A требовали выпустить дорожную версию тиражом не менее 5 000 экземпляров. У Rallye были расширенные арки, прямоугольные фары и полный привод.',
      character:'Механический нагнетатель G-Lader приводится от двигателя и даёт наддув уже на низких оборотах. Вместе с полным приводом Syncro это объясняет, почему Rallye заметно отличается по конструкции от переднеприводного GTI 16V.',
      angle:5, detail:'Квадратные расширители арок и прямоугольная оптика.',
      source:'https://media.vw.com/releases/1503'
    },
    'vw-corrado': {
      title:'Купе, которое выросло из Scirocco',
      origin:'Corrado задумывался как преемник Scirocco II. В итоге Volkswagen поставил его ступенью выше и поручил сборку Karmann в Оснабрюке. Компактное купе 2+2 получило большую заднюю дверь и спойлер, который на немецкой версии автоматически поднимался при 120 км/ч.',
      character:'Для 2,9-литрового VR6 пришлось переработать переднюю часть кузова. Узкий угол между рядами цилиндров позволил уместить шесть цилиндров под одной головкой, сохранив поперечную компоновку и передний привод.',
      angle:2, detail:'Низкая линия крыши и спойлер над задней дверью.',
      source:'https://www.volkswagen-newsroom.com/en/corrado-19881995-19683'
    },
    'vw-r32': {
      title:'Первый Golf с буквой R',
      origin:'В 2002 году R32 стал самым мощным Golf на тот момент. Под капотом стоял 3,2-литровый VR6 на 241 PS, тягу передавал полный привод 4Motion. Volkswagen рассчитывал выпустить 5 000 машин, но в итоге собрал 12 000.',
      character:'Шестиступенчатая механика была стандартной, а позже появилась DSG. С ней заводской разгон до 100 км/ч занял 6,4 секунды, на две десятых быстрее механики. Это время использовано в игровом техпаспорте.',
      angle:3, detail:'Два разнесённых выпускных патрубка под задним бампером.',
      source:'https://www.volkswagen-newsroom.com/en/the-volkswagen-r-models-15258/volkswagen-r-the-history-15267'
    },
    'vw-mk5-gti': {
      title:'GTI вернулся с турбиной',
      origin:'Golf V GTI вышел осенью 2004 года с двухлитровым TFSI и подвеской, заниженной на 15 мм. Красная окантовка осталась фирменной деталью, теперь вокруг решётки с сотами. В салоне вернулась клетчатая ткань спортивных кресел.',
      character:'Турбонаддув и прямой впрыск дали 280 Н·м уже с 1 800 об/мин. Мотор держал этот момент до 5 000 об/мин, поэтому подхват ощущался задолго до верхов.',
      angle:4, detail:'Сотовая решётка с красной окантовкой.',
      source:'https://www.volkswagen-newsroom.com/en/golf-5-gti-20042008-19511'
    }
  };
  const number = value => value.toLocaleString('ru-RU');
  const spec = (label,value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;

  function paintChoices(selected, surface, id) {
    return `<fieldset class="vw-palette"><legend>Цвет кузова</legend><div class="vw-swatches">${Object.entries(vwPaints).map(([code,[name,hex]]) => `
      <button type="button" ${surface==='garage'?`data-apply-vw-paint="${id}:${code}"`:`data-vw-paint="${code}"`} aria-pressed="${code===selected}">
        <span class="vw-chip" style="--paint:${hex}" aria-hidden="true"></span><strong>${name}</strong><small>${code} · ${hex}</small>
      </button>`).join('')}</div></fieldset>`;
  }

  function render(save, id, view, previewPaint) {
    const offer = root.NDShop.vw;
    const model = vwModels[id], car = cars.find(item => item.id===id);
    const paint = previewPaint || save.paints[id] || car.paint;
    const engine = engines.find(item => item.id===model.engine);
    const owned = save.owned.includes(id), count = save.inventory.cases.vw || 0;
    const drive = id==='vw-rallye'?'Полный · Syncro':id==='vw-r32'?'Полный · 4Motion':'Передний';
    const [historicalPrice,priceSource] = priceSources[id];
    const history = histories[id];
    return `<article class="vw-page">
      <header class="vw-masthead"><span class="vw-monogram">VW</span><strong>Volkswagen <small>WOLFSBURG EDITION</small></strong><span>NEON DRIFT<br>1989–2005</span></header>
      <section class="vw-intro"><p class="vw-kicker">ДИЛЕРСКАЯ КОЛЛЕКЦИЯ / 01–05</p><h2>Народный калибр</h2><p>Пять спортивных Volkswagen. Выбери модель, рассмотри её с шести сторон и подбери цвет кузова.</p></section>
      <nav class="vw-models" aria-label="Выбор модели">${offer.carIds.map((key,index) => `
        <button type="button" data-vw-model="${key}" aria-pressed="${key===id}"><small>0${index+1} / ${vwModels[key].year}</small><strong>${vwModels[key].name}</strong><span>${vwModels[key].generation}</span></button>`).join('')}</nav>
      <section class="vw-config" aria-label="Конфигуратор Volkswagen">
        <div class="vw-gallery">
          <button type="button" class="vw-stage" data-vw-photo aria-label="Увеличить фото: ${views[view]}">
            <img src="${vwPhoto(id,paint,view)}" width="768" height="341" alt="${car.name} · ${vwPaints[paint][0]} · ${views[view]}"><span aria-hidden="true">↗</span>
          </button>
          <div class="vw-view-caption"><span aria-live="polite">0${view+1} / 0${views.length} · ${views[view]}</span><span>СТУДИЙНАЯ ВИЗУАЛИЗАЦИЯ</span></div>
          <nav class="vw-angles" aria-label="Ракурс автомобиля">${views.map((label,index) => `<button type="button" data-vw-view="${index}" aria-pressed="${index===view}">${label}</button>`).join('')}</nav>
          <button type="button" class="vw-history-link" data-shop-jump="vw-history">История ${model.name} ↓</button>
        </div>
        <div class="vw-order">
          <p class="vw-kicker">${model.generation} / ${model.year}</p><h3>${model.name}</h3>
          <p class="vw-engine-label">${engine.name} / ${drive}</p>
          ${paintChoices(paint,'shop',id)}
          <div class="vw-game-preview"><img src="${getCarSprite(car,paint)}" alt="" width="110" height="50"><div><small>В ИГРЕ</small><strong>${vwPaints[paint][0]}</strong></div></div>
          ${owned && paint!==(save.paints[id]||car.paint)?`<button class="vw-button vw-outline" data-apply-vw-paint="${id}:${paint}">Сохранить цвет в гараже</button>`:''}
          <div class="vw-actions"><button class="vw-button" data-exclusive-car="${id}" ${!owned&&save.credits<car.price?'disabled':''}>${owned?'Выбрать из гаража':'Приобрести за ₡ '+number(car.price)}</button><button class="vw-button vw-outline" data-car-card="${id}">Карточка автомобиля ↗</button></div>
          <a class="vw-price-source" href="${priceSource}" target="_blank" rel="noopener">Историческая цена · ${historicalPrice} ↗</a>
        </div>
      </section>
      <section class="vw-history" id="vw-history" tabindex="-1" aria-labelledby="vw-history-title">
        <div class="vw-history-copy">
          <p class="vw-kicker">ИСТОРИЯ МОДЕЛИ / ${model.name.toUpperCase()}</p>
          <h3 id="vw-history-title">${history.title}</h3>
          <p>${history.origin}</p><p>${history.character}</p>
          <a class="vw-history-source" href="${history.source}" target="_blank" rel="noopener">Архив Volkswagen ↗</a>
        </div>
        <figure>
          <button type="button" class="vw-stage" data-vw-photo aria-label="Увеличить студийный ракурс: ${views[history.angle]}"><img src="${vwPhoto(id,paint,history.angle)}" width="768" height="341" loading="lazy" alt="${car.name} · ${views[history.angle]}"><span aria-hidden="true">↗</span></button>
          <figcaption>${history.detail}</figcaption>
        </figure>
      </section>
      <section class="vw-tech"><p class="vw-kicker">ТЕХНИЧЕСКИЙ ПАСПОРТ</p><h3>${engine.name}</h3><p>${engine.description} Тюнинг доступен, двигатель закреплён за моделью.</p>
        <dl class="vw-specs">${spec('Мощность',car.stockPowerHp+' PS')}${spec('Крутящий момент',model.torque+' Н·м')}${spec('0–100 км/ч',number(model.seconds)+' с')}${spec('Масса',number(car.weightKg)+' кг')}${spec('Макс. скорость',model.top+' км/ч')}${spec('Отсечка',number(model.redline)+' об/мин')}${spec('Масса мотора','≈'+engine.weightKg+' кг')}${spec('Привод',drive)}</dl>
      </section>
      <section class="vw-case">
        <figure><img src="${offer.assets.closed}" alt="Коллекционный кейс Wolfsburg Edition" loading="lazy"></figure>
        <div><p class="vw-kicker">КОЛЛЕКЦИОННЫЙ КЕЙС</p><h3>Wolfsburg Edition</h3><p>От одной до трёх наград за открытие. Шансы ниже действуют на каждую награду вне гаранта.</p>
          <dl class="vw-odds">${[[offer.blueChance,'Синие'],[offer.yellowChance,'Жёлтые'],[offer.currencyChance,'Монеты'],[offer.carChance,'Volkswagen']].map(([chance,label])=>spec(label,number(chance*100)+'%')).join('')}</dl>
          <p>По 0,4% на каждую модель. Монеты: 500–2 000 с шагом 100. Повтор машины даёт случайную красную деталь.</p>
          <div class="vw-actions"><button class="vw-button" data-action="buy-case" data-case="vw">Купить за ₡ ${number(offer.casePrice)}</button><button class="vw-button vw-outline" data-action="open-case" data-case="vw" ${count?'':'disabled'}>Открыть свой ×${count}</button></div>
        </div>
      </section>
      <footer class="vw-footer"><strong>VOLKSWAGEN / NEON DRIFT</strong><p>Ракурсы созданы для игры. Цвета доступны для всех пяти моделей. Цены в кредитах основаны на немецких ценах новых автомобилей того периода, с пересчётом марок в евро.</p></footer>
    </article>`;
  }

  root.NDVW = { render, paintChoices };
})(globalThis);
