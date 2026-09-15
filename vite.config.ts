import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Gera um único ficheiro HTML (dist/index.html) com todo o código embutido,
// para poder ser aberto com duplo clique, sem servidor e sem internet.
export default defineConfig({
  base: './',
  plugins: [preact(), viteSingleFile()],
  define: {
    __VERSAO__: JSON.stringify(pkg.version),
    // "dono/repositório" no GitHub (definido automaticamente no GitHub Actions), para as ligações de descarga.
    __REPOSITORIO__: JSON.stringify(process.env.GDH_REPOSITORIO ?? process.env.GITHUB_REPOSITORY ?? ''),
  },
  worker: {
    // Worker clássico: funciona a partir de blob mesmo em páginas file:// (aplicação de computador).
    format: 'iife',
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120_000,
  },
});
