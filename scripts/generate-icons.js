import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const publicDir = resolve(__dirname, '../public');
const iconsDir = resolve(publicDir, 'icons');

// Ensure icons directory exists
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

// Read the SVG source
const svgContent = readFileSync(resolve(iconsDir, 'icon.svg'));
const maskableSvgContent = readFileSync(resolve(iconsDir, 'icon-maskable.svg'));

// Icon sizes to generate
const sizes = [48, 72, 96, 128, 144, 152, 180, 192, 256, 384, 512];

async function generateIcons() {
  console.log('🎨 Generating PWA icons...');

  // Generate regular icons
  for (const size of sizes) {
    await sharp(svgContent)
      .resize(size, size)
      .png()
      .toFile(resolve(iconsDir, `icon-${size}.png`));
    console.log(`  ✓ icon-${size}.png`);
  }

  // Generate maskable icons (with padding for safe zone)
  for (const size of sizes) {
    await sharp(maskableSvgContent)
      .resize(size, size)
      .png()
      .toFile(resolve(iconsDir, `icon-maskable-${size}.png`));
    console.log(`  ✓ icon-maskable-${size}.png`);
  }

  // Generate apple-touch-icon (180x180 is standard)
  await sharp(svgContent)
    .resize(180, 180)
    .png()
    .toFile(resolve(publicDir, 'apple-touch-icon.png'));
  console.log('  ✓ apple-touch-icon.png');

  // Generate favicon.ico alternative as PNG
  await sharp(svgContent)
    .resize(32, 32)
    .png()
    .toFile(resolve(publicDir, 'favicon-32.png'));
  console.log('  ✓ favicon-32.png');

  console.log('✅ All icons generated successfully!');
}

generateIcons().catch((err) => {
  console.error('❌ Error generating icons:', err);
  process.exit(1);
});
