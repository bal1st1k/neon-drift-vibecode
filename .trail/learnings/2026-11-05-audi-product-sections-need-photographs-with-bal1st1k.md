---
title: Audi product sections need photographs with credible proportions
author: Bal1st1k
date: 2026-11-05
branch: main
id: l-03985c28
scope: repo
status: active
src: agent
touches:
  - CHANGELOG.md
  - app.js
  - assets/cars/jzx81.png
  - assets/cars/jzx90.png
  - assets/cars/jzz30.png
  - audio.js
  - catalog.js
  - engine.js
  - garage.js
  - index.html
---

## Decided
Use large photographic sections and a studio viewer in the Audi showroom because the user expects the supplied Audi reference's photo-led presentation. In garage.js, renderAudiShop renders the page; app.js opens its photos. Use the top-down game sprite only as an optional race preview because it is not a product photograph. Use an original archive photo for the body-detail card because the user rejected two generated close-ups with distorted front-end proportions.

## Tried and ruled out
The decorative cylinder diagram and giant game sprite were rejected because they did not meet the requested photographic presentation. A second generated close-up was rejected because its front-end proportions became worse.

## Watch out
Inspect the source and browser image aspect ratios because a geometrically poor source cannot be repaired by CSS. Use object-fit contain for whole cars and the archive card because cropping may cut off the bumper. Generated engine imagery is illustrative, not evidence for actual component placement.

In the code: garage.js renderAudiShop, app.js updateAudiPhoto, audi.js, audi.css, assets/audi/detail-archive.webp, assets/audi/MEDIA.md. Archive: https://www.autoevolution.com/cars/audi-tt-rs-coupe-2009.html image 29.
