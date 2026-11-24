import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const distAssetsDir = path.join(root, 'dist', 'assets');
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');

if (!fs.existsSync(distAssetsDir)) {
  throw new Error('dist/assets not found. Run "vite build" first.');
}

const cssFile = fs.readdirSync(distAssetsDir).find((f) => f.endsWith('.css'));
if (!cssFile) {
  throw new Error('Compiled CSS file not found in dist/assets.');
}
const cssContent = fs.readFileSync(path.join(distAssetsDir, cssFile), 'utf-8');

const svgPath = path.join(publicDir, 'icon.svg');
const iconHref = fs.existsSync(svgPath)
  ? `data:image/svg+xml;base64,${fs.readFileSync(svgPath).toString('base64')}`
  : '';

const pwaStubPlugin = {
  name: 'pwa-register-stub',
  setup(build) {
    build.onResolve({ filter: /^virtual:pwa-register$/ }, () => ({
      path: 'virtual:pwa-register',
      namespace: 'pwa-stub',
    }));
    build.onLoad({ filter: /.*/, namespace: 'pwa-stub' }, () => ({
      contents: 'export function registerSW() { return function () {}; }',
      loader: 'js',
    }));
  },
};

const result = await esbuild.build({
  entryPoints: [path.join(root, 'src', 'main.tsx')],
  bundle: true,
  minify: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  jsx: 'automatic',
  loader: {
    '.css': 'empty',
  },
  define: {
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
    'import.meta.env.MODE': '"production"',
    'process.env.NODE_ENV': '"production"',
  },
  plugins: [pwaStubPlugin],
});

const rawJs = result.outputFiles[0].text;
// Prevent literal </script> inside bundled strings from closing the HTML <script> tag prematurely
const safeJs = rawJs.replace(/<\/script/gi, '<\\/script');
const safeCss = cssContent.replace(/<\/style/gi, '<\\/style');

const html = `<!doctype html>
<html lang="mn" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#111715" />
    <title>PanelFlow Studio — Мэргэжлийн Manga &amp; Comic Editor</title>
    <meta name="description" content="Мэргэжлийн Manga, Manhwa, Webtoon орчуулга ба эдит студи — Non-destructive давхарга, ухаалаг цэвэрлэгч, текст ба бийрний систем." />
    ${iconHref ? `<link rel="icon" type="image/svg+xml" href="${iconHref}" />` : ''}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Comfortaa:wght@500;700&family=JetBrains+Mono:wght@400;600&family=Montserrat:ital,wght@0,500;0,700;0,900;1,700&family=Oswald:wght@500;700&family=Playfair+Display:ital,wght@0,600;0,800;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Roboto:ital,wght@0,400;0,700;0,900;1,400&family=Rubik:ital,wght@0,500;0,800;1,500&family=Russo+One&display=swap" rel="stylesheet" />
    <style>${safeCss}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>${safeJs}</script>
  </body>
</html>
`;

fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'PanelFlow-Studio.html'), html, 'utf-8');
if (fs.existsSync(distDir)) {
  fs.writeFileSync(path.join(distDir, 'PanelFlow-Studio.html'), html, 'utf-8');
}

const kb = Math.round(Buffer.byteLength(html, 'utf-8') / 1024);
console.log(`Built standalone single-file HTML: public/PanelFlow-Studio.html (${kb} KB)`);
