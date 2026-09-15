// Testa a versão site (pasta site/) servida por HTTP: service worker, manifesto e funcionamento sem internet.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pasta = path.join(raiz, 'site');
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

const servidor = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const ficheiro = path.join(pasta, url === '/' ? 'index.html' : url);
  if (!ficheiro.startsWith(pasta) || !fs.existsSync(ficheiro)) {
    res.writeHead(404);
    return res.end('não encontrado');
  }
  res.writeHead(200, { 'Content-Type': tipos[path.extname(ficheiro)] ?? 'application/octet-stream' });
  fs.createReadStream(ficheiro).pipe(res);
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const endereco = `http://127.0.0.1:${servidor.address().port}/`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const erros = [];
page.on('pageerror', (e) => erros.push(String(e)));
page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
let falhou = false;
try {
  await page.goto(endereco);
  await page.getByText('Bem-vindo ao Gerador de Horários').waitFor({ timeout: 15000 });
  const manifesto = await page.evaluate(() => fetch('./manifest.webmanifest').then((r) => r.json()));
  console.log('• Manifesto:', manifesto.name, manifesto.icons.map((i) => i.sizes).join(', '));
  await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready, null, { timeout: 15000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  console.log('• Service worker ativo');
  await page.getByRole('button', { name: 'Experimentar com uma escola de exemplo' }).click();
  await page.locator('.titulo-projeto strong', { hasText: 'Escola Básica de Exemplo' }).waitFor();
  await page.waitForTimeout(1200);

  await ctx.setOffline(true);
  await page.reload();
  await page.locator('.titulo-projeto strong', { hasText: 'Escola Básica de Exemplo' }).waitFor({ timeout: 15000 });
  console.log('• Sem internet: a aplicação abre e o trabalho continua lá');
  await ctx.setOffline(false);
} catch (e) {
  falhou = true;
  console.error('FALHA:', e.message);
} finally {
  if (erros.length) {
    console.log('Erros:', erros);
  }
  await browser.close();
  servidor.close();
  if (falhou || erros.length) process.exitCode = 1;
  else console.log('Site OK.');
}
