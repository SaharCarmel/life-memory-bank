import type { Configuration } from 'webpack';
import { rules } from './webpack.rules';
import path from 'path';
import { plugins } from './webpack.plugins';

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
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

export default rendererConfig;
