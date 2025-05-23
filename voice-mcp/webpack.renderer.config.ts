import type { Configuration } from 'webpack';
import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';
import path from 'path';

export const rendererConfig: Configuration = {
  entry: {
    main_window: './src/renderer/index.tsx'
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
    fallback: {
      path: false,
      fs: false,
      crypto: false,
      stream: false,
      util: false,
      assert: false,
      http: false,
      https: false,
      os: false,
      buffer: false,
      url: false,
      zlib: false,
      querystring: false,
      net: false,
      tls: false,
      child_process: false,
    },
  },
  output: {
    filename: '[name].js',
    path: path.join(__dirname, '.webpack'),
    publicPath: 'auto',
    assetModuleFilename: 'assets/[name][ext]',
  },
  target: 'web',
};

export default rendererConfig;
