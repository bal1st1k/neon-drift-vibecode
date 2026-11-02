/*! NEON DRIFT | Made by bal1st1k */
/* NEON DRIFT — supplied garage data, transparent game economy and build maths. */
(function (root) {
  'use strict';

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const round50 = amount => Math.round(amount / 50) * 50;
  const spriteRoot = 'for promt/car/SPRITE 2D/';
  const discount = 0.65;
  const offerDate = '2026-10-27';
  // referenceUsd contains observed asking prices only when priceBasis === 'offer'.
  // Other ranges are explicitly editorial estimates; see ECONOMY.md.
  const engineRows = [
    ['182-b6', '182 B6.000', 220, 168, [0,0], 'stock-only', null, 'Штатная пятицилиндровая турбо-двадцатиклапанная версия Fiat. Данные пользователя.'],
    ['ar67203', 'AR 67203', 190, 158, [0,0], 'stock-only', null, '2.0 16V Turbo Q4. Данные пользователя.'],
    ['ar16102', 'AR 16102 Busso V6', 220, 172, [0,0], 'stock-only', null, '3.0 V6 24V. Данные пользователя.'],
    ['835a8', '835A8.046', 215, 158, [0,0], 'stock-only', null, '2.0 16V Turbo Sedici. Данные пользователя.'],
    ['1jz-gte', '1JZ-GTE', 180, 217, [5800, 5800], 'offer',
      'https://www.jdmofwa.com/product/jdm-toyota-1jz-gte-vvti-turbo-engine-with-automatic-transmission-swap-1jzgte',
      '1JZ-GTE VVT-i с автоматической КПП, ECU и жгутом; ориентир предложения, характеристики игры сохранены.'],
    ['sr20det', 'SR20DET', 250, 139, [6799, 6799], 'offer',
      'https://lajdm.com/nissan/engines/nissan-silvia-sr20det-red-top-black-top/545/nissan-silvia-s13-blacktop-engine-5-speed-manual-rwd-trans-jdm-sr20det-motor/',
      'Турбо-четвёрка Nissan. Одна выбранная котировка за комплект S13 с механической КПП.'],
    ['ca18det', 'CA18DET', 175, 150, [3800, 3800], 'offer',
      'https://jdmsource.ca/products/jdm-nissan-sr20det-s14-engine-and-transmission-sr20-silvia-240sx-turbo-copy',
      'Компактный турбомотор ранней Silvia. Одна найденная котировка за мотор с КПП.'],
    ['rb25det', 'RB25DET', 225, 189, [4599.99, 7000], 'offer',
      'https://jdmsource.ca/collections/nissan-engines/products/jdm-nissan-rb25det-neo-engine-turbo-2-5l-awd-model-skyline-stagea-rb25',
      'Рядная турбо-шестёрка. Диапазон включает NEO AWD и Series 2 RWD с КПП; верхняя карточка распродана.'],
    ['rb26dett', 'RB26DETT', 290, 240, [4895, 4895], 'offer',
      'https://jdmracingmotors.com/product/nissan-skyline-bnr32-gtr-rb26dett-engine-swap-for-1989-1994-nissans-w-ecu-complete-engine-harness-no-transmission/',
      'Рядная шестёрка GT-R. Котировка за мотор с ECU и жгутом, без КПП; карточка OUT OF STOCK.'],
    ['3sge', '3S-GE', 175, 129, [2199, 2199], 'offer',
      'https://www.jdm-online.com/products/3s-ge-1994-1999-toyota-celica-st202-2-0l-na-engine-mr2-non-turbo-jdm',
      'Атмосферный 3S-GE из Celica ST202; применимость к MR2 требует проверки.'],
    ['2jzgte', '2JZ-GTE', 280, 269, [12800, 12800], 'offer',
      'https://www.suprastore.com/2jzgteengine.html',
      'Рядная турбо-шестёрка Supra. Одна подтверждённая котировка; наличие и комплектность требуют уточнения у продавца.'],
    ['3au', '3A-U', 80, 189, [600, 1400], 'estimate', null,
      'Штатный мотор AE85. Масса сохранена из пользовательской таблицы; цена оценочная.'],
    ['4age', '4A-GE 16V', 130, 111, [3250, 3250], 'offer',
      'https://partnests.com/engine/toyota-4a-ge-engine-for-sale/',
      'Предложение семейства 4A-GE; продавец предлагает уточнять 16-клапанную версию перед покупкой.'],
    ['1zzfe', '1ZZ-FE', 140, 102, [1399, 1399], 'offer',
      'https://www.jdmcalifornia.com/product/jdm-toyota-celica-corolla-matrix-2000-2004-1zz-fe-engine-1-8l-vvti-1zz/',
      'Лёгкий мотор MR-S. Ценовой ориентир — предложения семейства 1ZZ для Corolla/Celica, без гарантии комплекта MR-S.'],
    ['3sge-beams', '3S-GE BEAMS', 209, 177, [1749, 2799], 'offer',
      'https://www.jdmenginedepotinc.com/toyota-altezza-engines/',
      'Версия для Altezza с отдельной массой из таблицы. Цены относятся к разным комплектам мотора и трансмиссии.'],
    ['b16b', 'B16B', 185, 184, [7000, 7000], 'offer',
      'https://dmvjdmdepot.com/products/1996-1997-1998-1999-2000-honda-civic-jdm-b16b-type-r-1-6l-vtec-engine-5-speed-manual-transmission-s4c-lsd',
      'Высокооборотная четвёрка. Котировка за B16B с КПП; мотор EG6 сохранён именно как B16B по исходным данным.'],
    ['b18c', 'B18C', 200, 184, [7599, 7599], 'offer',
      'https://lajdm.com/honda/engines/jdm-b20b-b16a-b16b-b18b-b18c-spec-r-gsr-type-r-motorss/399/honda-integra-dc2-b18c-type-r-96-spec-itr-5-speed-lsd-complete-swap-jdm/',
      'Мотор Integra Type R. Единственная выбранная котировка — комплект с 5-ступенчатой LSD КПП.'],
    ['c30a', 'C30A', 274, 147, [7000, 14000], 'estimate', null,
      'Атмосферный V6 NSX; в таблице масса без маховика и коллекторов. Цена оценочная.'],
    ['4g63t', '4G63T', 275, 119, [2899, 2899], 'offer',
      'https://www.jdm-online.com/products/jdm-96-98-mitsubishi-lancer-evolution-iv-4g63-2-0l-dohc-turbo-engine-evo-4-2',
      'Котировка семейства Evo IV; SOLD OUT. Состав комплекта описан противоречиво и требует проверки. Масса сохранена из пользовательской таблицы.'],
    ['ej207', 'EJ207', 280, 151, [6450, 6450], 'offer',
      'https://www.jdmcalifornia.com/product/jdm-subaru-wrx-ej207-version8/',
      'Оппозитный турбомотор STI. Одна выбранная котировка за Version 8 с 6-ступенчатой КПП.'],
    ['13b-rew', '13B-REW', 230, 175, [7499, 7999.99], 'offer',
      'https://www.jdmenginedepotinc.com/product/96-98-mazda-rx7-1-3l-twin-turbo-engine-5spd-trans-loom-ecu-jdm-13b-201533/',
      'Роторный twin-turbo RX-7. Масса 175 кг — округлённая середина исходного интервала 172–177; цены комплектов с 5-ступенчатой КПП.'],
    ['f20c', 'F20C', 250, 148, [7995, 7995], 'offer',
      'https://jdmenginedirect.com/products/jdm-2000-2003-honda-s2000-motor-6-speed-f20c-2-0l-4-cyl-engine',
      'Атмосферный мотор S2000. 250 PS и 148 кг по твоей таблице; масса относится к сухому блоку с внутренними деталями. Ценовой ориентир — предложение мотора с 6-ступенчатой КПП.'],
    ['1g-fe', '1G-FE', 155, 175, [1613, 1613], 'offer',
      'https://japexpressja.com/product/1g-fe-2-0l-complete-engine-for-toyota-altezza-gxe10-crown-lexus-is200-mark-ii-gx100/',
      'Подержанный 1G-FE для Altezza и IS200; мощность и масса по предоставленным характеристикам.'],
    ['2jz-ge', '2JZ-GE', 217, 215, [2100, 2100], 'offer',
      'https://jdmofsandiego.com/product/1998-2005-jdm-2jz-ge-vvti-3-0l-lexus-gs300-is300-sc300-engine-2jz/',
      'Подержанный 2JZ-GE VVT-i с навесным; ориентир предложения для IS300.'],
    ['k20a', 'K20A', 225, 143, [2900, 2900], 'offer',
      'https://ajgonzalezjdm.com/product/k20a-type-r-engine-transmission/',
      'Комплект K20A Type R с КПП; продавец указывает FD2/EP3, точную модификацию следует уточнить.'],
    ['bp-ve', 'BP-VE', 160, 130, [1895.25, 1895.25], 'offer',
      'https://shop.foreignengines.com/jdm-mazda-mx-5-miata-bp-ve-1-8l-vvt-engine-2001-2005/',
      'Подержанный BP-VE 1,8 VVT для Miata 2001–2005; ориентир предложения.'],
    ['b6-ze', 'B6-ZE', 116, 120, [2199, 2199], 'offer',
      'https://jdmalliancela.com/products/jdm-90-97-mazda-miata-b6ze-1-6l-dohc-engine-5-speed-manual-transmission',
      'B6-ZE для Miata NA с 5-ступенчатой КПП и ECU; ориентир предложения.'],
    ['l24', 'L24', 150, 165, [3000, 3000], 'offer',
      'https://www.californiadatsun.com/engine/long-block-short-block-engines/',
      'Восстановленный L24 long block с головкой E88; без дополнительных опций.'],
    ['vq35de', 'VQ35DE', 280, 195, [1550, 1550], 'offer',
      'https://jdmflorida.com/product/jdm-2003-2005-nissan-350z-35l-v6-engine-only-vq35deeng',
      'Штатный VQ35DE 350Z; ориентир предложения двигателя без КПП. Свап недоступен.'],
    ['4ageu', '4A-GEU', 150, 123, [0, 0], 'stock-only', null,
      'Мотор AE86 Akina Spec: 150 PS и 123 кг. Доступен только в штатной машине, без свапа.'],
    ['s14b25','S14B25',238,152,[0,0],'stock-only',null,'Штатный 2.5L I-4 M3 Sport Evolution; параметры пользователя, свап отключён.'],
    ['s50b32','S50B32',321,204,[0,0],'stock-only',null,'Европейский 3.2L I-6 с Double-VANOS; параметры пользователя, свап отключён.'],
    ['s54b32','S54B32',343,212,[0,0],'stock-only',null,'Штатный 3.2L I-6 M3 E46; параметры пользователя, свап отключён.'],
    ['modular-46-3v', '4.6L Modular 3V V8', 300, 205, [0, 0], 'stock-only', null, 'Штатный V8 Mustang GT; масса и мощность по данным пользователя. Свап отключён.'],
    ['type-930-60', 'Type 930/60', 300, 225, [0, 0], 'stock-only', null,
      '3,3-литровый оппозитный турбомотор с воздушным охлаждением. Параметры Blackbird по данным пользователя; свап недоступен.'],
    ['m102-992', 'M102.992', 235, 168, [0, 0], 'stock-only', null,
      'Штатный двигатель Mercedes 190 E Evolution II; масса по пользовательским данным.'],
    ['trd-4age', 'TRD 4A-GE Group A', 240, 100, [0, 0], 'fixed', null,
      'Гоночная версия для AE86 Project D Spec. 240 PS и 100 кг. Доступна для установки в другие машины.']
  ];
  const engines = engineRows.map(([id, name, powerHp, weightKg, referenceUsd, priceBasis, sourceUrl, description]) => ({
    id, name, powerHp, weightKg, referenceUsd, priceBasis, sourceUrl, description,
    gamePrice: (id === 'trd-4age' ? 12000 : round50((referenceUsd[0] + referenceUsd[1]) / 2 * discount)), swapAllowed: !['s14b25','s50b32','s54b32','modular-46-3v','182-b6','ar67203','ar16102','835a8','4ageu','vq35de','m102-992','type-930-60'].includes(id), offerDate: ['1jz-gte','3sge','4age','1g-fe','2jz-ge','k20a','bp-ve','b6-ze','l24','vq35de'].includes(id) ? '2026-10-30' : ['f20c','4ageu','trd-4age'].includes(id) ? '2026-10-28' : offerDate
  }));
  const engineById = Object.fromEntries(engines.map(engine => [engine.id, engine]));

  // Columns: id, full supplied name, brand, layout, stock engine, PS, kg, sprite.
  // Input power/weight values intentionally take precedence over outside sources.
  const carRows = [
    ['m3-e30','BMW M3 Sport Evolution (E30)','BMW','FR','s14b25',238,1200,'assets/bmw/m3-e30-sprite.jpg'],
    ['m3-e36','BMW M3 3.2 Euro (E36)','BMW','FR','s50b32',321,1440,'assets/bmw/m3-e36-sprite.jpg'],
    ['m3-e46','BMW M3 Coupé (E46)','BMW','FR','s54b32',343,1495,'assets/bmw/m3-e46-sprite.jpg'],
    ['mustang-gt','Ford Mustang GT (2005 S197)','Ford','FR','modular-46-3v',300,1570,'assets/mustang/mustang-gt-sprite.jpg'],
    ['fiat-coupe','Fiat Coupé 20V Turbo','Fiat','FF','182-b6',220,1310,'assets/italy/fiat-coupe-sprite.jpg'],
    ['alfa-155','Alfa Romeo 155 Q4','Alfa Romeo','AWD','ar67203',190,1390,'assets/italy/alfa-155-sprite.jpg'],
    ['alfa-gtv','Alfa Romeo GTV 3.0 V6 24V','Alfa Romeo','FF','ar16102',220,1410,'assets/italy/alfa-gtv-sprite.jpg'],
    ['delta-evo2','Lancia Delta HF Integrale Evoluzione II','Lancia','AWD','835a8',215,1340,'assets/italy/delta-evo2-sprite.jpg'],
    ['930-blackbird', 'Porsche 911 Turbo 3.3 (Typ 930) [Blackbird Spec]', 'Porsche', 'RR', 'type-930-60', 300, 1300, 'for promt/blackbird/blackbird-sprite.jpg'],
    ['w201-evo2', 'Mercedes-Benz 190 E 2.5-16 Evolution II (W201)', 'Mercedes-Benz', 'FR', 'm102-992', 235, 1340, 'for promt/major update 4.0/Mercedes-Benz 190E 2.5-16 Evolution II (W201)/w201-evo2-sprite.jpg'],
    ['na6ce', 'Mazda Roadster (NA6CE)', 'Mazda', 'FR', 'b6-ze', 116, 960, 'assets/source/na6ce-cutout.png'],
    ['jzz30', 'Toyota Soarer 2.5 GT-T (JZZ30)', 'Toyota', 'FR', '1jz-gte', 180, 1560, 'Toyota Soarer 2.5 GT-T (JZZ30)/jzz30-sprite.jpg'],
    ['jzx90', 'Toyota Mark II Tourer V (JZX90)', 'Toyota', 'FR', '1jz-gte', 180, 1450, 'Toyota Mark II Tourer V (JZX90)/jzx90-sprite.jpg'],
    ['jzx81', 'Toyota Chaser GT Twin Turbo (JZX81)', 'Toyota', 'FR', '1jz-gte', 180, 1470, 'Toyota Chaser GT Twin Turbo (JZX81)/jzx81-sprite.jpg'],
    ['is200', 'Lexus IS200 (GXE10)', 'Lexus', 'FR', '1g-fe', 155, 1360, 'is200-sprite.jpg'],
    ['is300', 'Lexus IS300 (JCE10)', 'Lexus', 'FR', '2jz-ge', 217, 1480, 'is300-sprite.jpg'],
    ['fd2', 'Honda Civic Type R (FD2)', 'Honda', 'FF', 'k20a', 225, 1260, 'honda civic (fd2)/sprite.jpg'],
    ['nb8c', 'Mazda Roadster RS (NB8C)', 'Mazda', 'FR', 'bp-ve', 160, 1040, 'Mazda Roadster RS (NB8C)/nb8c-sprite.jpg'],
    ['s30', 'Nissan Fairlady Z (S30)', 'Nissan', 'FR', 'l24', 150, 1050, 'Nissan Fairlady Z (S30)/s30-sprite.jpg'],
    ['z33', 'Nissan Fairlady Z Version S (Z33)', 'Nissan', 'FR', 'vq35de', 280, 1440, 'Nissan Fairlady Z Version S (Z33)/sprite.jpg'],
    ['ae86-akina', 'Toyota Sprinter Trueno GT-APEX (AE86) [Akina Spec]', 'Toyota', 'FR', '4ageu', 150, 925, 'ae86-akina-sprite.jpg'],
    ['ae86-project-d', 'Toyota Sprinter Trueno GT-APEX (AE86) [Project D Spec]', 'Toyota', 'FR', 'trd-4age', 240, 890, 'ae86-project-d-sprite.jpg'],
    ['s2000', 'Honda S2000 (AP1)', 'Honda', 'FR', 'f20c', 250, 1240, 's2000-sprite.jpg'],
    ['ae85', 'Toyota Corolla Levin SR (AE85)', 'Toyota', 'FR', '3au', 80, 900,
      'ae85-sprite-original.jpg'],
    ['ae86', 'Toyota Sprinter Trueno GT-APEX (AE86)', 'Toyota', 'FR', '4age', 130, 960,
      'ae86-sprite.jpg'],
    ['s13', "Nissan Silvia K's (S13)", 'Nissan', 'FR', 'ca18det', 175, 1120,
      's13-sprite-original.jpg'],
    ['s14', "Nissan Silvia K's Aero (S14)", 'Nissan', 'FR', 'sr20det', 220, 1250,
      's14-sprite-original.jpg'],
    ['s15', 'Nissan Silvia Spec-R (S15)', 'Nissan', 'FR', 'sr20det', 250, 1240,
      's15-sprite-original.jpg'],
    ['180sx', 'Nissan 180SX (RPS13)', 'Nissan', 'FR', 'sr20det', 205, 1190,
      '180sx-sprite-original.jpg'],
    ['sileighty', 'Nissan SilEighty (RPS13)', 'Nissan', 'FR', 'sr20det', 205, 1190,
      'sileighty-sprite-original.jpg'],
    ['er34', 'Nissan Skyline 25GT Turbo (ER34)', 'Nissan', 'FR', 'rb25det', 225, 1410,
      'er34-sprite-original.jpg'],
    ['bnr32', 'Nissan Skyline GT-R (BNR32)', 'Nissan', 'AWD', 'rb26dett', 280, 1480,
      'bnr32-sprite.jpg'],
    ['bnr32-vspec', 'Nissan Skyline GT-R V-Spec II (BNR32)', 'Nissan', 'AWD', 'rb26dett', 290, 1500,
      'bnr32-vspec-sprite.jpg'],
    ['bnr34', 'Nissan Skyline GT-R V-Spec II Nür (BNR34)', 'Nissan', 'AWD', 'rb26dett', 280, 1560,
      'bnr34-sprite.jpg'],
    ['mr2', 'Toyota MR2 (SW20)', 'Toyota', 'MR', '3sge', 175, 1190,
      'mr2-sprite.jpg'],
    ['supra', 'Toyota Supra RZ (JZA80)', 'Toyota', 'FR', '2jzgte', 280, 1510,
      'supra-sprite-original.jpg'],
    ['mrs', 'Toyota MR-S S-Edition (ZZW30)', 'Toyota', 'MR', '1zzfe', 140, 970,
      'mrs-sprite-original.jpg'],
    ['altezza', 'Toyota Altezza (SXE10)', 'Toyota', 'FR', '3sge-beams', 209, 1340,
      'altezza-sprite-original.jpg'],
    ['ek9', 'Honda Civic Type R (EK9)', 'Honda', 'FF', 'b16b', 185, 1070,
      'ek9-sprite.jpg'],
    ['eg6', 'Honda Civic SiR-II (EG6)', 'Honda', 'FF', 'b16b', 185, 1050,
      'eg6-sprite.jpg'],
    ['dc2', 'Honda Integra Type R (DC2)', 'Honda', 'FF', 'b18c', 200, 1100,
      'dc2-sprite.jpg'],
    ['nsx', 'Honda NSX (NA1)', 'Honda', 'MR', 'c30a', 274, 1350,
      'nsx-sprite.jpg'],
    ['evo3', 'Mitsubishi Lancer Evolution III GSR (CE9A)', 'Mitsubishi', 'AWD', '4g63t', 275, 1260,
      'evo3-sprite.jpg'],
    ['evo4', 'Mitsubishi Lancer Evolution IV RS (CN9A)', 'Mitsubishi', 'AWD', '4g63t', 275, 1260,
      'evo4-sprite.jpg'],
    ['evo5', 'Mitsubishi Lancer Evolution V RS (CP9A)', 'Mitsubishi', 'AWD', '4g63t', 275, 1260,
      'evo5-sprite.jpg'],
    ['evo6', 'Mitsubishi Lancer Evolution VI GSR Tommi Mäkinen Edition (CP9A)', 'Mitsubishi', 'AWD', '4g63t', 275, 1360,
      'evo6-sprite.jpg'],
    ['evo7', 'Mitsubishi Lancer Evolution VII GSR (CT9A)', 'Mitsubishi', 'AWD', '4g63t', 275, 1400,
      'evo7-sprite.jpg'],
    ['gc8', 'Subaru Impreza WRX STi Coupe Type R Version V (GC8F)', 'Subaru', 'AWD', 'ej207', 280, 1260,
      'gc8-sprite.jpg'],
    ['fd3s', 'Mazda RX-7 Type R (FD3S)', 'Mazda', 'FR', '13b-rew', 230, 1280,
      'fd3s-sprite.jpg']
  ];
  const colors = { BMW:'#58a5d9', Ford:'#ba4534', Fiat:'#e5bc48', 'Alfa Romeo':'#c34b47', Lancia:'#83ae9e', Porsche:'#c9cbd0', 'Mercedes-Benz':'#c1c9d2', Lexus:'#b4c9dd', Toyota: '#d7ff63', Nissan: '#79edd7', Honda: '#ff839d', Mitsubishi: '#a6a0ff', Subaru: '#7da9ff', Mazda: '#ffb26c' };
  // Source nose directions were inspected in all supplied JPEGs by the renderer pass.
  const leftFacingSprites = new Set(['m3-e30','m3-e36','m3-e46','mustang-gt','alfa-155','alfa-gtv','930-blackbird','w201-evo2','na6ce','jzz30','jzx90','jzx81','is200','is300','altezza','ek9', 'dc2', '180sx', 's14', 's13', 's15', 'sileighty', 'er34', 'ae85', 'mrs', 'supra', 'fd3s', 'evo3', 'evo6', 's2000', 'ae86-akina']);
  const updateSprites = {
    '180sx':'180sx-sprite.jpg',
    sileighty:'sileighty-sprite.jpg',
    s13:"s13-sprite.jpg",
    s14:"s14-sprite.jpg",
    s15:'s15-sprite.jpg',
    er34:'er34-sprite.jpg',
    ae85:'ae85-sprite.jpg',
    mrs:'mrs-sprite.jpg'
  };
  const downFacingSprites = new Set(['eg6', 'nsx', 'gc8']);
  const revisedSprites = new Set(['altezza','ae86', 'bnr32', 'bnr32-vspec', 'bnr34', 'mr2']);
  function buildStats(powerHp, weightKg, drivetrain, levels) {
    const hpPerTonne = powerHp / weightKg * 1000;
    const layout = { FR: 0, FF: 5, MR: 8, RR: 2, AWD: 4 }[drivetrain] || 0;
    return {
      speed: Math.round(clamp(36 + hpPerTonne * 0.23 + levels.gearbox * 2.2, 25, 100)),
      handling: Math.round(clamp(72 + (1200 - weightKg) * 0.018 + layout + levels.tires * 2.5 + levels.suspension * 3.5 + levels.differential * 0.8, 30, 100)),
      boost: Math.round(clamp(48 + hpPerTonne * 0.16 + levels.nitro * 5, 30, 100))
    };
  }
  const stockLevels = { gearbox: 0, tires: 0, suspension: 0, differential: 0, nitro: 0 };
  const cars = carRows.map(([id, name, brand, drivetrain, stockEngineId, stockPowerHp, weightKg, sprite]) => {
    const powerToWeight = stockPowerHp / weightKg;
    const stockEngineLabel = id === 'altezza' ? '3S-GE' : engineById[stockEngineId].name.replace(' 16V', '');
    const edition = id === 'ae86-akina' ? 'Akina Spec' : id === 'ae86-project-d' ? 'Project D Spec' : '';
    const legend = ['fd2','nb8c','s30','z33'].includes(id);
    const brother=['is200','is300'].includes(id);
    const roadster=id==='na6ce';
    const pityOnly=['jzz30','jzx90','jzx81'].includes(id);
    const italian=['fiat-coupe','alfa-155','alfa-gtv','delta-evo2'].includes(id);
    const bmw=['m3-e30','m3-e36','m3-e46'].includes(id);
    const mustang=id==='mustang-gt';
    const mercedes=id==='w201-evo2',blackbird=id==='930-blackbird';
    const exclusive = id === 's2000' || !!edition || legend || brother || pityOnly || roadster || mercedes || blackbird || italian || mustang || bmw;
    return {
      id, name, brand, drivetrain, stockEngineId, stockEngineLabel, stockPowerHp, weightKg,
      sprite: bmw||mustang||italian||mercedes||blackbird?sprite:updateSprites[id]?'for promt/major update 4.0/машины реворк/'+updateSprites[id]:roadster?sprite:pityOnly?'for promt/гарант/'+sprite:id==='altezza'?'for promt/«Заокеанские братья»/altezza-sprite.jpg':brother?'for promt/«Заокеанские братья»/'+sprite:legend ? 'for promt/легенды интернета/' + sprite : edition ? 'for promt/призрак акины/' + sprite : id === 's2000' ? 'for promt/S2000/' + sprite : spriteRoot + sprite,
      raceSprite: `assets/cars/${id}${updateSprites[id] ? '-v4' : revisedSprites.has(id) ? '-v2' : ''}.png`,
      spriteAngle: leftFacingSprites.has(id) ? Math.PI : downFacingSprites.has(id) ? Math.PI / 2 : -Math.PI / 2,
      powerToWeight, hpPerTonne: powerToWeight * 1000,
      price: bmw?({'m3-e30':46000,'m3-e36':39000,'m3-e46':49000})[id]:mustang?32000:italian?({'fiat-coupe':24000,'alfa-155':26000,'alfa-gtv':28000,'delta-evo2':42000})[id]:blackbird?62000:mercedes?48000:roadster?12000:brother?({is200:23000,is300:27000})[id]:legend ? ({fd2:31000,nb8c:15000,s30:39000,z33:29000})[id] : id === 's2000' ? 43000 : id === 'ae86-akina' ? 23000 : id === 'ae86-project-d' ? 54000 : Math.round((6000 * Math.pow(powerToWeight / (80 / 900), 2)) / 100) * 100,
      shopExclusive: exclusive, pityOnly, swapLocked: bmw||mustang||italian||mercedes||blackbird, tuningLocked: !bmw && !italian && exclusive && !pityOnly && !brother && !roadster && !mercedes && !blackbird && (!legend || id === 'z33'), edition, team: bmw?'BMW Motorsport':mustang?'American Pony':italian?'Salone Italiano':blackbird?'Blackbird Spec':mercedes?'HOMOLOGATION 502':roadster?'Always the Answer':pityOnly?'Гарант':brother?'USDM Brothers':legend ? 'Legends of the Internet' : id === 's2000' ? 'Purple Shadow' : '', showcaseId: bmw?'bmw-showcase':mustang?'mustang-showcase':italian?'italy-showcase':blackbird?'blackbird-showcase':mercedes?'mercedes-showcase':roadster?'roadster-showcase':pityOnly?'pity-showcase':brother?'brothers-showcase':legend ? 'legends-showcase' : edition ? 'takumi-showcase' : 's2000-showcase',
      tag: `${drivetrain} / ${stockPowerHp} PS`, color: colors[brand],
      stats: buildStats(stockPowerHp, weightKg, drivetrain, stockLevels),
      description: `${stockEngineLabel} · ${stockPowerHp} PS · ${weightKg} кг · ${drivetrain}. ${bmw||italian||mercedes||blackbird?'Тюнинг доступен, замена мотора отключена.':exclusive && !pityOnly && !brother && !roadster && (!legend || id === 'z33') ? 'Эксклюзив магазина. Фиксированная сборка без тюнинга и замены мотора.' : 'Данные твоего каталога; доступные моторы и детали можно устанавливать в гараже.'}`
    };
  }).sort((a, b) => a.powerToWeight - b.powerToWeight);
  const carById = Object.fromEntries(cars.map(car => [car.id, car]));

  const upgrades = [
    { id: 'turbo', name: 'Турбокомплект', basePrice: 1600, maxLevel: 3, description: '+12% штатной мощности за уровень. Доступен для каждого двигателя.' },
    { id: 'intake', name: 'Впуск', basePrice: 300, maxLevel: 3, description: '+3% штатной мощности за уровень: фильтр, тракт и подача воздуха.' },
    { id: 'exhaust', name: 'Выпуск', basePrice: 450, maxLevel: 3, description: '+4% штатной мощности за уровень за счёт свободного выпуска.' },
    { id: 'ecu', name: 'Настройка ECU', basePrice: 650, maxLevel: 3, description: '+5% штатной мощности за уровень через настройку управления мотором.' },
    { id: 'tires', name: 'Полуслики', basePrice: 600, maxLevel: 3, description: '+11% сцепления и +4,5% точности руления за уровень.' },
    { id: 'suspension', name: 'Подвеска', basePrice: 750, maxLevel: 3, description: '+6% управляемости и +3,5% сцепления за уровень.' },
    { id: 'brakes', name: 'Тормоза', basePrice: 500, maxLevel: 3, description: '+12% тормозного усилия за уровень для позднего торможения.' },
    { id: 'weight', name: 'Облегчение', basePrice: 900, maxLevel: 3, description: '−4% массы собранной машины за уровень. Меньше инерция, выше мощность на тонну.' },
    { id: 'gearbox', name: 'Коробка передач', basePrice: 800, maxLevel: 3, description: '+7% к передаточной эффективности и +3,5% отклику разгона за уровень.' },
    { id: 'differential', name: 'Дифференциал LSD', basePrice: 700, maxLevel: 3, description: '+6% эффективности дифференциала за уровень: стабильнее тяга и контроль заноса.' },
    { id: 'nitro', name: 'Закись азота', basePrice: 550, maxLevel: 3, description: '+10% силы и +12% длительности нитро за уровень.' }
  ];
  const upgradeById = Object.fromEntries(upgrades.map(upgrade => [upgrade.id, upgrade]));
  function safeLevel(value, max = 3) {
    const numeric = typeof value === 'number' || typeof value === 'string' ? Number(value) : 0;
    return Number.isFinite(numeric) ? clamp(Math.floor(numeric), 0, max) : 0;
  }
  function computeBuild(carId, levels = {}, requestedEngineId) {
    const car = carById[carId] || carById.ae85;
    const requested = engineById[car.tuningLocked || car.swapLocked ? car.stockEngineId : requestedEngineId];
    const engine = requested && (requested.swapAllowed !== false || requested.id === car.stockEngineId) ? requested : engineById[car.stockEngineId];
    const supplied = !car.tuningLocked && levels && typeof levels === 'object' && !Array.isArray(levels) ? levels : {};
    const tune = Object.fromEntries(upgrades.map(upgrade => [upgrade.id, safeLevel(supplied[upgrade.id], upgrade.maxLevel)]));
    const stockEngine = engineById[car.stockEngineId];
    const basePower = engine.id === car.stockEngineId ? car.stockPowerHp : engine.powerHp;
    const powerHp = basePower * (1 + tune.turbo * 0.12 + tune.intake * 0.03 + tune.exhaust * 0.04 + tune.ecu * 0.05);
    const weightKg = (car.weightKg - stockEngine.weightKg + engine.weightKg) * (1 - tune.weight * 0.04);
    const powerToWeight = powerHp / weightKg;
    return {
      car, engine, engineId: engine.id, powerHp, weightKg, powerToWeight, hpPerTonne: powerToWeight * 1000,
      stats: buildStats(powerHp, weightKg, car.drivetrain, tune),
      multipliers: {
        acceleration: 1 + tune.gearbox * 0.035,
        handling: 1 + tune.tires * 0.045 + tune.suspension * 0.06,
        braking: 1 + tune.brakes * 0.12,
        grip: 1 + tune.tires * 0.11 + tune.suspension * 0.035,
        nitroPower: 1 + tune.nitro * 0.1,
        nitroDuration: 1 + tune.nitro * 0.12,
        transmission: 1 + tune.gearbox * 0.07,
        differential: 1 + tune.differential * 0.06
      }
    };
  }
  function getSwapPrice(carId, engineId) {
    const car = carById[carId] || carById.ae85;
    const engine = engineById[engineId];
    if (!engine || engine.swapAllowed === false || engine.id === car.stockEngineId) return 0;
    return engine.priceBasis === 'fixed' ? engine.gamePrice : Math.min(engine.gamePrice, round50(car.price * 0.75));
  }
  function getUpgradePrice(upgradeId, currentLevel, _carId) {
    const upgrade = upgradeById[upgradeId];
    return upgrade ? upgrade.basePrice * (safeLevel(currentLevel, upgrade.maxLevel) + 1) : 0;
  }

  const api = { cars, engines, upgrades, computeBuild, getSwapPrice, getUpgradePrice };
  root.NDCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
