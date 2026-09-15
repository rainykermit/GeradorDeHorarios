// Testa largar ficheiros na janela: um .horario abre o horário; outros ficheiros mostram um aviso
// e a aplicação não é substituída pelo conteúdo do ficheiro.

import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(path.join(raiz, 'dist/index.html')).href;

const largar = (page, nome, conteudo) =>
  page.evaluate(
    ([n, c]) => {
      const dt = new DataTransfer();
      dt.items.add(new File([c], n, { type: 'application/octet-stream' }));
      window.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, cancelable: true }));
      const ev = new DragEvent('drop', { dataTransfer: dt, cancelable: true, bubbles: true });
      window.dispatchEvent(ev);
      return ev.defaultPrevented;
    },
    [nome, conteudo],
  );

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const erros = [];
page.on('pageerror', (e) => erros.push(String(e)));
let falhou = false;
try {
  await page.goto(url);
  await page.getByText('Bem-vindo ao Gerador de Horários').waitFor({ timeout: 15000 });

  const bloqueado = await largar(page, 'notas.txt', 'texto qualquer');
  await page.getByText('Só é possível abrir ficheiros de horário').waitFor({ timeout: 5000 });
  console.log('• Ficheiro .txt: navegação bloqueada =', bloqueado, '— aviso mostrado');

  const horario = JSON.stringify({ formato: 'gerador-de-horarios', versao: 1, escola: 'Escola Largada', anoLetivo: '2026/2027' });
  const bloqueado2 = await largar(page, 'teste.horario', horario);
  await page.locator('.titulo-projeto strong', { hasText: 'Escola Largada' }).waitFor({ timeout: 5000 });
  console.log('• Ficheiro .horario: navegação bloqueada =', bloqueado2, '— horário aberto');

  if (!bloqueado || !bloqueado2) throw new Error('o navegador não foi impedido de abrir o ficheiro por cima da aplicação');
  if (!page.url().startsWith(url)) throw new Error(`a página mudou para ${page.url()}`);
} catch (e) {
  falhou = true;
  console.error('FALHA:', e.message);
} finally {
  if (erros.length) console.log('Erros:', erros);
  await browser.close();
  if (falhou || erros.length) process.exitCode = 1;
  else console.log('Largar ficheiros OK.');
}
