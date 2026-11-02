# Blackbird — design reference

Reference: https://www.porsche.com/germany/models/911/carrera-models/911-carrera/
Captured 2026-10-30 with Firecrawl (branding, markdown, images and full-page screenshot). Inspected screenshot: artifacts/porsche-reference.png.

## Observed patterns
- Light product page, oversized pale model number behind a large vehicle image, centred model name and compact primary/secondary actions.
- Wide whitespace around specifications, a short row of large performance figures, editorial photography, rounded feature cards and a dark drivetrain chapter.
- Body/heading family reported as Porsche Next; local implementation uses Arial/Helvetica instead of loading a proprietary or remote font.
- Branding output reported white background and #010205 primary text. The sampled #1A44EA accent did not represent the principal black model-page CTA in the inspected screenshot, so the game uses black buttons.
- Reported desktop h1 ~67 px, h2 ~38 px, body 16 px; implementation uses responsive ranges and independent mobile layouts. Spacing and image proportions are adapted, not exact extracted CSS.

## Implementation tokens
- Background #fff; hero #f7f7f7; cards #f2f3f4; text #101216; secondary text #686a70; dark chapter #0c0e12.
- Content gutters 7%, mobile 24 px; feature radius 12 px; buttons 4 px; minimum main button height 48 px.
- One centred vehicle hero, four specs, two-column history, full-width driving photograph, technical accordion and purchase/case section.
- Blackbird uses its supplied top-down sprite and supplied case illustrations. No modern 992 specifications or imagery are used as 930 data.

## Sources and local images
- https://www.porsche.com/stories/innovation/brief-history-of-porsche-911-turbo/ — historical 930 3.3 story, 300 PS, intercooler, 5.4 s heritage reference and autobahn photograph.
- https://www.porsche.com/international/accessoriesandservice/classic/models/911-g/911-turbo/ — model history, rear-wing changes, 1978–89 3.3 variant and bronze archival photograph.
- for promt/blackbird/930-autobahn.jpg — Porsche archival driving image; colour differs from the game car and is presented as archive material.
- for promt/blackbird/930-profile.jpg — Porsche archival front image; retained whole, with archive caption.
- for promt/blackbird/blackbird-hero.webp — purpose-made studio visualisation generated from the user's sprite reference; disclosed in the footer.

The 300 PS / 1300 kg / 225 kg engine / RR specification is the user's game specification. Price 62000 is a game balance choice. Physical RR inertia adjustments are stylised, not an engineering vehicle simulation.
