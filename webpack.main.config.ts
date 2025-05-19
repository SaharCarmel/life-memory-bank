import type { Configuration } from 'webpack';
import { rules } from './webpack.rules';
import path from 'path';

export const mainConfig: Configuration = {
  entry: './src/main/index.ts',
  module: {
    rules,
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@services': path.resolve(__dirname, 'src/shared/services'),
    },
  },
  output: {
    filename: '[name].js',
    chunkFilename: '[name].chunk.js',
  },
};

export default mainConfig;
