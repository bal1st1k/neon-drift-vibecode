# Roadster cutouts

Built-in imagegen, background-extraction edits. Original supplied JPEGs remain in `for promt/Всегда правильный ответ/`. The three generated files were copied into this project; runtime car texture is compiled with `node tools/prepare-car-sprites.cjs na6ce`.

## Sprite → `na6ce-cutout.png`, runtime `../cars/na6ce.png`

Use case: background-extraction. Edit target: supplied red Mazda Roadster NA6CE top-down game sprite. Remove ONLY the white background and return true transparent alpha around the complete car. Preserve the exact car shape, red paint, black roof, closed popup headlights, black outlines, mirrors, wheels and interior details. Strict top-down orthographic view, horizontal orientation with nose pointing LEFT, entire car including both mirrors inside frame with small transparent padding. No shadows, no text, no added objects. Do not redesign the car.

## Closed case → `../cases/roadster-closed.png`

Use case: background-extraction. Edit target: the supplied closed red SMILES PER HOUR POP-UP case. Remove only the white background and return actual transparent alpha. Preserve exactly the entire closed box, black corner protectors, latches, red painted panels, popup headlight drawing and all lettering: SMILES PER HOUR and POP-UP. Keep front view and horizontal composition, no shadows, no changes to box design, full object inside frame with small transparent padding.

## Open case → `../cases/roadster-open.png`

Use case: background-extraction. Edit target: supplied OPEN red SMILES PER HOUR POP-UP case. Remove only white background to real transparent alpha. Keep box OPEN as shown, identical lid angle and empty interior, front-facing view. Preserve red panels, black corner guards, metal latches, popup headlight outline graphic, and exact lettering SMILES PER HOUR and POP-UP. No new objects, no shadow, no redesign. Entire object inside frame with small transparent padding.
