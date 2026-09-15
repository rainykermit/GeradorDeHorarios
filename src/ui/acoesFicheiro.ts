// Ações sobre ficheiros: novo, abrir, guardar, exemplo.

import { criarExemplo } from '../model/exemplo';
import { novoProjeto } from '../model/padrao';
import { semBOM } from '../model/util';
import { ErroFicheiro, normalizarProjeto } from '../estado/migracao';
import { FILTRO_HORARIO, abrirFicheiros, guardarFicheiro } from '../estado/persistencia';
import { marcarGuardadoEmFicheiro, obterProjeto, substituirProjeto, temAlteracoesPorGuardar } from '../estado/store';
import { confirmar, notificar } from './comum';
import { guardarFichaPorPreencher, guardarFichasPorImportar } from '../estado/externo';
import { irPara } from './navegacao';

export function nomeFicheiroSeguro(base: string) {
  return (
    base
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'Horario'
  );
}

export function nomeBaseProjeto() {
  const p = obterProjeto();
  return nomeFicheiroSeguro(`Horário ${p.escola || 'da escola'} ${p.anoLetivo.replace('/', '-')}`);
}

async function podeDescartar(): Promise<boolean> {
  const p = obterProjeto();
  const vazio = p.aulas.length === 0 && p.professores.length === 0 && p.turmas.length === 0;
  if (vazio || !temAlteracoesPorGuardar()) return true;
  return confirmar({
    titulo: 'Substituir o trabalho atual?',
    texto: 'O trabalho atual será substituído. Se ainda não o guardou num ficheiro, é recomendável fazê-lo primeiro (botão «Guardar»).',
    botao: 'Continuar sem guardar',
    perigo: true,
  });
}

export async function guardarProjeto() {
  try {
    const p = obterProjeto();
    const ok = await guardarFicheiro(`${nomeBaseProjeto()}.horario`, JSON.stringify(p, null, 1), 'application/json', FILTRO_HORARIO);
    if (ok) {
      marcarGuardadoEmFicheiro();
      notificar('Ficheiro guardado.');
    }
  } catch (e) {
    notificar('Não foi possível guardar o ficheiro: ' + (e as Error).message, 'erro', 7000);
  }
}

export async function abrirProjeto() {
  if (!(await podeDescartar())) return;
  const ficheiros = await abrirFicheiros(['.horario', '.json']);
  if (!ficheiros.length) return;
  try {
    const projeto = normalizarProjeto(JSON.parse(semBOM(ficheiros[0].conteudo)));
    substituirProjeto(projeto);
    notificar(`Aberto: ${ficheiros[0].nome}`);
    irPara('inicio');
  } catch (e) {
    const msg = e instanceof ErroFicheiro ? e.message : 'O ficheiro está danificado ou não é um horário válido.';
    notificar(msg, 'erro', 8000);
  }
}

/** Ficheiro aberto por duplo clique (aplicação de computador). */
export async function abrirConteudoExterno(nome: string, conteudo: string) {
  if (/\.ficha$/i.test(nome)) {
    // Quem tem docentes registados é o responsável pelos horários: importa a ficha.
    if (obterProjeto().professores.length > 0) {
      guardarFichasPorImportar({ nome, conteudo });
      irPara('professores', 'importar-fichas');
    } else {
      guardarFichaPorPreencher(conteudo);
      irPara('ficha');
      window.dispatchEvent(new Event('gdh-ficha-recebida'));
    }
    return;
  }
  if (!(await podeDescartar())) return;
  try {
    substituirProjeto(normalizarProjeto(JSON.parse(semBOM(conteudo))));
    notificar(`Aberto: ${nome}`);
    irPara('inicio');
  } catch (e) {
    notificar(e instanceof ErroFicheiro ? e.message : 'O ficheiro está danificado ou não é um horário válido.', 'erro', 8000);
  }
}

export async function novoHorario() {
  if (!(await podeDescartar())) return;
  substituirProjeto(novoProjeto());
  irPara('escola');
  notificar('Novo horário criado. Comece por indicar os dados da escola.', 'info');
}

export async function abrirExemplo() {
  if (!(await podeDescartar())) return;
  substituirProjeto(criarExemplo());
  irPara('inicio');
  notificar('Escola de exemplo carregada. Pode experimentar à vontade.', 'info');
}
