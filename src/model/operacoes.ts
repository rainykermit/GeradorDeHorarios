// Operações que alteram o projeto mantendo-o coerente (ex.: eliminar um docente
// retira-o das aulas e da direção de turma).

import type { Draft } from 'immer';
import type { Aula, Projeto } from './tipos';
import { DISCIPLINAS_HABITUAIS, PLANOS_CURRICULARES, novaDisciplina } from './padrao';
import { novoId, normalizar } from './util';

type P = Draft<Projeto>;

export function eliminarProfessor(d: P, id: string) {
  d.professores = d.professores.filter((x) => x.id !== id);
  for (const a of d.aulas) a.professorIds = a.professorIds.filter((x) => x !== id);
  for (const t of d.turmas) if (t.dtId === id) t.dtId = null;
}

export function eliminarAula(d: P, id: string) {
  d.aulas = d.aulas.filter((a) => a.id !== id);
  d.horario.colocacoes = d.horario.colocacoes.filter((c) => c.aulaId !== id);
}

export function eliminarTurma(d: P, id: string) {
  d.turmas = d.turmas.filter((x) => x.id !== id);
  const orfas: string[] = [];
  for (const a of d.aulas) {
    if (!a.turmaIds.includes(id)) continue;
    a.turmaIds = a.turmaIds.filter((x) => x !== id);
    if (a.turmaIds.length === 0) orfas.push(a.id);
  }
  for (const aid of orfas) eliminarAula(d, aid);
}

export function eliminarSala(d: P, id: string) {
  d.salas = d.salas.filter((x) => x.id !== id);
  for (const t of d.turmas) if (t.salaId === id) t.salaId = null;
  for (const a of d.aulas)
    if (a.salaId === id) {
      a.salaId = null;
      if (a.modoSala === 'fixa') a.modoSala = 'auto';
    }
  for (const c of d.horario.colocacoes) if (c.salaId === id) c.salaId = null;
}

export function eliminarDisciplina(d: P, id: string) {
  d.disciplinas = d.disciplinas.filter((x) => x.id !== id);
  for (const a of d.aulas.filter((a) => a.disciplinaId === id)) eliminarAula(d, a.id);
}

/** Depois de alterar a distribuição de uma aula, as colocações antigas deixam de corresponder. */
export function ajustarColocacoesAula(d: P, antes: Aula | undefined, depois: Aula) {
  if (!antes) return;
  if (antes.distribuicao.join('+') !== depois.distribuicao.join('+') || normalizar(antes.simultaneo) !== normalizar(depois.simultaneo))
    d.horario.colocacoes = d.horario.colocacoes.filter((c) => c.aulaId !== depois.id);
}

export function novaAula(parcial: Partial<Aula> = {}): Aula {
  return {
    id: novoId('a'),
    disciplinaId: '',
    professorIds: [],
    turmaIds: [],
    turno: '',
    distribuicao: [1],
    modoSala: 'auto',
    salaId: null,
    simultaneo: '',
    notas: '',
    ...parcial,
  };
}

/** Cria as aulas do plano curricular sugerido para uma turma. */
export function aplicarPlanoCurricular(d: P, turmaId: string, ano: string): { aulas: number; disciplinas: number } {
  const plano = PLANOS_CURRICULARES[ano];
  if (!plano) return { aulas: 0, disciplinas: 0 };
  let novasAulas = 0;
  let novasDisc = 0;
  for (const item of plano) {
    let disc = d.disciplinas.find((x) => normalizar(x.sigla) === normalizar(item.sigla));
    if (!disc) {
      const hab = DISCIPLINAS_HABITUAIS.find((x) => x.sigla === item.sigla);
      if (!hab) continue;
      disc = novaDisciplina({ nome: hab.nome, sigla: hab.sigla, cor: hab.cor, tipoSala: hab.tipoSala });
      d.disciplinas.push(disc);
      novasDisc++;
    }
    const existe = d.aulas.some((a) => a.disciplinaId === disc!.id && a.turmaIds.includes(turmaId) && !a.turno);
    if (existe) continue;
    d.aulas.push(novaAula({ disciplinaId: disc.id, turmaIds: [turmaId], distribuicao: [...item.distribuicao] }));
    novasAulas++;
  }
  return { aulas: novasAulas, disciplinas: novasDisc };
}
