const esbuild = require('esbuild');
const path = require('path');

const args = process.argv.slice(2);
const watch = args.includes('--watch');
const production = args.includes('--production');

const config = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist/extension.js',
  external: ['vscode'],
  sourcemap: !production,
  minify: production,
  logLevel: 'info'
};

function log(message) {
  console.log(`[esbuild] ${message}`);
}

async function build() {
  log('build start');
  try {
    await esbuild.build(config);
    log('build finished');
  } catch (error) {
    console.error('[esbuild] build failed');
    console.error(error);
    process.exit(1);
  }
}

if (watch) {
  const ctx = esbuild.context(config);
  ctx.then((x) => x.watch()).catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  build();
}
