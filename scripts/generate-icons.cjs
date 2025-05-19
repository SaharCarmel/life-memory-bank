const path = require('path');
const sharp = require('sharp');
const fs = require('fs').promises;

const ICON_SIZES = [16, 32, 64, 128, 256, 512, 1024];
const ASSETS_DIR = path.join(__dirname, '../assets');

async function generateIcon() {
  try {
    // Create assets directory if it doesn't exist
    await fs.mkdir(ASSETS_DIR, { recursive: true });

    // Create base icon from SVG
    const baseIcon = await sharp(Buffer.from(`
      <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
        <rect width="1024" height="1024" fill="#2B2B2B"/>
        <circle cx="512" cy="512" r="256" fill="#4A90E2"/>
        <rect x="472" y="256" width="80" height="512" rx="40" fill="white"/>
        <circle cx="512" cy="512" r="128" fill="#2B2B2B"/>
      </svg>
    `)).toBuffer();

    // Save PNG version
    await sharp(baseIcon)
      .png()
      .toFile(path.join(ASSETS_DIR, 'icon.png'));
    console.log('✅ PNG icon generated');

    // Generate different sizes for ICNS
    for (const size of ICON_SIZES) {
      await sharp(baseIcon)
        .resize(size, size)
        .png()
        .toFile(path.join(ASSETS_DIR, `icon_${size}.png`));
    }

    console.log('✅ All icon sizes generated successfully');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

module.exports = {
  generateIcon
};
