import type { Configuration } from 'webpack';
import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';
import path from 'path';

export const mainConfig: Configuration = {
  entry: {
    index: './src/main/index.ts'
  },
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@services': path.resolve(__dirname, 'src/shared/services'),
      '@events': path.resolve(__dirname, 'src/shared/events'),
    },
  },
  externals: {
    'electron-squirrel-startup': 'commonjs2 electron-squirrel-startup'
  },
  output: {
    filename: '[name].js',
    path: path.join(__dirname, '.webpack/main'),
    library: {
      type: 'commonjs2',
    },
  },
  target: 'electron-main',
  node: {
    __dirname: false,
    __filename: false,
  },
};

export default mainConfig;
