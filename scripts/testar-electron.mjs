// Testa a aplicação de computador (Electron): ponte com o sistema, geração do horário e fecho com gravação.

import { _electron as electron } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const saida = process.argv[2] ?? path.join(raiz, 'tmp-e2e');

// Dentro de outras aplicações Electron (ex.: VS Code) esta variável faz o Electron comportar-se como Node.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
// GDH_EXECUTAVEL permite testar a aplicação já empacotada (release/…).
const executavel = process.env.GDH_EXECUTAVEL;
const app = await electron.launch(
  executavel ? { executablePath: executavel, args: [], env } : { args: [path.join(raiz, 'electron/main.cjs')], cwd: raiz, env },
);
let falhou = false;
const erros = [];
try {
  const win = await app.firstWindow();
  win.on('pageerror', (e) => erros.push(String(e)));
  win.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
  await win.waitForLoadState('domcontentloaded');

  // Começar de um estado limpo
  await win.evaluate(async () => {
    localStorage.clear();
    await new Promise((r) => {
      const p = indexedDB.deleteDatabase('gerador-de-horarios');
      p.onsuccess = p.onerror = p.onblocked = () => r(null);
    });
  });
  await win.reload();
  await win.getByText('Bem-vindo ao Gerador de Horários').waitFor({ timeout: 15000 });

  const ponte = await win.evaluate(() => ({ existe: !!window.gdhDesktop, versao: window.gdhDesktop?.versao }));
  console.log('• Ponte com o sistema:', ponte);
  if (!ponte.existe) throw new Error('window.gdhDesktop não existe');

  const titulo = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle());
  console.log('• Título da janela:', titulo);

  await win.getByRole('button', { name: 'Experimentar com uma escola de exemplo' }).click();
  await win.evaluate(() => (location.hash = '#/gerar'));
  await win.getByRole('button', { name: 'Rápida (20 s)' }).click();
  await win.getByRole('button', { name: /^Gerar horário$/ }).click();
  await win.getByRole('button', { name: 'Ver e editar horários' }).waitFor({ timeout: 90000 });
  console.log('• Horário gerado na aplicação de computador');
  await win.getByRole('button', { name: 'Ver e editar horários' }).click();
  await win.locator('.cartao-aula').first().waitFor();
  await win.screenshot({ path: path.join(saida, 'electron-horarios.png') });

  const menus = await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map((i) => i.label));
  console.log('• Menus:', menus.join(' | '));
} catch (e) {
  falhou = true;
  console.error('FALHA:', e.message);
} finally {
  const t0 = Date.now();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
  await new Promise((r) => setTimeout(r, 2500));
  console.log(`• Janela fechada (espera pela gravação: ${Date.now() - t0} ms)`);
  await app.close().catch(() => {});
  if (erros.length) console.log('Erros:', erros);
  if (falhou || erros.length) process.exitCode = 1;
  else console.log('Aplicação de computador OK.');
}
