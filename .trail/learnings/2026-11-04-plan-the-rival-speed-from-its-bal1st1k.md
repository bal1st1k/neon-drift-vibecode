---
title: Plan the rival speed from its own racing line
author: Bal1st1k
date: 2026-11-04
branch: main
id: l-6324efb1
scope: repo
status: active
src: agent
touches:
  - CHANGELOG.md
  - app.js
  - assets/cars/jzx81.png
  - assets/cars/jzx90.png
  - assets/cars/jzz30.png
  - catalog.js
  - engine.js
  - garage.js
  - index.html
  - progress.js
---

## Decided
Build the rival speed plan from its own racing-line curvature, the same tire yaw equation as the player, and the build's real power and brakes. In single-rival modes choose from the top three estimated lines. Keep all ten available across regular races.

## Tried and ruled out
Giving AI ten line shapes alone did not make it competitive. The old plan capped each shape with a centerline profile that had already reserved braking distance, then applied another conservative brake pass and fixed pace discounts. Removing the centerline cap without using the actual tire limit still left the AE85 behind on some wet routes.

## Watch out
Compare whole-race times on the same build, route and weather, from the same start distance or with the duel delay subtracted. Keep the speed-bounded distance update and the player's build limits when adjusting AI. Line ranks are estimated times.

In the code:
Use the comparative autopilot checks in tests/smoke.cjs around the competitive Akina lines. In engine.js the planner is _rankRacingLines, controller is _updateRivals, and the shared tire coefficients are tireYawScale and tireYawOffset.
