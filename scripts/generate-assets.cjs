const { generateIcon } = require('./generate-icons.cjs');
const { generateDmgBackground } = require('./generate-dmg-background.cjs');

async function generateAssets() {
  try {
    // Generate all assets
    await Promise.all([
      generateIcon(),
      generateDmgBackground()
    ]);
    console.log('✅ All assets generated successfully');
  } catch (error) {
    console.error('❌ Error generating assets:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  generateAssets();
}

module.exports = {
  generateAssets
};
