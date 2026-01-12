#!/usr/bin/env node

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../public');

// Minimal valid 1x1 orange PNG
// Hex: 89 50 4E 47 0D 0A 1A 0A (PNG signature) + IHDR + IDAT + IEND
const orangePNG = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT (orange pixel)
  0x54, 0x08, 0x99, 0x63, 0xF8, 0x73, 0x16, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0xAB, 0x95, 0xF5,
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND
  0xAE, 0x42, 0x60, 0x82
]);

try {
  // Create apple-touch-icon.png
  writeFileSync(join(publicDir, 'apple-touch-icon.png'), orangePNG);
  console.log('✓ Created apple-touch-icon.png');
  
  // Create icons for manifest
  const sizes = [180, 192, 512];
  sizes.forEach(size => {
    const path = join(publicDir, `icons/icon-${size}.png`);
    writeFileSync(path, orangePNG);
    console.log(`✓ Created icon-${size}.png`);
  });
  
  // Create maskable versions
  [192, 512].forEach(size => {
    const path = join(publicDir, `icons/icon-maskable-${size}.png`);
    writeFileSync(path, orangePNG);
    console.log(`✓ Created icon-maskable-${size}.png`);
  });
  
  console.log('\n⚠️  Note: Using 1x1 pixel PNG as placeholder.');
  console.log('For production, use proper image generation with sharp or canvas.');
} catch (error) {
  console.error('Error creating PNG icons:', error.message);
  process.exit(1);
}
