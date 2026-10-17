// Brings a hand-made car model into the virtual showroom: checks it against the model spec
// (docs/SHOWROOM_MODELS.md), compresses it for phones and adds it to public/showroom/manifest.json.
//
//   node scripts/showroom-import.mjs <car-id> <full.glb> [options]
//
//   --low <file>       the artist's light model; without it one is simplified from the full model
//   --length <metres>  expected length; defaults to the car's current manifest entry
//   --yaw <degrees>    turn applied in the showroom, for a model that does not face +X
//   --ktx2             compress textures to KTX2 (needs KTX-Software's `toktx` on the PATH);
//                      otherwise they become WebP
//   --name, --maker, --author, --licence, --url    manifest details for a new car or its credit
//   --check            only check the files; write nothing
//
// Writes public/showroom/<car-id>-model.glb and <car-id>-model-low.glb, and marks the manifest
// entry "imported" so scripts/showroom-cars.mjs leaves it alone. Exits 1 when a check fails.
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, draco, getBounds, prune, simplify, textureCompress, weld } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

/** The spec's limits. */
export const budgets = {
  full: { triangles: 150_000, bytes: 3_000_000 },
  low: { triangles: 40_000, bytes: 1_200_000 },
  textures: 3,
  textureSize: 2048,
  lengthTolerance: 0.02,
};

/** Triangles drawn by every mesh in the scene, counting each mesh once per node that uses it. */
export function countTriangles(document) {
  let total = 0;
  for (const node of document.getRoot().listNodes()) {
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      if (primitive.getMode() !== 4) continue; // TRIANGLES only; strips and fans are not in the spec.
      const count = primitive.getIndices()?.getCount() ?? primitive.getAttribute("POSITION")?.getCount() ?? 0;
      total += count / 3;
    }
  }
  return Math.round(total);
}

const transform = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

/** Average world-space x of the vertices drawn with a material, or null when nothing uses it. */
function meanX(document, materialName) {
  let sum = 0, count = 0;
  for (const node of document.getRoot().listNodes()) {
    const matrix = node.getWorldMatrix();
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      if (primitive.getMaterial()?.getName() !== materialName) continue;
      const positions = primitive.getAttribute("POSITION");
      const point = [0, 0, 0];
      for (let i = 0; i < positions.getCount(); i++) {
        sum += transform(matrix, positions.getElement(i, point))[0];
        count++;
      }
    }
  }
  return count ? sum / count : null;
}

/**
 * Checks a model against the spec. `problems` fail the import; `warnings` are worth a look.
 * `yawDegrees` is the turn the showroom will apply, so a model facing -X passes with yaw 180.
 */
export function checkModel(document, { lengthMetres, maxTriangles = budgets.full.triangles, yawDegrees = 0 }) {
  const problems = [], warnings = [];
  const root = document.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (!scene) return { problems: ["The file has no scene."], warnings, stats: {} };

  const materials = root.listMaterials();
  const paint = materials.find((material) => material.getName() === "Paint");
  if (!paint) problems.push(`No material named "Paint", so the colour swatches cannot recolour the body. Materials found: ${materials.map((m) => m.getName() || "(unnamed)").join(", ") || "none"}.`);
  else if (paint.getBaseColorTexture()) problems.push(`"Paint" has a colour texture; the showroom sets the paint colour itself, so it must be a plain colour.`);

  const triangles = countTriangles(document);
  if (triangles > maxTriangles) problems.push(`${triangles.toLocaleString("en")} triangles, over the ${maxTriangles.toLocaleString("en")} budget.`);

  const textures = root.listTextures();
  if (textures.length > budgets.textures) problems.push(`${textures.length} textures, over the limit of ${budgets.textures}.`);
  for (const texture of textures) {
    const [width = 0, height = 0] = texture.getSize() ?? [];
    if (Math.max(width, height) > budgets.textureSize) problems.push(`Texture "${texture.getName() || texture.getURI() || "unnamed"}" is ${width}×${height}; the limit is ${budgets.textureSize} px.`);
  }

  const { min, max } = getBounds(scene);
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const quarterTurns = Math.round((((yawDegrees % 360) + 360) % 360) / 90) % 4;
  const turned = quarterTurns % 2 === 1;
  const along = turned ? size[2] : size[0], across = turned ? size[0] : size[2];
  if (across > along) problems.push(`The car is longer along ${turned ? "X" : "Z"} (${across.toFixed(2)} m) than along ${turned ? "Z" : "X"} (${along.toFixed(2)} m): it does not face +X. Turn it in Blender, or pass --yaw 90.`);
  if (lengthMetres) {
    const error = Math.abs(along - lengthMetres) / lengthMetres;
    if (error > budgets.lengthTolerance) problems.push(`Length is ${along.toFixed(3)} m; expected ${lengthMetres} m within ${budgets.lengthTolerance * 100}%. Check the export scale is metres.`);
  }
  if (Math.abs(min[1]) > 0.02) warnings.push(`The lowest point is at y = ${min[1].toFixed(3)} m, not on the ground (y = 0). The showroom will move it down, but check the pivot.`);
  const centre = [(min[0] + max[0]) / 2, (min[2] + max[2]) / 2];
  if (Math.hypot(...centre) > 0.05) warnings.push(`The model is ${Math.hypot(...centre).toFixed(2)} m off centre. The showroom will centre it, but check the pivot.`);

  // Headlamps belong at the front (+X before the yaw), tail lamps at the back.
  const facing = quarterTurns === 2 ? -1 : 1;
  const head = meanX(document, "Headlamp"), tail = meanX(document, "Taillamp");
  if (!turned && head !== null && tail !== null && Math.sign(head - tail) !== facing) {
    problems.push(`The headlamps are behind the tail lamps along X: the car faces ${facing > 0 ? "-X" : "+X"}. Turn it in Blender, or pass --yaw ${facing > 0 ? 180 : 0}.`);
  }
  if (head === null) warnings.push(`No "Headlamp" material, so which way the car faces could not be checked.`);

  return { problems, warnings, stats: { triangles, textures: textures.length, size } };
}

async function createIO() {
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "draco3d.encoder": await draco3d.createEncoderModule(),
  });
}

/** Compresses a document in place for the web: duplicates and unused data removed, geometry Draco-compressed. */
async function optimise(document, { textures }) {
  await document.transform(dedup(), prune(), weld());
  if (textures === "webp") {
    await document.transform(textureCompress({ encoder: sharp, targetFormat: "webp", resize: [budgets.textureSize, budgets.textureSize] }));
  }
  await document.transform(draco());
}

/** A light model simplified from the full one, for when the artist did not supply one. */
async function simplifyToBudget(document) {
  await MeshoptSimplifier.ready;
  await document.transform(weld());
  const triangles = countTriangles(document);
  if (triangles <= budgets.low.triangles) return;
  await document.transform(simplify({ simplifier: MeshoptSimplifier, ratio: (budgets.low.triangles * 0.95) / triangles, error: 0.02 }));
}

function toKtx2(file) {
  try {
    execFileSync("toktx", ["--version"], { stdio: "ignore" });
  } catch {
    throw new Error("--ktx2 needs KTX-Software's `toktx` on the PATH (https://github.com/KhronosGroup/KTX-Software/releases). Install it, or leave out --ktx2 to use WebP.");
  }
  const cli = path.resolve("node_modules/@gltf-transform/cli/bin/cli.js");
  execFileSync(process.execPath, [cli, "etc1s", file, file, "--slots", "{baseColorTexture,emissiveTexture}"], { stdio: "inherit" });
  execFileSync(process.execPath, [cli, "uastc", file, file], { stdio: "inherit" });
}

function report(label, { problems, warnings, stats }) {
  console.log(`\n${label}: ${stats.triangles?.toLocaleString("en") ?? "?"} triangles, ${stats.textures ?? "?"} textures, ${stats.size?.map((v) => v.toFixed(2)).join(" × ") ?? "?"} m`);
  for (const line of problems) console.log(`  ✗ ${line}`);
  for (const line of warnings) console.log(`  ! ${line}`);
  if (!problems.length) console.log("  ✓ meets the spec");
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      low: { type: "string" }, length: { type: "string" }, yaw: { type: "string" }, ktx2: { type: "boolean" },
      name: { type: "string" }, maker: { type: "string" }, author: { type: "string" }, licence: { type: "string" }, url: { type: "string" },
      check: { type: "boolean" },
    },
  });
  const [id, fullPath] = positionals;
  if (!id || !fullPath || !/^[a-z0-9-]+$/.test(id)) {
    console.error("Usage: node scripts/showroom-import.mjs <car-id> <full.glb> [--low low.glb] [--length metres] [--yaw degrees] [--ktx2] [--check]");
    process.exit(2);
  }
  const manifestPath = "public/showroom/manifest.json";
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const existing = manifest.cars.find((car) => car.id === id);
  const lengthMetres = Number(values.length ?? existing?.lengthMetres);
  if (!Number.isFinite(lengthMetres)) {
    console.error(`No length known for "${id}": pass --length <metres>.`);
    process.exit(2);
  }
  const yawDegrees = Number(values.yaw ?? existing?.yawDegrees ?? 0);

  const io = await createIO();
  const full = await io.read(fullPath);
  const fullCheck = checkModel(full, { lengthMetres, yawDegrees });
  report(`Full model (${fullPath})`, fullCheck);

  const low = await io.read(values.low ?? fullPath);
  if (!values.low) await simplifyToBudget(low);
  const lowCheck = checkModel(low, { lengthMetres, yawDegrees, maxTriangles: budgets.low.triangles });
  report(values.low ? `Light model (${values.low})` : "Light model (simplified from the full model)", lowCheck);

  if (fullCheck.problems.length || lowCheck.problems.length) {
    console.log("\nNot imported: fix the problems above and run it again.");
    process.exit(1);
  }
  if (values.check) return;

  const textures = values.ktx2 ? "ktx2" : "webp";
  const outputs = [[full, `public/showroom/${id}-model.glb`, budgets.full.bytes], [low, `public/showroom/${id}-model-low.glb`, budgets.low.bytes]];
  for (const [document, file, limit] of outputs) {
    await optimise(document, { textures });
    writeFileSync(file, await io.writeBinary(document));
    if (textures === "ktx2") toKtx2(file);
    const bytes = statSync(file).size;
    console.log(`${file}: ${(bytes / 1e6).toFixed(2)} MB${bytes > limit ? `, over the ${(limit / 1e6).toFixed(1)} MB budget` : ""}`);
    if (bytes > limit) process.exitCode = 1;
  }
  if (process.exitCode) {
    console.log("\nThe files are written but too large for phones; reduce textures or triangles and import again.");
    return;
  }

  const credit = {
    author: values.author ?? existing?.credit?.author ?? "",
    licence: values.licence ?? existing?.credit?.licence ?? "",
    url: values.url ?? existing?.credit?.url ?? "",
  };
  const entry = {
    ...existing,
    id,
    name: values.name ?? existing?.name ?? id,
    maker: values.maker ?? existing?.maker ?? "",
    src: `/showroom/${id}-model.glb`,
    srcLow: `/showroom/${id}-model-low.glb`,
    poster: existing?.poster ?? `/showroom/${id}.jpg`,
    paintMaterials: ["Paint"],
    lengthMetres,
    ...(yawDegrees ? { yawDegrees } : {}),
    credit,
    swatches: existing?.swatches ?? manifest.swatches,
    // Tells the showroom to fetch its KTX2 loader before this car's model.
    ktx2: textures === "ktx2",
    imported: true,
  };
  if (!yawDegrees) delete entry.yawDegrees;
  if (!entry.ktx2) delete entry.ktx2;
  manifest.cars = existing ? manifest.cars.map((car) => (car.id === id ? entry : car)) : [...manifest.cars, entry];
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\n${manifestPath}: "${id}" now uses the imported model. Re-shoot its poster with scripts/showroom-posters.mjs.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message ?? error); process.exit(1); });
}
