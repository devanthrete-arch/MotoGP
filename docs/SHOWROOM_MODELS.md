# Virtual showroom models

The showroom at `/showroom` shows the cars listed in `public/showroom/manifest.json`.

## The cars it ships with

Kia Sonet, Maruti Suzuki Baleno, Volkswagen Virtus, Honda Amaze, Honda Elevate and Mahindra XUV700
are built in Blender by `scripts/blender/build_car.py`, from reference photos and each car's
published length, width, height and wheelbase. They are stylised likenesses, not manufacturer
models, and carry no badges or logos.

## Building a car in Blender

`build_car.py` builds a car in Blender (5.2) from a profile spec in the same script, to the model
spec below: one subdivided body with flush glass and pillars (sedan, hatch or SUV glasshouse,
optionally a tapering rear-quarter window), creased lower-door, shoulder and belt lines, boolean
wheel arches and door shut lines, grille, lamps, intakes, skid plates and plates traced onto the
surface, lathe-turned tyres and two-tone alloys, mirrors, handles, wipers, spoiler, aerial, a simple
interior, and on the SUVs arch and sill cladding, roof rails and (Elevate) a black roof.

```
blender --background --factory-startup --python scripts/blender/build_car.py -- maruti-baleno baleno.glb --level 2 --blend baleno.blend
blender --background --factory-startup --python scripts/blender/build_car.py -- maruti-baleno baleno-low.glb --level 1
node scripts/showroom-import.mjs maruti-baleno baleno.glb --low baleno-low.glb
npm run dev
PLAYWRIGHT_CHANNEL=chrome node scripts/showroom-posters.mjs http://localhost:8080
```

`--level` is the body's subdivision: 2 for the full model, 1 for the phone model (which also traces
its details more coarsely to stay inside 40k triangles). The `.blend` is the editable source for
anyone who wants to refine a car by hand. The poster step re-photographs every car for the still
picture shown when a browser cannot draw 3D; to compare changes,
`PLAYWRIGHT_CHANNEL=chrome node scripts/showroom-review.mjs http://localhost:8080 review.jpg` renders
every car from the front three-quarter, the side and the rear three-quarter into one sheet.

`scripts/showroom-cars.mjs` is the earlier, simpler generator. It now only builds a car that has no
imported model; all six are imported, so it changes nothing unless one is removed.

## Replacing a car with a hand-made model

No Indian manufacturer we checked (Tata, Mahindra, Maruti Suzuki, Hyundai) publishes a licence or
media-kit download for its configurator 3D models, so do not take models from their websites.
Commission a model, or use one you have a written commercial licence for.

### The model spec (what to ask an artist for)

- Real scale in metres, Y up, the front facing +X, origin on the ground at the middle of the
  wheelbase and track, transforms applied.
- Materials named `Paint` (one plain-colour material for all body panels; the swatches recolour
  it), `Glass`, `Trim`, `Chrome`, `Tyre`, `Rim`, `Headlamp`, `DRL`, `Taillamp`, `Plate`.
- Full model up to 150,000 triangles; a light model for phones up to 40,000. At most 3 textures of
  2048 px or less, metallic-roughness PBR, ambient occlusion baked.
- No badges, logos or wordmarks; blank plates.
- Delivered as the `.blend` plus uncompressed `<id>.glb` and `<id>-low.glb`.

### Importing it

```
node scripts/showroom-import.mjs maruti-baleno baleno.glb --low baleno-low.glb --author "Artist name" --licence "Commissioned, commercial licence"
```

The script checks both files against the spec (length within 2% of the car's, facing +X with the
headlamps ahead of the tail lamps, wheels on the ground, a `Paint` material, triangle and texture
budgets), then compresses them (Draco geometry; WebP textures, or KTX2 with `--ktx2` when
KTX-Software's `toktx` is installed) to `public/showroom/<id>-model.glb` and
`<id>-model-low.glb`, and points the car's manifest entry at them. Without `--low` it simplifies a
light model from the full one. `--check` only reports; `--yaw 180` (or 90) accepts a model that
faces another way. Imported entries are marked `"imported": true`, and `showroom-cars.mjs` leaves
them alone. Re-shoot the poster afterwards with `scripts/showroom-posters.mjs`.

Phones and devices that fall back to low quality load `srcLow`; everyone else loads `src`.

### Manifest fields

- `id`, `name`, `maker`
- `src`: `/showroom/<file>.glb` (files on this site only; other addresses are ignored)
- `srcLow` (optional): the light model for phones
- `yawDegrees` (optional): turn about the vertical axis for a model that does not face +X
- `ktx2` (optional): `true` when the model's textures are KTX2; the showroom then fetches its KTX2
  loader first (the import script sets this)
- `poster`: a still picture for browsers without WebGL
- `paintMaterials`: names of the body-paint materials the colour swatches recolour
- `lengthMetres`: the car is scaled to this length
- `credit`: `{ "author", "licence", "url" }`, shown under the picker
- `swatches` (optional): `[{ "name", "hex" }]`; without it the manifest's shared `swatches` are used
