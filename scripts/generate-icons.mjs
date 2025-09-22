import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const root = path.resolve(process.cwd());
const srcSvgWhite = path.join(root, 'assets', 'icons', 'app-logo-white.svg');
const srcSvgDark = path.join(root, 'assets', 'icons', 'app-logo.svg');
const outDir = path.join(root, 'assets', 'icons');

const sizes = [192, 256, 384, 512];
const brandBg = '#111827';

async function run() {
  const svgWhite = await fs.promises.readFile(srcSvgWhite);
  const svgDark = await fs.promises.readFile(srcSvgDark);

  const SCALE = 0.72; // keep content inside mask safe zone
  for (const size of sizes) {
    // Maskable: transparent background + centered dark logo
    {
      const outMaskable = path.join(outDir, `icon-${size}-maskable.png`);
      const logoBuf = await sharp(svgDark, { density: 512 })
        .resize(Math.round(size * SCALE), Math.round(size * SCALE), { fit: 'contain' })
        .png()
        .toBuffer();
      await sharp({ create: { width: size, height: size, channels: 4, background: { r:0, g:0, b:0, alpha:0 } } })
        .composite([
          {
            input: logoBuf,
            top: Math.round(size * (1 - SCALE) / 2),
            left: Math.round(size * (1 - SCALE) / 2)
          }
        ])
        .png()
        .toFile(outMaskable);
      console.log('Wrote', path.relative(root, outMaskable));
    }

    // Regular launcher icon with brand background + white logo
    {
      const outAny = path.join(outDir, `icon-${size}.png`);
      const logoBuf = await sharp(svgWhite, { density: 512 })
        .resize(Math.round(size * SCALE), Math.round(size * SCALE), { fit: 'contain' })
        .png()
        .toBuffer();
      await sharp({ create: { width: size, height: size, channels: 4, background: brandBg } })
        .composite([
          {
            input: logoBuf,
            top: Math.round(size * (1 - SCALE) / 2),
            left: Math.round(size * (1 - SCALE) / 2)
          }
        ])
        .png()
        .toFile(outAny);
      console.log('Wrote', path.relative(root, outAny));
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
