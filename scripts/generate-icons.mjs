import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const root = path.resolve(process.cwd());
const srcSvg = path.join(root, 'assets', 'icons', 'app-logo-white.svg');
const outDir = path.join(root, 'assets', 'icons');

const sizes = [192, 512];

async function run() {
  const svg = await fs.promises.readFile(srcSvg);

  await Promise.all(
    sizes.map(async (size) => {
      const out = path.join(outDir, `icon-${size}-maskable.png`);
      await sharp(svg, { density: 512 })
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(out);
      console.log('Wrote', path.relative(root, out));
    })
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

