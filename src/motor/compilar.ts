// Converte o Projeto (dados introduzidos pelo utilizador) num problema numérico
// compacto, pronto a ser resolvido pelo motor.

import type { Aula, Colocacao, Grelha, Projeto } from '../model/tipos';
import { chaveGrelha } from '../model/tipos';
import { normalizar, paraMinutos } from '../model/util';

export const INF = 1 << 29;
export const PESOS_NIVEL = [0, 3, 15, 100];

export interface Membro {
  aulaId: string;
  indice: number;
  disc: number;
  /** Salas candidatas (vazio = a aula não ocupa sala). */
  salas: number[];
}

export interface Unidade {
  id: number;
  dur: number;
  membros: Membro[];
  profs: number[];
  /** Turmas envolvidas (sem repetições). */
  turmas: number[];
  /** Para cada turma: máscara de bits dos turnos locais envolvidos. */
  mascaras: number[];
  /** Para cada turma: true se envolve a turma completa. */
  inteira: boolean[];
  /** Chaves (turma, disciplina, turno) para a regra "mesma disciplina no mesmo dia". */
  chavesDisc: number[];
  maxDisc: number[];
  /** Inícios permitidos (índice de slot) — restrições fixas já aplicadas. */
  permitido: Uint8Array;
  inicios: Int32Array;
  custoEstatico: Float64Array;
  fixa: boolean;
  inicial: number;
  salasIniciais: number[] | null;
  dificuldade: number;
}

export interface Pesos {
  furoTurma: number;
  furoProf: number;
  mesmoDia: number;
  almocoTurma: number;
  almocoProf: number;
  evitar: number;
  tarde: number;
  consecutivos: number;
  dias: number;
  turnoIsolado: number;
}

export interface Problema {
  D: number;
  T: number;
  S: number;
  dias: number[];
  tempoIds: string[];
  almoco: Uint8Array;
  tarde: Uint8Array;
  nProf: number;
  nTurma: number;
  nSala: number;
  nChavesDisc: number;
  profIds: string[];
  turmaIds: string[];
  salaIds: string[];
  discIds: string[];
  salaCap: Int32Array;
  salaBloq: Uint8Array;
  profMaxDia: Int32Array;
  profMaxCons: Int32Array;
  turmaMaxDia: Int32Array;
  /** Número de turnos distintos por turma (0 = a turma nunca é dividida). */
  turnosTurma: Int32Array;
  pesos: Pesos;
  unidades: Unidade[];
  /** "aulaId#indice" → [unidade, membro] */
  mapa: Map<string, [number, number]>;
  /** Mensagens sobre dados ignorados durante a compilação. */
  avisos: string[];
}

export interface OpcoesCompilacao {
  /** Usar as colocações existentes como ponto de partida. */
  usarHorarioAtual: boolean;
  /** Respeitar as aulas marcadas como fixas. */
  manterFixas: boolean;
}

export const chaveColocacao = (aulaId: string, indice: number) => `${aulaId}#${indice}`;

export function temposOrdenados(projeto: Projeto) {
  return [...projeto.config.tempos].sort((a, b) => paraMinutos(a.inicio) - paraMinutos(b.inicio));
}

export function compilar(projeto: Projeto, opcoes: OpcoesCompilacao): Problema {
  const avisos: string[] = [];
  const cfg = projeto.config;
  const dias = [...cfg.dias].sort((a, b) => a - b);
  const tempos = temposOrdenados(projeto);
  const D = dias.length;
  const T = tempos.length;
  const S = D * T;

  // Contiguidade e janelas
  const continua = new Uint8Array(T);
  for (let t = 0; t + 1 < T; t++) {
    const intervalo = paraMinutos(tempos[t + 1].inicio) - paraMinutos(tempos[t].fim);
    continua[t] = intervalo <= cfg.intervaloMaxBloco ? 1 : 0;
  }
  const almIni = paraMinutos(cfg.almocoInicio);
  const almFim = paraMinutos(cfg.almocoFim);
  const tardeIni = paraMinutos(cfg.inicioTarde);
  const almoco = new Uint8Array(T);
  const tarde = new Uint8Array(T);
  tempos.forEach((tp, t) => {
    const ini = paraMinutos(tp.inicio);
    const fim = paraMinutos(tp.fim);
    almoco[t] = ini >= almIni && fim <= almFim ? 1 : 0;
    tarde[t] = ini >= tardeIni ? 1 : 0;
  });

  const idx = <T extends { id: string }>(lista: T[]) => new Map(lista.map((x, i) => [x.id, i]));
  const profIdx = idx(projeto.professores);
  const turmaIdx = idx(projeto.turmas);
  const salaIdx = idx(projeto.salas);
  const discIdx = idx(projeto.disciplinas);

  const r = projeto.regras;
  const W = PESOS_NIVEL;
  const pesos: Pesos = {
    furoTurma: W[r.furosTurmas],
    furoProf: W[r.furosProfessores],
    mesmoDia: W[r.mesmaDisciplinaMesmoDia],
    almocoTurma: W[r.almocoTurmas] * 2,
    almocoProf: W[r.almocoProfessores] * 2,
    evitar: W[r.preferencias],
    tarde: W[r.tardesTurmas],
    consecutivos: W[r.consecutivosProfessores],
    dias: W[r.diasProfessores],
    turnoIsolado: W[r.turnosIsolados],
  };

  // Grelha → vetor por slot
  const slotsDe = (g: Grelha | undefined, estado: 'indisponivel' | 'evitar') => {
    const v = new Uint8Array(S);
    if (!g) return v;
    for (let d = 0; d < D; d++)
      for (let t = 0; t < T; t++) if (g[chaveGrelha(dias[d], tempos[t].id)] === estado) v[d * T + t] = 1;
    return v;
  };

  const bloqGlobal = slotsDe(projeto.bloqueios, 'indisponivel');
  const evitarGlobal = slotsDe(projeto.bloqueios, 'evitar');
  const profBloq = projeto.professores.map((p) => slotsDe(p.indisp, 'indisponivel'));
  const profEvitar = projeto.professores.map((p) => slotsDe(p.indisp, 'evitar'));
  const turmaBloq = projeto.turmas.map((t) => slotsDe(t.indisp, 'indisponivel'));
  const turmaEvitar = projeto.turmas.map((t) => slotsDe(t.indisp, 'evitar'));
  const discBloq = projeto.disciplinas.map((d) => slotsDe(d.indisp, 'indisponivel'));
  const discEvitar = projeto.disciplinas.map((d) => slotsDe(d.indisp, 'evitar'));

  const nSala = projeto.salas.length;
  const salaBloq = new Uint8Array(nSala * S);
  const salaCap = new Int32Array(nSala);
  projeto.salas.forEach((s, i) => {
    salaCap[i] = Math.max(1, Math.floor(s.capacidade || 1));
    const b = slotsDe(s.indisp, 'indisponivel');
    for (let k = 0; k < S; k++) salaBloq[i * S + k] = b[k] | bloqGlobal[k];
  });

  const limite = (v: number | null | undefined, geral: number) => {
    const x = v != null && v > 0 ? v : geral;
    return x > 0 ? Math.floor(x) : INF;
  };
  const profMaxDia = Int32Array.from(projeto.professores.map((p) => limite(p.maxTemposDia, r.maxTemposDiaProfessor)));
  const profMaxCons = Int32Array.from(
    projeto.professores.map((p) => limite(p.maxConsecutivos, r.maxConsecutivosProfessor)),
  );
  const turmaMaxDia = Int32Array.from(projeto.turmas.map((t) => limite(t.maxTemposDia, r.maxTemposDiaTurma)));

  const salasPorTipo = (tipo: string) => {
    const n = normalizar(tipo);
    const res: number[] = [];
    projeto.salas.forEach((s, i) => {
      if (normalizar(s.tipo) === n) res.push(i);
    });
    return res;
  };

  const salasCandidatas = (aula: Aula): number[] => {
    if (aula.modoSala === 'nenhuma') return [];
    if (aula.modoSala === 'fixa') {
      const i = aula.salaId ? salaIdx.get(aula.salaId) : undefined;
      return i === undefined ? [] : [i];
    }
    const disc = projeto.disciplinas[discIdx.get(aula.disciplinaId) ?? -1];
    if (disc?.tipoSala) return salasPorTipo(disc.tipoSala);
    if (aula.turmaIds.length === 1) {
      const turma = projeto.turmas[turmaIdx.get(aula.turmaIds[0]) ?? -1];
      const i = turma?.salaId ? salaIdx.get(turma.salaId) : undefined;
      if (i !== undefined) return [i];
    }
    if (cfg.atribuirSalasNormais && cfg.tipoSalaNormal) return salasPorTipo(cfg.tipoSalaNormal);
    return [];
  };

  // Turnos: rótulos locais por turma
  const turnosLocais: Map<string, number>[] = projeto.turmas.map(() => new Map());
  for (const aula of projeto.aulas) {
    const rot = normalizar(aula.turno);
    if (!rot) continue;
    for (const tid of aula.turmaIds) {
      const t = turmaIdx.get(tid);
      if (t === undefined) continue;
      const m = turnosLocais[t];
      if (!m.has(rot) && m.size < 30) m.set(rot, m.size);
    }
  }
  const turnosTurma = Int32Array.from(turnosLocais.map((m) => m.size));

  // Agrupar aulas simultâneas
  const aulasValidas = projeto.aulas.filter((a) => {
    if (!discIdx.has(a.disciplinaId)) {
      avisos.push('Aula sem disciplina válida ignorada.');
      return false;
    }
    if (!a.distribuicao?.length) return false;
    return true;
  });
  const grupos: Aula[][] = [];
  const porGrupo = new Map<string, Aula[]>();
  for (const a of aulasValidas) {
    const g = normalizar(a.simultaneo);
    if (!g) {
      grupos.push([a]);
      continue;
    }
    if (!porGrupo.has(g)) porGrupo.set(g, []);
    porGrupo.get(g)!.push(a);
  }
  for (const [nome, lista] of porGrupo) {
    const ref = lista[0].distribuicao.join('+');
    if (lista.every((a) => a.distribuicao.join('+') === ref)) grupos.push(lista);
    else {
      avisos.push(`O grupo simultâneo "${nome}" tem distribuições diferentes; as aulas foram tratadas separadamente.`);
      for (const a of lista) grupos.push([a]);
    }
  }

  const colocacoes = new Map<string, Colocacao>();
  for (const c of projeto.horario?.colocacoes ?? []) colocacoes.set(chaveColocacao(c.aulaId, c.indice), c);
  const tempoIdx = new Map(tempos.map((tp, i) => [tp.id, i]));

  const chavesDiscMapa = new Map<string, number>();
  const unidades: Unidade[] = [];
  const mapa = new Map<string, [number, number]>();

  for (const grupo of grupos) {
    const distrib = grupo[0].distribuicao;
    for (let indice = 0; indice < distrib.length; indice++) {
      const dur = Math.max(1, Math.floor(distrib[indice]));
      const u = unidades.length;
      const membros: Membro[] = [];
      const profs = new Set<number>();
      const turmas: number[] = [];
      const mascaras: number[] = [];
      const inteira: boolean[] = [];
      const chavesDisc: number[] = [];
      const maxDisc: number[] = [];

      for (const aula of grupo) {
        const disc = discIdx.get(aula.disciplinaId)!;
        membros.push({ aulaId: aula.id, indice, disc, salas: salasCandidatas(aula) });
        mapa.set(chaveColocacao(aula.id, indice), [u, membros.length - 1]);
        for (const pid of aula.professorIds) {
          const p = profIdx.get(pid);
          if (p !== undefined) profs.add(p);
        }
        const rot = normalizar(aula.turno);
        for (const tid of aula.turmaIds) {
          const t = turmaIdx.get(tid);
          if (t === undefined) continue;
          let k = turmas.indexOf(t);
          if (k < 0) {
            k = turmas.length;
            turmas.push(t);
            mascaras.push(0);
            inteira.push(false);
          }
          if (rot) mascaras[k] |= 1 << turnosLocais[t].get(rot)!;
          else inteira[k] = true;
          const chave = `${t}|${disc}|${rot}`;
          if (!chavesDiscMapa.has(chave)) chavesDiscMapa.set(chave, chavesDiscMapa.size);
          const ck = chavesDiscMapa.get(chave)!;
          if (!chavesDisc.includes(ck)) {
            chavesDisc.push(ck);
            maxDisc.push(Math.max(1, projeto.disciplinas[disc].maxPorDia || 1));
          }
        }
      }

      const profsArr = [...profs];
      const permitido = new Uint8Array(S);
      const custoEstatico = new Float64Array(S);
      const inicios: number[] = [];
      for (let d = 0; d < D; d++) {
        for (let t = 0; t + dur <= T; t++) {
          let ok = true;
          for (let i = 0; i + 1 < dur && ok; i++) if (!continua[t + i]) ok = false;
          let custo = 0;
          for (let i = 0; i < dur && ok; i++) {
            const s = d * T + t + i;
            if (bloqGlobal[s]) ok = false;
            custo += evitarGlobal[s];
            for (const p of profsArr) {
              if (profBloq[p][s]) ok = false;
              custo += profEvitar[p][s];
            }
            for (const tm of turmas) {
              if (turmaBloq[tm][s]) ok = false;
              custo += turmaEvitar[tm][s];
            }
            for (const m of membros) {
              if (discBloq[m.disc][s]) ok = false;
              custo += discEvitar[m.disc][s];
            }
          }
          // Cada membro com salas precisa de pelo menos uma sala não bloqueada
          for (const m of membros) {
            if (!ok || m.salas.length === 0) continue;
            const algumaLivre = m.salas.some((sala) => {
              for (let i = 0; i < dur; i++) if (salaBloq[sala * S + d * T + t + i]) return false;
              return true;
            });
            if (!algumaLivre) ok = false;
          }
          if (ok) {
            const s = d * T + t;
            permitido[s] = 1;
            custoEstatico[s] = custo * pesos.evitar;
            inicios.push(s);
          }
        }
      }

      // Posição atual / fixa
      let inicial = -1;
      let salasIniciais: number[] | null = null;
      let fixa = false;
      const c0 = colocacoes.get(chaveColocacao(membros[0].aulaId, indice));
      if (c0 && (opcoes.usarHorarioAtual || (opcoes.manterFixas && c0.fixa))) {
        const di = dias.indexOf(c0.dia);
        const ti = tempoIdx.get(c0.tempoId);
        if (di >= 0 && ti !== undefined) {
          inicial = di * T + ti;
          salasIniciais = membros.map((m) => {
            const c = colocacoes.get(chaveColocacao(m.aulaId, indice));
            const si = c?.salaId ? salaIdx.get(c.salaId) : undefined;
            return si === undefined ? -1 : si;
          });
          fixa = opcoes.manterFixas && membros.some((m) => colocacoes.get(chaveColocacao(m.aulaId, indice))?.fixa);
        }
      }

      const temSalas = membros.some((m) => m.salas.length > 0);
      unidades.push({
        id: u,
        dur,
        membros,
        profs: profsArr,
        turmas,
        mascaras,
        inteira,
        chavesDisc,
        maxDisc,
        permitido,
        inicios: Int32Array.from(inicios),
        custoEstatico,
        fixa,
        inicial,
        salasIniciais,
        dificuldade:
          (S - inicios.length) * 2 + dur * 8 + (profsArr.length + turmas.length) * 3 + (temSalas ? 4 : 0),
      });
    }
  }

  return {
    D,
    T,
    S,
    dias,
    tempoIds: tempos.map((t) => t.id),
    almoco,
    tarde,
    nProf: projeto.professores.length,
    nTurma: projeto.turmas.length,
    nSala,
    nChavesDisc: chavesDiscMapa.size,
    profIds: projeto.professores.map((p) => p.id),
    turmaIds: projeto.turmas.map((t) => t.id),
    salaIds: projeto.salas.map((s) => s.id),
    discIds: projeto.disciplinas.map((d) => d.id),
    salaCap,
    salaBloq,
    profMaxDia,
    profMaxCons,
    turmaMaxDia,
    turnosTurma,
    pesos,
    unidades,
    mapa,
    avisos,
  };
}
