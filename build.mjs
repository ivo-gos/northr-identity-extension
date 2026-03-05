import * as esbuild from 'esbuild';
import { cpSync, mkdirSync } from 'fs';

const isWatch = process.argv.includes('--watch');

// Shared build options
const sharedOptions = {
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch,
  target: 'chrome110',
  format: 'esm',
};

async function build() {
  // Ensure dist directories exist
  mkdirSync('dist/popup', { recursive: true });
  mkdirSync('dist/background', { recursive: true });
  mkdirSync('dist/content', { recursive: true });
  mkdirSync('dist/icons', { recursive: true });

  // Build popup
  await esbuild.build({
    ...sharedOptions,
    entryPoints: ['src/popup/popup.ts'],
    outfile: 'dist/popup/popup.js',
  });

  // Build background service worker (iife for SW context)
  await esbuild.build({
    ...sharedOptions,
    entryPoints: ['src/background/service-worker.ts'],
    outfile: 'dist/background/service-worker.js',
    format: 'iife',
  });

  // Build content scripts (iife — no module support in content scripts)
  const contentScripts = ['chatgpt', 'claude', 'gemini'];
  for (const script of contentScripts) {
    await esbuild.build({
      ...sharedOptions,
      entryPoints: [`src/content/${script}.ts`],
      outfile: `dist/content/${script}.js`,
      format: 'iife',
    });
  }

  // Copy static assets
  cpSync('src/popup/popup.html', 'dist/popup/popup.html');
  cpSync('src/popup/popup.css', 'dist/popup/popup.css');
  cpSync('manifest.json', 'dist/manifest.json');
  cpSync('icons', 'dist/icons', { recursive: true });

  console.log('✅ Build complete! Load the dist/ folder in chrome://extensions');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
