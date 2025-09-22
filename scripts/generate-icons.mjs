import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const root = path.resolve(process.cwd());
const srcSvgWhite = path.join(root, 'assets', 'icons', 'app-logo-white.svg');
const srcSvgDark = path.join(root, 'assets', 'icons', 'app-logo.svg');
const outDir = path.join(root, 'assets', 'icons');

const sizes = [192, 256, 384, 512];
const brandBg = '#111827';
const SCALE_MASKABLE = 0.8; // safe zone recommended
const SCALE_ANY = 0.86; // a bit larger for launcher look

async function run() {
  const svgWhite = await fs.promises.readFile(srcSvgWhite);
  const svgDark = await fs.promises.readFile(srcSvgDark);

  for (const size of sizes) {
    // Maskable: dark tile background + white logo centered
    {
      const outMaskable = path.join(outDir, `icon-${size}-maskable.png`);
      const logoBuf = await sharp(svgWhite, { density: 512 })
        .resize(Math.round(size * SCALE_MASKABLE), Math.round(size * SCALE_MASKABLE), { fit: 'contain' })
        .png()
        .toBuffer();
      await sharp({ create: { width: size, height: size, channels: 4, background: brandBg } })
        .composite([
          {
            input: logoBuf,
            top: Math.round(size * (1 - SCALE_MASKABLE) / 2),
            left: Math.round(size * (1 - SCALE_MASKABLE) / 2)
          }
        ])
        .png()
        .toFile(outMaskable);
      console.log('Wrote', path.relative(root, outMaskable));
    }

    // Regular launcher icon with brand background + white logo (slightly larger scale)
    {
      const outAny = path.join(outDir, `icon-${size}.png`);
      const logoBuf = await sharp(svgWhite, { density: 512 })
        .resize(Math.round(size * SCALE_ANY), Math.round(size * SCALE_ANY), { fit: 'contain' })
        .png()
        .toBuffer();
      await sharp({ create: { width: size, height: size, channels: 4, background: brandBg } })
        .composite([
          {
            input: logoBuf,
            top: Math.round(size * (1 - SCALE_ANY) / 2),
            left: Math.round(size * (1 - SCALE_ANY) / 2)
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
