// Gera os ícones da aplicação a partir de build/icon.svg:
//  - build/icon.png (1024), electron/icon.png (512), build/icon-192.png (site)
//  - build/documento.icns (macOS) e build/documento.ico (Windows): ícone dos ficheiros .horario e .ficha

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(raiz, 'build/icon.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });

async function png(tamanho) {
  await page.setViewportSize({ width: tamanho, height: tamanho });
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><img width="${tamanho}" height="${tamanho}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`,
  );
  await page.waitForTimeout(80);
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: tamanho, height: tamanho } });
}

for (const [tamanho, destino] of [
  [1024, 'build/icon.png'],
  [512, 'electron/icon.png'],
  [192, 'build/icon-192.png'],
]) {
  fs.writeFileSync(path.join(raiz, destino), await png(tamanho));
  console.log('Criado', destino);
}

// Windows: ficheiro .ico com imagens PNG embutidas (formato suportado desde o Windows Vista)
const tamanhosIco = [16, 24, 32, 48, 64, 128, 256];
const imagens = [];
for (const t of tamanhosIco) imagens.push({ t, dados: await png(t) });
const cabecalho = Buffer.alloc(6 + 16 * imagens.length);
cabecalho.writeUInt16LE(0, 0);
cabecalho.writeUInt16LE(1, 2);
cabecalho.writeUInt16LE(imagens.length, 4);
let deslocamento = cabecalho.length;
imagens.forEach(({ t, dados }, i) => {
  const o = 6 + 16 * i;
  cabecalho.writeUInt8(t >= 256 ? 0 : t, o);
  cabecalho.writeUInt8(t >= 256 ? 0 : t, o + 1);
  cabecalho.writeUInt16LE(1, o + 4);
  cabecalho.writeUInt16LE(32, o + 6);
  cabecalho.writeUInt32LE(dados.length, o + 8);
  cabecalho.writeUInt32LE(deslocamento, o + 12);
  deslocamento += dados.length;
});
fs.writeFileSync(path.join(raiz, 'build/documento.ico'), Buffer.concat([cabecalho, ...imagens.map((x) => x.dados)]));
console.log('Criado build/documento.ico');

// macOS: .icns através do iconutil (só existe no macOS)
if (process.platform === 'darwin') {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'gdh-icone-')) + '/documento.iconset';
  fs.mkdirSync(pasta);
  for (const base of [16, 32, 128, 256, 512]) {
    fs.writeFileSync(path.join(pasta, `icon_${base}x${base}.png`), await png(base));
    fs.writeFileSync(path.join(pasta, `icon_${base}x${base}@2x.png`), await png(base * 2));
  }
  execFileSync('iconutil', ['-c', 'icns', pasta, '-o', path.join(raiz, 'build/documento.icns')]);
  console.log('Criado build/documento.icns');
} else {
  console.log('(build/documento.icns só pode ser gerado no macOS)');
}

await browser.close();
