---
title: Weather belongs in the visible race setup
author: Bal1st1k
date: 2026-11-05
branch: main
id: l-a85f1f11
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
Weather is a condition of the selected race format. The user expects ordinary races in rain or fog to keep the normal field of four cars. Show race format and weather directly on the home screen beside the start action. Time Attack is solo and Cat & Mouse is the explicit one-opponent format. Random start randomizes car, route and weather for a four-car race.

## Tried and ruled out
The separate Wet Touge entry with one matched opponent made weather look like a different race format. Hiding all new formats behind a small Modes button made them hard to discover. The user explicitly corrected both choices.

## Watch out
Do not infer an opponent-count change from weather. Keep the selected route for ordinary weather races. A random start must show the three chosen opponents in its preparation screen.

In the code:
The visible setup is race-setup in index.html. selectRaceMode, launchRace and prepareMode in app.js route launches, while Engine.reset in engine.js decides the field size independently of weather.
