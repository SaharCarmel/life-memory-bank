import type IForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import type { Configuration } from 'webpack';
import { DefinePlugin } from 'webpack';
import { exec } from 'child_process';
import { promisify } from 'util';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

const execAsync = promisify(exec);

// Custom plugin to run our fix-html-paths script after build
class RunAfterCompilePlugin {
  apply(compiler: any) {
    compiler.hooks.afterEmit.tapAsync('RunAfterCompilePlugin', async (compilation: any, callback: any) => {
      try {
        await execAsync('node scripts/fix-html-paths.js');
        callback();
      } catch (error) {
        console.error('Error running fix-html-paths script:', error);
        callback();
      }
    });
  }
}

export const plugins = [
  new ForkTsCheckerWebpackPlugin({
    logger: 'webpack-infrastructure',
  }),
  new DefinePlugin({
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  }),
  new RunAfterCompilePlugin(),
];

export const devPlugins = [
  ...plugins,
  // Add development-specific plugins here
];

export const prodPlugins = [
  ...plugins,
  // Add production-specific plugins here
];
