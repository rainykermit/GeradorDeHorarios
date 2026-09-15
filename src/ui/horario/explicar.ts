// Explicações em linguagem simples de porque uma aula não pode ir para um tempo.

import type { Projeto } from '../../model/tipos';
import { NOMES_DIAS, chaveGrelha } from '../../model/tipos';
import type { EstadoHorario } from '../../motor/conversao';
import { indices } from '../../model/consultas';
import { paraMinutos } from '../../model/util';
import { temposOrdenados } from '../../motor/compilar';

export function descreverUnidade(p: Projeto, e: EstadoHorario, u: number): string {
  const idx = indices(p);
  const un = e.problema.unidades[u];
  return un.membros
    .map((m) => {
      const a = idx.aula.get(m.aulaId);
      if (!a) return '?';
      const d = idx.disc.get(a.disciplinaId);
      const turmas = a.turmaIds.map((id) => idx.turma.get(id)?.nome ?? '?').join(', ');
      return `${d?.sigla || d?.nome || '?'}${turmas ? ` (${turmas}${a.turno ? ' · ' + a.turno : ''})` : ''}`;
    })
    .join(' + ');
}

export function textoTempo(p: Projeto, e: EstadoHorario, s: number): string {
  const T = e.problema.T;
  const dia = e.problema.dias[Math.floor(s / T)];
  const tempo = temposOrdenados(p)[s % T];
  return `${NOMES_DIAS[dia]} às ${tempo?.inicio ?? '?'}`;
}

export function explicarImpossivel(p: Projeto, e: EstadoHorario, u: number, s: number): string[] {
  const pr = e.problema;
  const un = pr.unidades[u];
  const T = pr.T;
  const d = Math.floor(s / T);
  const t = s % T;
  const dia = pr.dias[d];
  const tempos = temposOrdenados(p);
  const razoes = new Set<string>();
  if (t + un.dur > T) razoes.add(`O bloco de ${un.dur} tempos não cabe: o dia termina antes.`);
  else
    for (let i = 0; i + 1 < un.dur; i++) {
      const intervalo = paraMinutos(tempos[t + i + 1].inicio) - paraMinutos(tempos[t + i].fim);
      if (intervalo > p.config.intervaloMaxBloco) razoes.add(`O bloco de ${un.dur} tempos não pode atravessar o intervalo das ${tempos[t + i].fim}.`);
    }
  for (let i = 0; i < un.dur && t + i < T; i++) {
    const k = chaveGrelha(dia, pr.tempoIds[t + i]);
    const hora = tempos[t + i].inicio;
    if (p.bloqueios[k] === 'indisponivel') razoes.add('Este tempo está bloqueado para toda a escola.');
    for (const pi of un.profs)
      if (p.professores[pi]?.indisp[k] === 'indisponivel') razoes.add(`${p.professores[pi].nome} está indisponível à ${NOMES_DIAS[dia].toLowerCase()} às ${hora}.`);
    for (const ti of un.turmas) if (p.turmas[ti]?.indisp[k] === 'indisponivel') razoes.add(`A turma ${p.turmas[ti].nome} não pode ter aulas às ${hora}.`);
    for (const m of un.membros)
      if (p.disciplinas[m.disc]?.indisp[k] === 'indisponivel') razoes.add(`${p.disciplinas[m.disc].nome} não pode ser lecionada às ${hora}.`);
  }
  if (razoes.size === 0 && un.membros.some((m) => m.salas.length)) razoes.add('As salas possíveis para esta aula não estão disponíveis neste tempo.');
  if (razoes.size === 0) razoes.add('Este tempo não é possível para esta aula.');
  return [...razoes];
}

export function explicarConflitos(p: Projeto, e: EstadoHorario, u: number, s: number): { razoes: string[]; unidades: number[]; bloqueantes: boolean } {
  const pr = e.problema;
  const un = pr.unidades[u];
  const c = e.motor.conflitosEm(u, s);
  const razoes: string[] = [];
  let bloqueantes = false;
  for (const v of c.unidades) {
    const uv = pr.unidades[v];
    const desc = descreverUnidade(p, e, v);
    if (e.motor.estaFixa(v)) bloqueantes = true;
    const prof = un.profs.find((x) => uv.profs.includes(x));
    const turma = un.turmas.find((x) => uv.turmas.includes(x));
    if (prof !== undefined) razoes.push(`${p.professores[prof].nome} já tem ${desc} a essa hora.`);
    else if (turma !== undefined) razoes.push(`A turma ${p.turmas[turma].nome} já tem ${desc} a essa hora.`);
    else razoes.push(`A sala está ocupada por ${desc}.`);
  }
  for (const pi of c.maxDiaProf) razoes.push(`${p.professores[pi].nome} ultrapassaria o máximo de ${pr.profMaxDia[pi]} tempos nesse dia.`);
  for (const ti of c.maxDiaTurma) razoes.push(`A turma ${p.turmas[ti].nome} ultrapassaria o máximo de ${pr.turmaMaxDia[ti]} tempos nesse dia.`);
  if (c.salaCheia) razoes.push('Não há nenhuma sala livre do tipo necessário a essa hora.');
  if (!razoes.length) razoes.push('Este tempo não é possível para esta aula.');
  return { razoes, unidades: c.unidades, bloqueantes };
}
