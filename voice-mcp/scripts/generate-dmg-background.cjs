const path = require('path');
const sharp = require('sharp');
const fs = require('fs').promises;

const ASSETS_DIR = path.join(__dirname, '../assets');
const WIDTH = 540;
const HEIGHT = 380;

async function generateDmgBackground() {
  try {
    // Create assets directory if it doesn't exist
    await fs.mkdir(ASSETS_DIR, { recursive: true });

    // Create DMG background image
    await sharp({
      create: {
        width: WIDTH,
        height: HEIGHT,
        channels: 4,
        background: { r: 43, g: 43, b: 43, alpha: 1 }
      }
    })
    .composite([
      {
        input: Buffer.from(`
          <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${WIDTH}" height="${HEIGHT}" fill="#2B2B2B"/>
            <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
              Drag VoiceMCP to Applications
            </text>
            <path d="M ${WIDTH/4} ${HEIGHT/2} L ${3*WIDTH/4} ${HEIGHT/2}" stroke="white" stroke-width="2" stroke-dasharray="5,5"/>
          </svg>
        `),
        top: 0,
        left: 0
      }
    ])
    .png()
    .toFile(path.join(ASSETS_DIR, 'dmg-background.png'));

    console.log('✅ DMG background generated successfully');
  } catch (error) {
    console.error('❌ Error generating DMG background:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  generateDmgBackground();
}

module.exports = {
  generateDmgBackground
};
