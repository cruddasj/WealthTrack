import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const root = path.resolve(process.cwd());
const srcSvgWhite = path.join(root, 'assets', 'icons', 'app-logo-white.svg');
const srcSvgDark = path.join(root, 'assets', 'icons', 'app-logo.svg');
const outDir = path.join(root, 'assets', 'icons');

const sizes = [192, 512];
const brandBg = '#111827';

async function run() {
  const svgWhite = await fs.promises.readFile(srcSvgWhite);
  const svgDark = await fs.promises.readFile(srcSvgDark);

  for (const size of sizes) {
    // Maskable: transparent background; the OS provides background
    const outMaskable = path.join(outDir, `icon-${size}-maskable.png`);
    await sharp(svgDark, { density: 512 })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outMaskable);
    console.log('Wrote', path.relative(root, outMaskable));

    // Regular launcher icon with brand background
    const outAny = path.join(outDir, `icon-${size}.png`);
    await sharp({ create: { width: size, height: size, channels: 4, background: brandBg } })
      .composite([
        {
          input: await sharp(svgWhite, { density: 512 })
            .resize(Math.round(size * 0.72), Math.round(size * 0.72), { fit: 'contain' })
            .png()
            .toBuffer(),
          top: Math.round(size * (1 - 0.72) / 2),
          left: Math.round(size * (1 - 0.72) / 2)
        }
      ])
      .png()
      .toFile(outAny);
    console.log('Wrote', path.relative(root, outAny));
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
