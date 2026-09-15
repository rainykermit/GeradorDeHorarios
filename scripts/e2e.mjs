// Teste de ponta a ponta: abre a aplicação num navegador real, percorre as páginas,
// gera um horário, arrasta uma aula e imprime. Guarda capturas de ecrã.
//
// Uso: node scripts/e2e.mjs [pasta-de-saida]

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const saida = process.argv[2] ?? path.join(raiz, 'tmp-e2e');
fs.mkdirSync(saida, { recursive: true });
const url = process.env.URL_APP ?? pathToFileURL(path.join(raiz, 'dist/index.html')).href;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-PT', acceptDownloads: true });
const page = await ctx.newPage();
const erros = [];
page.on('console', (m) => {
  if (m.type() === 'error') erros.push(m.text());
});
page.on('pageerror', (e) => erros.push(String(e)));

let n = 0;
const foto = async (nome) => {
  n++;
  await page.screenshot({ path: path.join(saida, `${String(n).padStart(2, '0')}-${nome}.png`) });
};
const passo = (t) => console.log('•', t);
const ir = async (hash) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForTimeout(450);
};

try {
  passo('Abrir a aplicação');
  await page.goto(url);
  await page.getByText('Bem-vindo ao Gerador de Horários').waitFor({ timeout: 15000 });
  await foto('inicio');

  passo('Carregar a escola de exemplo');
  await page.getByRole('button', { name: 'Experimentar com uma escola de exemplo' }).click();
  await page.locator('.titulo-projeto strong', { hasText: 'Escola Básica de Exemplo' }).waitFor();
  await foto('inicio-exemplo');

  for (const pag of ['escola', 'disciplinas', 'salas', 'professores', 'turmas', 'aulas', 'regras']) {
    passo(`Página ${pag}`);
    await ir(`#/${pag}`);
    await foto(pag);
  }

  passo('Editar uma aula (modal)');
  await ir('#/aulas');
  await page.locator('table.tabela tbody tr').first().click();
  await page.getByRole('dialog').waitFor();
  await foto('editor-aula');
  await page.keyboard.press('Escape');

  passo('Colar do Excel (pré-visualização)');
  await ir('#/professores');
  await page.getByRole('button', { name: 'Colar do Excel' }).click();
  await page.locator('.modal textarea').fill('Nome\tSigla\nZé Teste Novo\tZTN\nAna Nova Silva\t');
  await page.waitForTimeout(200);
  await foto('colar-excel');
  await page.getByRole('button', { name: /^Importar 2$/ }).click();
  await page.getByText('Zé Teste Novo').first().waitFor();

  passo('Verificar e gerar horário');
  await ir('#/gerar');
  await foto('gerar');
  await page.getByRole('button', { name: 'Rápida (20 s)' }).click();
  await page.getByRole('button', { name: /^Gerar horário$/ }).click();
  await page.waitForTimeout(4000);
  await foto('a-gerar');
  await page.getByRole('button', { name: 'Ver e editar horários' }).waitFor({ timeout: 120000 });
  await foto('gerado');

  passo('Ver horário de uma turma');
  await page.getByRole('button', { name: 'Ver e editar horários' }).click();
  await page.locator('.cartao-aula').first().waitFor();
  await foto('horario-turma');

  passo('Selecionar e arrastar uma aula');
  const cartao = page.locator('td.celula .cartao-aula').first();
  await cartao.click();
  await page.locator('.painel-aula').waitFor();
  await foto('painel-aula');
  const alvo = page.locator('td.celula:not(:has(.cartao-aula))').nth(3);
  await cartao.dragTo(alvo);
  await page.waitForTimeout(800);
  await foto('apos-arrastar');

  passo('Anular (Ctrl+Z)');
  await page.locator('.cabecalho-pagina h1').click();
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);

  passo('Horário de docente e mapa geral');
  await page.getByRole('tab', { name: 'Docentes' }).click();
  await page.waitForTimeout(500);
  await foto('horario-docente');
  await page.getByRole('tab', { name: 'Mapa geral' }).click();
  await page.waitForTimeout(800);
  await foto('mapa-geral');

  passo('Imprimir (PDF)');
  await page.getByRole('tab', { name: 'Turmas' }).click();
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page.getByRole('button', { name: 'Imprimir este' }).click();
  await page.waitForTimeout(500);
  await page.pdf({ path: path.join(saida, 'impressao-turma.pdf'), landscape: true, format: 'A4', printBackground: true });

  passo('Ficha do docente e ajuda');
  await ir('#/ficha');
  await foto('ficha');
  await ir('#/ajuda');
  await foto('ajuda');

  passo('Recarregar: o trabalho continua lá');
  await page.reload();
  await page.locator('.titulo-projeto strong', { hasText: 'Escola Básica de Exemplo' }).waitFor({ timeout: 10000 });
  await ir('#/horarios');
  await page.locator('.cartao-aula').first().waitFor();
  await foto('apos-recarregar');

  console.log('\nE2E concluído.');
} catch (e) {
  await foto('falha');
  console.error('\nFALHA:', e.message);
  process.exitCode = 1;
} finally {
  if (erros.length) {
    console.log('\nErros na consola do navegador:');
    for (const e of erros) console.log('  -', e);
    process.exitCode = 1;
  } else console.log('Sem erros na consola do navegador.');
  await browser.close();
}
