# Городской спорткласс

## Источники и референс

5 ноября 2026 через Firecrawl прочитана страница https://www.audiusa.com/en/models/a3/a3/2027/overview/ с markdown и branding. Полноразмерный снимок просмотрен в artifacts/audi-reference.png.

Наблюдаемые элементы референса — тёмный фон, большой автомобильный hero с текстом снизу, три показателя рядом, конфигуратор с круглыми образцами цвета, крупные заголовки и чередование иллюстраций с текстом. Firecrawl определил Audi Type, фон #101319, панели #2F3540 и круглые кнопки. В игре используется Segoe UI с Arial как доступная замена шрифта. Красный акцент RS — решение этой реализации. Схема цилиндров удалена по правке пользователя, вместо неё используется крупный кадр моторного отсека. Это адаптация к игровому магазину.

## Техническое содержание

- Пользовательский паспорт находится в for promt/Городской спорткласс/Новий Text Document.txt. Его значения имеют приоритет в игровом каталоге. Цена 44 000 кредитов, исторический ориентир €55 800 и все шесть кодов окраски взяты из задания.
- https://www.audi.com/en/highlights-from-40-years-of-audi-sport-gmbh-15337/the-return-of-a-unique-concept-15347 подтверждает появление TT RS в 2009 году, поперечное размещение пятицилиндрового EA855 и привод Haldex.
- https://media.audiusa.com/releases/655 подтверждает историю и порядок работы 1–2–4–5–3. Современный 400-сильный двигатель в статье отличается от CEPA первого TT RS.
- https://www.netcarshow.com/audi/2010-tt_rs/ содержит архив пресс-релиза первого TT RS с 340 PS, 450 Н·м, 4,6 с, мотором 183 кг и длиной 49 см. Обозначение 2010 в архиве относится к модельному году. В игре сохранён 2009 из задания.

## Графика

Встроенный imagegen использован для шести прозрачных игровых спрайтов и одной иллюстрации hero. Это визуализации. Изображения кейса предоставлены пользователем и скопированы без изменения. Генерированные исходники сохранены в каталоге Codex, рабочие копии — assets/cars/ttrs-8j-*.png и assets/audi/hero.png.

### Промпт набора игровых спрайтов

Reference — Generated Image November 05, 2026 - 2_10PM.jpg из пользовательской папки.

Use case: precise-object-edit and background-extraction. Asset: high-resolution top-down 2D car sprite for the NEON DRIFT game. Edit the reference Audi TT RS Coupé 8J (2009). Preserve the exact illustrated body silhouette, roof, windows, wheels, mirrors, grille, lamps and black outlines from the reference. Rotate the whole car 180 degrees so its NOSE POINTS RIGHT. Paint ONLY the colored body panels using the requested name, color code and base hex, preserving panel shading and highlights. Keep windows dark grey and all wheels and trim unchanged. Remove the white background completely and output genuine transparent alpha. Single entire car centered horizontally, generous transparent margins, no cropping, orthographic straight overhead, no perspective, no scenery, no text or additional objects. Save a crisp large sprite, long edge at least 1024 pixels.

Отдельный вызов для каждого цвета. Misano Red Pearl LZ3M #B81820, Sepang Blue Pearl LY5Q #183868, Imola Yellow LY1C #F2C21A, Suzuka Grey Metallic LY7F #E2E4E6, Daytona Grey Pearl LZ7S #4B4E53, Panther Black Crystal LZ9Z #19181B.

### Промпт hero

Use case: product-mockup. Create a photorealistic automotive website hero photograph for Audi TT RS Coupé 8J, first generation RS, model year 2009. Reference image supplies the exact car identity and Misano Red Pearl body color; render it as a real production car. It must be the round-bodied 8J TT with the original 2009 rounded headlamps, silver five-spoke alloy wheels, silver mirrors, large oval honeycomb grille, fixed rear wing, compact coupe roof, and quattro stance. Deep red pearl body #B81820. A full car in a front three-quarter view, parked in a quiet modern concrete architectural courtyard at blue hour with cool neutral lighting and soft reflections. Premium Audi product photography, realistic materials, no people. WIDE landscape composition around 2:1 with whole car centered slightly right and substantial clean ground and shadow space along the bottom quarter for HTML title overlay. No text, no watermark, no added signage, no collage. European plate may be blank. Do not depict the angular 2016 8S or an A3. Sharply detailed, restrained colors.


Обновлённые фотоблоки, источник архивного снимка, спецификация 36 студийных кадров и финальные промпты: [MEDIA.md](MEDIA.md).
