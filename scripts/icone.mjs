// Gera os ícones PNG da aplicação a partir de build/icon.svg.

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(raiz, 'build/icon.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });

for (const [tamanho, destino] of [
  [1024, 'build/icon.png'],
  [512, 'electron/icon.png'],
  [192, 'build/icon-192.png'],
]) {
  await page.setViewportSize({ width: tamanho, height: tamanho });
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><img width="${tamanho}" height="${tamanho}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`,
  );
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(raiz, destino), omitBackground: true, clip: { x: 0, y: 0, width: tamanho, height: tamanho } });
  console.log('Criado', destino);
}
await browser.close();
