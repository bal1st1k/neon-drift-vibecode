# NEON DRIFT 3.5.0 — audio verification

2026-10-28. Original offline WebAudio synthesis; no downloaded recordings or dependencies.

- All 19 catalog engines resolve to explicit profiles. All five stock Lancer Evos resolve to the same 4G63T profile. Swaps resolve by the installed engine.
- Distinct exhaust spectra, RPM ranges, intake/cam character, low body tone, turbo spool and pressure release. Turbo/exhaust upgrades affect audio through effective tuning levels, including cards.
- Automatic audio gears use speed, load and hysteresis. Pausing preserves the current gear; switching between six- and five-speed profiles resets it safely.
- One reusable audio graph; switching every engine and sustained driving create no additional continuous nodes. Periodic waves are cached, capped at the 19 profiles.
- Sound toggles, pause, gesture unlock, rejected resume, unsupported contexts, music and complete disposal covered by the existing smoke suite.

Validation: `node tests/smoke.cjs` — **33 checks passed**.

Browser validation: `tests/audio-preview.html` rendered the production graph for every engine using OfflineAudioContext: idle, acceleration/shifts, lift, acceleration and stop. **19/19 passed**: finite non-silent output, no clipping and quiet tail after stop. This validates rendered signals and lifecycle, not measured acoustic fidelity to real engines.

Evidence:

- `proofs/engine-audio-metrics.json` — peak/RMS/tail for all 19 outputs.
- `proofs/engine-audio-preview.png` — browser results.
- `proofs/engine-comparison.wav` — 8 × 7-second clips: Akina, Project D, S2000, Evo, RX-7, Subaru, GT-R, Supra.

No player save was changed during audio QA. Refresh an existing game tab to load 3.5.0.
