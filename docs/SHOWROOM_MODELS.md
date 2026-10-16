# Virtual showroom models

The showroom at `/showroom` shows the cars listed in `public/showroom/manifest.json`.

## The cars it ships with

Kia Sonet, Maruti Suzuki Baleno, Volkswagen Virtus, Honda Amaze, Honda Elevate and Mahindra XUV700
are modelled from scratch by `scripts/showroom-cars.mjs`: bodies lofted at each car's published
length, width, height and wheelbase, with their own grille, lamps, wheels and trim. They are
stylised likenesses, not manufacturer models, and carry no badges or logos.

To change one, edit its entry in that script, then:

```
node scripts/showroom-cars.mjs
npx @gltf-transform/cli draco public/showroom/<id>.glb public/showroom/<id>.glb
npm run dev
PLAYWRIGHT_CHANNEL=chrome node scripts/showroom-posters.mjs http://localhost:8080
```

The last step re-photographs every car for the still picture shown when a browser cannot draw 3D.
To compare changes, `PLAYWRIGHT_CHANNEL=chrome node scripts/showroom-review.mjs http://localhost:8080 review.jpg`
renders every car from the front three-quarter, the side and the rear three-quarter into one sheet.

## Adding a licensed model

No Indian manufacturer we checked (Tata, Mahindra, Maruti Suzuki, Hyundai) publishes a licence or
media-kit download for its configurator 3D models, so do not take models from their websites.
Use a file you have a written licence for, or one under CC0 or CC-BY (credit the author).

1. Put the `.glb` in `public/showroom/`. Draco or meshopt compression is fine and recommended.
2. Add an entry to `cars` in `manifest.json`:
   - `id`, `name`, `maker`
   - `src`: `/showroom/<file>.glb` (files on this site only; other addresses are ignored)
   - `poster`: a still picture for browsers without WebGL
   - `paintMaterials`: names of the body-paint materials the colour swatches recolour
   - `lengthMetres`: the car is scaled to this length
   - `credit`: `{ "author", "licence", "url" }`, shown under the picker
   - `swatches` (optional): `[{ "name", "hex" }]`; without it the manifest's shared `swatches` are used
