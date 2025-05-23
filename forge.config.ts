import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';

const config: ForgeConfig = {
  packagerConfig: {
    icon: './assets/icon',
    // Temporarily disable ASAR to debug packaging issues
    asar: false,
    // Add ignore patterns to exclude problematic files/directories
    ignore: [
      // Ignore Python virtual environments
      /python\/\.venv/,
      /python\/__pycache__/,
      /\.pyc$/,
      // Ignore common development files
      /\.git/,
      /\.vscode/,
      /\.DS_Store/,
      /node_modules\/\.cache/,
      // Ignore memory bank and other non-essential directories
      /memory-bank/,
      /out/,
      // Ignore any other problematic patterns
      /\.log$/,
      /\.tmp$/,
      // Ignore temporary files
      /\.swp$/,
      /\.swo$/,
      /~$/,
      // Ignore large model files if present
      /models/,
      // Note: DO NOT ignore .webpack directory - it contains the compiled output!
    ],
  },
  rebuildConfig: {
    // Force rebuild of native modules
    force: true
  },
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
    new MakerDMG({})
  ],
  plugins: [
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            name: 'main_window',
            html: './src/index.html',
            js: './src/renderer/index.tsx',
            preload: {
              js: './src/preload.ts'
            }
          }
        ]
      },
      port: 3000,
      loggerPort: 9000,
      devContentSecurityPolicy: `default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-eval' 'unsafe-inline' data:`
    })
  ]
};

export default config;
