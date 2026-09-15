// Funções de consulta reutilizáveis sobre o projeto.

import type { Aula, Disciplina, Professor, Projeto, Sala, Turma } from './tipos';
import { TIPOS_SALA_HABITUAIS } from './padrao';
import { compararTexto, normalizar, somaTempos } from './util';

export interface Indices {
  disc: Map<string, Disciplina>;
  prof: Map<string, Professor>;
  turma: Map<string, Turma>;
  sala: Map<string, Sala>;
  aula: Map<string, Aula>;
}

const cache = new WeakMap<Projeto, Indices>();

export function indices(p: Projeto): Indices {
  let i = cache.get(p);
  if (!i) {
    i = {
      disc: new Map(p.disciplinas.map((x) => [x.id, x])),
      prof: new Map(p.professores.map((x) => [x.id, x])),
      turma: new Map(p.turmas.map((x) => [x.id, x])),
      sala: new Map(p.salas.map((x) => [x.id, x])),
      aula: new Map(p.aulas.map((x) => [x.id, x])),
    };
    cache.set(p, i);
  }
  return i;
}

export function nomesTurmas(p: Projeto, ids: string[]): string {
  const idx = indices(p);
  return ids.map((id) => idx.turma.get(id)?.nome ?? '?').join(', ');
}

export function nomesProfessores(p: Projeto, ids: string[], curto = false): string {
  const idx = indices(p);
  return ids
    .map((id) => {
      const pr = idx.prof.get(id);
      return pr ? (curto && pr.sigla ? pr.sigla : pr.nome) : '?';
    })
    .join(', ');
}

export function descreverAula(p: Projeto, a: Aula): string {
  const idx = indices(p);
  const d = idx.disc.get(a.disciplinaId);
  const partes = [d?.nome || 'Disciplina removida'];
  if (a.turmaIds.length) partes.push(nomesTurmas(p, a.turmaIds) + (a.turno ? ` (${a.turno})` : ''));
  if (a.professorIds.length) partes.push(nomesProfessores(p, a.professorIds));
  return partes.join(' — ');
}

/** Total de tempos semanais por docente (grupos simultâneos contam uma vez). */
export function temposPorProfessor(p: Projeto): Map<string, number> {
  const res = new Map<string, number>();
  for (const a of p.aulas) {
    const t = somaTempos(a.distribuicao);
    for (const id of new Set(a.professorIds)) res.set(id, (res.get(id) ?? 0) + t);
  }
  return res;
}

export function temposPorTurma(p: Projeto): Map<string, number> {
  const res = new Map<string, number>();
  const gruposContados = new Set<string>();
  for (const a of p.aulas) {
    const t = somaTempos(a.distribuicao);
    for (const id of new Set(a.turmaIds)) {
      const g = normalizar(a.simultaneo);
      if (g) {
        const chave = `${g}|${id}`;
        if (gruposContados.has(chave)) continue;
        gruposContados.add(chave);
      }
      res.set(id, (res.get(id) ?? 0) + t);
    }
  }
  return res;
}

export function tiposDeSala(p: Projeto): string[] {
  const vistos = new Map<string, string>();
  for (const t of [...TIPOS_SALA_HABITUAIS, ...p.salas.map((s) => s.tipo), ...p.disciplinas.map((d) => d.tipoSala)]) {
    if (t && !vistos.has(normalizar(t))) vistos.set(normalizar(t), t);
  }
  return [...vistos.values()];
}

export function gruposSimultaneos(p: Projeto): string[] {
  const vistos = new Map<string, string>();
  for (const a of p.aulas) if (a.simultaneo && !vistos.has(normalizar(a.simultaneo))) vistos.set(normalizar(a.simultaneo), a.simultaneo);
  return [...vistos.values()].sort(compararTexto);
}

export function aulasDoProfessor(p: Projeto, id: string) {
  return p.aulas.filter((a) => a.professorIds.includes(id));
}

export function aulasDaTurma(p: Projeto, id: string) {
  return p.aulas.filter((a) => a.turmaIds.includes(id));
}

export const ordenarPorNome = <T extends { nome: string }>(lista: T[]) => [...lista].sort((a, b) => compararTexto(a.nome, b.nome));
