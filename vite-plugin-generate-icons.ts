import type { Plugin } from 'vite';
import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

export function generateIconsPlugin(): Plugin {
  return {
    name: 'generate-icons',
    async buildStart() {
      const publicDir = resolve(process.cwd(), 'public');
      const iconsDir = resolve(publicDir, 'icons');

      // Ensure icons directory exists
      if (!existsSync(iconsDir)) {
        mkdirSync(iconsDir, { recursive: true });
      }

      try {
        // Read the SVG source
        const svgContent = readFileSync(resolve(iconsDir, 'icon.svg'));
        const maskableSvgContent = readFileSync(resolve(iconsDir, 'icon-maskable.svg'));

        // Icon sizes to generate
        const sizes = [48, 72, 96, 128, 144, 152, 180, 192, 256, 384, 512];

        console.log('🎨 Generating PWA icons...');

        // Generate regular icons
        for (const size of sizes) {
          await sharp(svgContent)
            .resize(size, size)
            .png()
            .toFile(resolve(iconsDir, `icon-${size}.png`));
        }

        // Generate maskable icons
        for (const size of sizes) {
          await sharp(maskableSvgContent)
            .resize(size, size)
            .png()
            .toFile(resolve(iconsDir, `icon-maskable-${size}.png`));
        }

        // Generate apple-touch-icon (180x180 is standard)
        await sharp(svgContent)
          .resize(180, 180)
          .png()
          .toFile(resolve(publicDir, 'apple-touch-icon.png'));

        // Generate favicon as PNG
        await sharp(svgContent)
          .resize(32, 32)
          .png()
          .toFile(resolve(publicDir, 'favicon-32.png'));

        console.log('✅ All PWA icons generated!');
      } catch (error) {
        console.warn('⚠️ Could not generate PNG icons:', error);
        console.warn('   SVG icons will be used as fallback.');
      }
    },
  };
}
