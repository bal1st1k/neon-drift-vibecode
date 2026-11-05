# Дополнение: фотоблоки и ракурсы Audi

После правок пользователя схема цилиндров удалена. Секции повторяют композицию референса Audi: три фотокарточки, крупный кадр моторного отсека рядом с текстом и отдельный кадр автомобиля на серпантине. Главный заголовок называет модель. Игровой вид сверху вынесен в раскрываемое превью.

Для детали кузова использован оригинальный архивный снимок первого TT RS, полученный через Firecrawl: https://www.autoevolution.com/cars/audi-tt-rs-coupe-2009.html, оригинал https://s1.cdn.autoevolution.com/images/gallery/AUDI-TT-RS-Coupe-4073_29.jpg (1920×1358). Рабочий файл assets/audi/detail-archive.webp. Два сгенерированных крупных плана отклонены пользователем из-за искажённых пропорций передка и не используются.

Студийный конфигуратор: шесть ракурсов каждого из шести цветов. Исходники 1672×941, WebP quality 96 без изменения размеров. media-manifest.json связывает каждый файл с исходным результатом встроенного imagegen. Файлы assets/audi/<код>-<ракурс>.webp. Это дискретные визуализации, не непрерывная 3D-модель.

Полноэкранный просмотр сохраняет ракурс и цвет. Выбор цвета купленной машины сохраняется в гараже. Все фотографии выводятся с object-fit: contain; редакционные крупные кадры могут кадрироваться без изменения пропорций. Палитра и навигация фотопросмотра адаптированы к 320 px.

## Спецификация набора студийных промптов

Use case: product-mockup. One high-quality photorealistic studio render of the original 2009 Audi TT RS 8J coupe. Rounded original headlamps, silver five-spoke factory wheels, silver mirrors, fixed rear wing, original grille and oval exhausts, closed roof. Full vehicle, camera at door-handle height, 85mm product lens, seamless charcoal #161b22 studio and matte floor, soft white strip lights, enough fill to show dark paint. Wide 16:9, generous margins, consistent trim and studio. No UI, text, watermark, collage, 8S generation, tuning or cropped car. References: existing hero and user's top-down drawing for model identity. For each of the six palette codes, set its exact named paint and hex, then one of: front three-quarter left; exact left profile nose left; rear three-quarter; exact rear; exact front; front three-quarter right. Native high resolution.

## Промпт принятого кадра двигателя (встроенный imagegen)

Use case: ads-marketing. Asset type: cinematic automotive engine editorial photograph, wide 3:2, maximum native quality. Primary request: replace a cheap diagram with a premium macro photograph of the ORIGINAL 2009 Audi TT RS 8J 2.5 TFSI CEPA five-cylinder engine installed transversely in its open engine bay. Original black plastic factory engine cover with five sculpted ribs, small silver Audi rings and restrained red ignition/coil details, brushed metal intake, factory hoses and clamps, realistic black plastics and fine material texture. Camera close three-quarter from the front, engine fills the composition; sliver of Misano Red Pearl fender at edge, hood outside frame. Cinematic cool charcoal shadows, clean soft white strip light across metal, a subtle warm red rim, deep dimensional contrast without crushing detail. Editorial commercial automotive photography, razor-sharp engine surfaces, natural optics, not a technical diagram. No exploded engine, no pistons illustration, no floating geometry, no infographic, no UI, no watermark, no added text, no modern DAZA or V8. This is a mood illustration of CEPA, not a service diagram.

## Промпт принятого кадра на серпантине (встроенный imagegen)

Use case: ads-marketing. Cinematic premium automotive campaign photo of a Misano Red Pearl 2009 Audi TT RS 8J coupe, same original round headlamps, silver five-spoke wheels, silver mirrors and fixed rear wing. Wide 2:1 composition, low rear three-quarter tracking shot driving along a curving mountain road at blue hour. Car tack sharp, subtle motion blur in wheels and asphalt, cool mountain haze, warm last light tracing red body, beautiful natural reflections, headlights lightly illuminating road. Full vehicle, restrained realism, magazine quality. No traffic, people, UI, text or watermark. Do not depict newer angular 8S. Native high resolution.


Согласование нижнего заднего блока на шести ракурсах и атмосферном кадре: [REAR-CORRECTION.md](REAR-CORRECTION.md).


Прозрачные варианты закрытого и открытого кейса подготовлены встроенным imagegen из предоставленных JPEG. PNG подключены в витрине, инвентаре и раскрытии. Точные промпты и имена файлов: [CASE-CUTOUTS.json](CASE-CUTOUTS.json).
