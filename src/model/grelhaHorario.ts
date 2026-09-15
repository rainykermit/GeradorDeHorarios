// Dados das grelhas de horário por turma, docente ou sala (usados no ecrã, impressão e Excel).

import type { Aula, Colocacao, Disciplina, Projeto, Tempo } from './tipos';
import { indices } from './consultas';
import { temposOrdenados } from '../motor/compilar';
import { compararTexto, somaTempos } from './util';

export type TipoEntidade = 'turma' | 'prof' | 'sala';

export interface ItemCelula {
  col: Colocacao;
  aula: Aula;
  disc: Disciplina | undefined;
  dur: number;
  /** 0 = primeiro tempo da aula; 1 = segundo tempo de um bloco, etc. */
  parte: number;
}

export interface DadosGrelha {
  dias: number[];
  tempos: Tempo[];
  celulas: Map<string, ItemCelula[]>;
}

export const chaveCelula = (dia: number, tempoIdx: number) => `${dia}|${tempoIdx}`;

function pertence(c: Colocacao, aula: Aula, tipo: TipoEntidade, id: string) {
  if (tipo === 'turma') return aula.turmaIds.includes(id);
  if (tipo === 'prof') return aula.professorIds.includes(id);
  return c.salaId === id;
}

export function grelhaDe(p: Projeto, tipo: TipoEntidade, id: string): DadosGrelha {
  const idx = indices(p);
  const tempos = temposOrdenados(p);
  const tIdx = new Map(tempos.map((t, i) => [t.id, i]));
  const dias = [...p.config.dias].sort((a, b) => a - b);
  const celulas = new Map<string, ItemCelula[]>();
  for (const c of p.horario.colocacoes) {
    const aula = idx.aula.get(c.aulaId);
    if (!aula || !pertence(c, aula, tipo, id)) continue;
    const ti = tIdx.get(c.tempoId);
    if (ti === undefined || !dias.includes(c.dia)) continue;
    const dur = aula.distribuicao[c.indice] ?? 1;
    const disc = idx.disc.get(aula.disciplinaId);
    for (let k = 0; k < dur && ti + k < tempos.length; k++) {
      const chave = chaveCelula(c.dia, ti + k);
      if (!celulas.has(chave)) celulas.set(chave, []);
      celulas.get(chave)!.push({ col: c, aula, disc, dur, parte: k });
    }
  }
  for (const lista of celulas.values()) lista.sort((a, b) => compararTexto(a.disc?.sigla ?? '', b.disc?.sigla ?? '') || compararTexto(a.aula.turno, b.aula.turno));
  return { dias, tempos, celulas };
}

export interface Entidade {
  id: string;
  nome: string;
  sub: string;
}

export function entidadesDe(p: Projeto, tipo: TipoEntidade): Entidade[] {
  if (tipo === 'turma')
    return [...p.turmas]
      .sort((a, b) => compararTexto(a.ano, b.ano) || compararTexto(a.nome, b.nome))
      .map((t) => ({ id: t.id, nome: t.nome, sub: t.ano ? `${t.ano}.º ano` : '' }));
  if (tipo === 'prof') {
    const carga = new Map<string, number>();
    for (const a of p.aulas) for (const id of a.professorIds) carga.set(id, (carga.get(id) ?? 0) + somaTempos(a.distribuicao));
    return [...p.professores].sort((a, b) => compararTexto(a.nome, b.nome)).map((x) => ({ id: x.id, nome: x.nome, sub: `${x.sigla ? x.sigla + ' · ' : ''}${carga.get(x.id) ?? 0} tempos` }));
  }
  return [...p.salas].sort((a, b) => compararTexto(a.nome, b.nome)).map((s) => ({ id: s.id, nome: s.nome, sub: s.tipo }));
}

export function nomeEntidade(p: Projeto, tipo: TipoEntidade, id: string): string {
  const idx = indices(p);
  if (tipo === 'turma') return idx.turma.get(id)?.nome ?? '?';
  if (tipo === 'prof') return idx.prof.get(id)?.nome ?? '?';
  return idx.sala.get(id)?.nome ?? '?';
}

/** Textos para mostrar uma aula numa célula, conforme o tipo de horário. */
export function rotulosItem(p: Projeto, item: ItemCelula, tipo: TipoEntidade): { titulo: string; linhas: string[] } {
  const idx = indices(p);
  const { aula, disc, col } = item;
  const titulo = (disc?.sigla || disc?.nome || '?') + (aula.turno ? ` · ${aula.turno}` : '');
  const turmas = aula.turmaIds.map((id) => idx.turma.get(id)?.nome ?? '?').join(', ');
  const profs = aula.professorIds.map((id) => idx.prof.get(id)?.sigla || idx.prof.get(id)?.nome || '?').join(', ');
  const linhas: string[] = [];
  if (tipo === 'turma') {
    if (profs) linhas.push(profs);
  } else if (tipo === 'prof') {
    linhas.push(turmas || disc?.nome || '');
  } else {
    if (turmas) linhas.push(turmas);
    if (profs) linhas.push(profs);
  }
  if (tipo !== 'sala' && col.salaId) linhas.push(idx.sala.get(col.salaId)?.nome ?? '');
  return { titulo, linhas: linhas.filter(Boolean) };
}
