// Testa, na aplicação de computador, o que acontece com ficheiros e com o menu:
//  1) abrir um .horario passado como argumento (o que acontece com um duplo clique no Windows e no macOS),
//     incluindo um ficheiro com marca BOM (gravado pelo Bloco de Notas);
//  2) largar um .horario na janela;
//  3) «Editar → Anular» no menu anula exatamente um passo;
//  4) Ctrl+Z na página não anula uma segunda vez (o atalho pertence ao menu).
//
// Uso: node scripts/testar-electron-ficheiros.mjs <pasta-temporária>
// GDH_EXECUTAVEL=<caminho> testa a aplicação empacotada.

import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pasta = process.argv[2] ?? path.join(raiz, 'tmp-e2e');
fs.mkdirSync(pasta, { recursive: true });
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const escrever = (nome, escola, bom) => {
  const f = path.join(pasta, nome);
  fs.writeFileSync(f, (bom ? '﻿' : '') + JSON.stringify({ formato: 'gerador-de-horarios', versao: 1, escola, anoLetivo: '2026/2027' }));
  return f;
};
// GDH_SEM_BOM=1 grava o ficheiro sem marca BOM (para testar versões antigas sem misturar os dois problemas).
const comBOM = !process.env.GDH_SEM_BOM;
const porArgumento = escrever('Aberto por argumento.horario', 'Escola Aberta Por Argumento', comBOM);
const largado = escrever('Largado na janela.horario', 'Escola Largada Na Janela', false);

const executavel = process.env.GDH_EXECUTAVEL;
const app = await electron.launch(
  executavel ? { executablePath: executavel, args: [porArgumento], env } : { args: [path.join(raiz, 'electron/main.cjs'), porArgumento], cwd: raiz, env },
);
// Com GDH_DEPURAR, mostrar também os registos do processo principal.
if (process.env.GDH_DEPURAR) app.process().stdout.on('data', (d) => process.stdout.write(`[principal] ${d}`));
const erros = [];
let falhou = false;
try {
  const win = await app.firstWindow();
  win.on('pageerror', (e) => erros.push(String(e)));
  const titulo = win.locator('.titulo-projeto strong');

  await titulo.filter({ hasText: 'Escola Aberta Por Argumento' }).waitFor({ timeout: 20000 });
  console.log(`• Ficheiro passado como argumento (duplo clique)${comBOM ? ', com BOM' : ''}: aberto`);

  const urlApp = win.url();
  await win.evaluate((u) => {
    location.href = u;
  }, pathToFileURL(largado).href);
  // A navegação é cancelada pela aplicação; o Playwright fica à espera que ela termine, por isso
  // o estado da página é lido diretamente através do processo principal.
  const lerPagina = () =>
    app.evaluate(({ BrowserWindow }) => {
      const wc = BrowserWindow.getAllWindows()[0].webContents;
      return wc
        .executeJavaScript("(document.querySelector('.titulo-projeto strong') || {}).textContent || ''")
        .then((t) => ({ titulo: t, url: wc.getURL() }));
    });
  let estado = await lerPagina();
  for (let i = 0; i < 40 && estado.titulo !== 'Escola Largada Na Janela'; i++) {
    await new Promise((r) => setTimeout(r, 250));
    estado = await lerPagina();
  }
  if (estado.titulo !== 'Escola Largada Na Janela') throw new Error(`o ficheiro largado não abriu (título: «${estado.titulo}»)`);
  if (estado.url.split('#')[0] !== urlApp.split('#')[0]) throw new Error(`a janela saiu da aplicação: ${estado.url}`);
  console.log('• Ficheiro largado na janela: aberto, e a aplicação continua na sua página');

  await win.evaluate(() => (location.hash = '#/escola'));
  const campoEscola = win.getByPlaceholder('Ex.: Escola Básica D. Dinis');
  const campoAgrup = win.getByPlaceholder('Ex.: Agrupamento de Escolas de …');
  await campoEscola.fill('Primeira alteração');
  await win.locator('.cabecalho-pagina h1').click();
  await win.waitForTimeout(1700);
  await campoAgrup.fill('Segunda alteração');
  await win.locator('.cabecalho-pagina h1').click();
  await win.waitForTimeout(300);

  await app.evaluate(({ Menu }) => {
    const editar = Menu.getApplicationMenu().items.find((i) => i.label === 'Editar');
    editar.submenu.items.find((i) => i.label === 'Anular').click();
  });
  await win.waitForTimeout(400);
  const depoisMenu = [await campoEscola.inputValue(), await campoAgrup.inputValue()];
  if (depoisMenu[0] !== 'Primeira alteração' || depoisMenu[1] !== '')
    throw new Error(`«Anular» do menu não anulou exatamente um passo: ${JSON.stringify(depoisMenu)}`);
  console.log('• Menu Editar → Anular: anulou exatamente um passo');

  await win.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
  await win.waitForTimeout(400);
  const depoisTecla = [await campoEscola.inputValue(), await campoAgrup.inputValue()];
  if (depoisTecla[0] !== 'Primeira alteração') throw new Error(`o atalho foi tratado também pela página: ${JSON.stringify(depoisTecla)}`);
  console.log('• Atalho de teclado na página não duplica o do menu');

  const menus = await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map((i) => i.label));
  console.log('• Menus:', menus.join(' | '));
} catch (e) {
  falhou = true;
  console.error('FALHA:', e.message);
} finally {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close()).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  await app.close().catch(() => {});
  if (erros.length) console.log('Erros:', erros);
  if (falhou || erros.length) process.exitCode = 1;
  else console.log('Ficheiros e menu da aplicação de computador OK.');
}
