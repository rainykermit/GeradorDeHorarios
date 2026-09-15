// Verificação dos dados antes de gerar o horário, com mensagens claras para o utilizador.

import type { Projeto } from './tipos';
import { chaveGrelha } from './tipos';
import { compilar, temposOrdenados } from '../motor/compilar';
import { descreverAula, indices } from './consultas';
import { normalizar, paraMinutos, somaTempos } from './util';

export type Pagina =
  | 'inicio'
  | 'escola'
  | 'disciplinas'
  | 'salas'
  | 'professores'
  | 'turmas'
  | 'aulas'
  | 'regras'
  | 'gerar'
  | 'horarios'
  | 'ajuda';

export interface Destino {
  pagina: Pagina;
  id?: string;
}

export interface Ocorrencia {
  nivel: 'erro' | 'aviso';
  texto: string;
  destino?: Destino;
}

export function verificarProjeto(p: Projeto): Ocorrencia[] {
  const res: Ocorrencia[] = [];
  const erro = (texto: string, destino?: Destino) => res.push({ nivel: 'erro', texto, destino });
  const aviso = (texto: string, destino?: Destino) => res.push({ nivel: 'aviso', texto, destino });
  const idx = indices(p);
  const cfg = p.config;

  // ── Horário da escola
  if (cfg.dias.length === 0) erro('Não há dias de aulas selecionados.', { pagina: 'escola' });
  if (cfg.tempos.length === 0) erro('Não há tempos letivos definidos.', { pagina: 'escola' });
  const tempos = temposOrdenados(p);
  let temposValidos = true;
  tempos.forEach((t, i) => {
    const ini = paraMinutos(t.inicio);
    const fim = paraMinutos(t.fim);
    if (Number.isNaN(ini) || Number.isNaN(fim) || fim <= ini) {
      erro(`O tempo ${i + 1} tem horas inválidas (${t.inicio}–${t.fim}).`, { pagina: 'escola' });
      temposValidos = false;
    } else if (i > 0 && ini < paraMinutos(tempos[i - 1].fim)) {
      erro(`Os tempos ${i} e ${i + 1} sobrepõem-se (${tempos[i - 1].inicio}–${tempos[i - 1].fim} e ${t.inicio}–${t.fim}).`, {
        pagina: 'escola',
      });
      temposValidos = false;
    }
  });
  if (res.some((r) => r.nivel === 'erro')) return res;

  const almIni = paraMinutos(cfg.almocoInicio);
  const almFim = paraMinutos(cfg.almocoFim);
  if (
    (p.regras.almocoTurmas > 0 || p.regras.almocoProfessores > 0) &&
    !tempos.some((t) => paraMinutos(t.inicio) >= almIni && paraMinutos(t.fim) <= almFim)
  )
    aviso(
      `Nenhum tempo cabe inteiramente no período de almoço (${cfg.almocoInicio}–${cfg.almocoFim}); a regra do almoço não terá efeito.`,
      { pagina: 'escola' },
    );

  // ── Dados base
  if (p.aulas.length === 0) erro('Ainda não existem aulas para colocar no horário.', { pagina: 'aulas' });

  const siglas = new Map<string, string>();
  for (const d of p.disciplinas) {
    if (!d.nome.trim()) erro('Existe uma disciplina sem nome.', { pagina: 'disciplinas', id: d.id });
    const s = normalizar(d.sigla);
    if (s && siglas.has(s)) aviso(`As disciplinas "${siglas.get(s)}" e "${d.nome}" têm a mesma sigla (${d.sigla}).`, { pagina: 'disciplinas', id: d.id });
    siglas.set(s, d.nome);
  }
  const nomesProf = new Set<string>();
  for (const pr of p.professores) {
    if (!pr.nome.trim()) erro('Existe um docente sem nome.', { pagina: 'professores', id: pr.id });
    const n = normalizar(pr.nome);
    if (n && nomesProf.has(n)) aviso(`Há dois docentes com o nome "${pr.nome}".`, { pagina: 'professores', id: pr.id });
    nomesProf.add(n);
  }
  const nomesTurma = new Set<string>();
  for (const t of p.turmas) {
    if (!t.nome.trim()) erro('Existe uma turma sem nome.', { pagina: 'turmas', id: t.id });
    const n = normalizar(t.nome);
    if (n && nomesTurma.has(n)) aviso(`Há duas turmas com o nome "${t.nome}".`, { pagina: 'turmas', id: t.id });
    nomesTurma.add(n);
  }

  // Maior bloco possível de tempos seguidos
  let maiorBloco = tempos.length ? 1 : 0;
  let atual = 1;
  for (let i = 0; i + 1 < tempos.length; i++) {
    if (paraMinutos(tempos[i + 1].inicio) - paraMinutos(tempos[i].fim) <= cfg.intervaloMaxBloco) atual++;
    else atual = 1;
    maiorBloco = Math.max(maiorBloco, atual);
  }

  const tiposComSalas = new Set(p.salas.map((s) => normalizar(s.tipo)));

  // ── Aulas
  for (const a of p.aulas) {
    const destino: Destino = { pagina: 'aulas', id: a.id };
    const desc = descreverAula(p, a);
    const disc = idx.disc.get(a.disciplinaId);
    if (!disc) {
      erro(`Há uma aula sem disciplina (${desc}).`, destino);
      continue;
    }
    if (a.distribuicao.length === 0) erro(`A aula "${desc}" não tem tempos semanais definidos.`, destino);
    if (a.professorIds.length === 0 && a.turmaIds.length === 0)
      aviso(`A aula "${desc}" não tem turma nem docente; não afeta nenhum horário.`, destino);
    else if (a.professorIds.length === 0) aviso(`A aula "${desc}" ainda não tem docente atribuído.`, destino);
    const bloco = Math.max(0, ...a.distribuicao);
    if (temposValidos && bloco > maiorBloco)
      erro(
        `A aula "${desc}" tem um bloco de ${bloco} tempos, mas o horário só tem ${maiorBloco} tempos seguidos (sem intervalos maiores que ${cfg.intervaloMaxBloco} min).`,
        destino,
      );
    if (a.modoSala === 'fixa' && (!a.salaId || !idx.sala.get(a.salaId)))
      erro(`A aula "${desc}" está marcada com sala fixa mas não tem sala escolhida.`, destino);
    if (a.modoSala === 'auto' && disc.tipoSala && !tiposComSalas.has(normalizar(disc.tipoSala)))
      erro(`A disciplina ${disc.nome} precisa de uma sala do tipo "${disc.tipoSala}", mas não existe nenhuma sala desse tipo.`, {
        pagina: 'salas',
      });
    if (a.distribuicao.length > p.config.dias.length * Math.max(1, disc.maxPorDia) && a.turmaIds.length)
      aviso(
        `A aula "${desc}" tem ${a.distribuicao.length} aulas semanais para ${p.config.dias.length} dias; algumas vão calhar no mesmo dia.`,
        destino,
      );
  }

  // ── Grupos simultâneos
  const grupos = new Map<string, typeof p.aulas>();
  for (const a of p.aulas) {
    const g = normalizar(a.simultaneo);
    if (!g) continue;
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g)!.push(a);
  }
  for (const lista of grupos.values()) {
    const nome = lista[0].simultaneo;
    if (lista.length === 1) {
      aviso(`O grupo simultâneo "${nome}" só tem uma aula.`, { pagina: 'aulas', id: lista[0].id });
      continue;
    }
    const ref = lista[0].distribuicao.join('+');
    if (!lista.every((a) => a.distribuicao.join('+') === ref))
      erro(`As aulas do grupo simultâneo "${nome}" têm de ter a mesma distribuição semanal (ex.: todas 1+1+1).`, {
        pagina: 'aulas',
        id: lista[0].id,
      });
    const profs = new Map<string, number>();
    const turnos = new Map<string, number>();
    for (const a of lista) {
      for (const id of a.professorIds) profs.set(id, (profs.get(id) ?? 0) + 1);
      for (const t of a.turmaIds) {
        const chave = `${t}|${normalizar(a.turno)}`;
        turnos.set(chave, (turnos.get(chave) ?? 0) + 1);
      }
    }
    for (const [id, n] of profs)
      if (n > 1)
        erro(`No grupo simultâneo "${nome}", o docente ${idx.prof.get(id)?.nome ?? '?'} teria de estar em duas aulas ao mesmo tempo.`, {
          pagina: 'aulas',
          id: lista[0].id,
        });
    for (const [chave, n] of turnos) {
      const [tid, turno] = chave.split('|');
      const inteira = turnos.has(`${tid}|`);
      if (n > 1 || (inteira && turno))
        erro(
          `No grupo simultâneo "${nome}", a turma ${idx.turma.get(tid)?.nome ?? '?'} teria duas aulas ao mesmo tempo. Indique turnos diferentes (ex.: "Turno 1" e "Turno 2").`,
          { pagina: 'aulas', id: lista[0].id },
        );
    }
  }

  // ── Capacidade por docente e turma
  const nDias = cfg.dias.length;
  const slotsLivres = (indisp: Record<string, string>) => {
    let n = 0;
    for (const d of cfg.dias)
      for (const t of tempos) {
        const k = chaveGrelha(d, t.id);
        if (p.bloqueios[k] !== 'indisponivel' && indisp[k] !== 'indisponivel') n++;
      }
    return n;
  };
  const cargaProf = new Map<string, number>();
  const contadosProf = new Set<string>();
  for (const a of p.aulas) {
    const g = normalizar(a.simultaneo);
    for (const id of a.professorIds) {
      if (g) {
        const k = `${g}|${id}`;
        if (contadosProf.has(k)) continue;
        contadosProf.add(k);
      }
      cargaProf.set(id, (cargaProf.get(id) ?? 0) + somaTempos(a.distribuicao));
    }
  }
  for (const pr of p.professores) {
    const carga = cargaProf.get(pr.id) ?? 0;
    if (carga === 0) continue;
    const livres = slotsLivres(pr.indisp);
    if (carga > livres)
      erro(`${pr.nome} tem ${carga} tempos de aulas mas só está disponível em ${livres} tempos por semana.`, {
        pagina: 'professores',
        id: pr.id,
      });
    const max = pr.maxTemposDia ?? p.regras.maxTemposDiaProfessor;
    if (max > 0 && carga > max * nDias)
      erro(`${pr.nome} tem ${carga} tempos, mais do que o máximo de ${max} tempos por dia × ${nDias} dias permite.`, {
        pagina: 'professores',
        id: pr.id,
      });
  }

  for (const t of p.turmas) {
    let inteira = 0;
    const porTurno = new Map<string, number>();
    const grupoContado = new Set<string>();
    for (const a of p.aulas) {
      if (!a.turmaIds.includes(t.id)) continue;
      const g = normalizar(a.simultaneo);
      const turno = normalizar(a.turno);
      if (g) {
        const k = `${g}|${turno ? 'T' : ''}`;
        if (grupoContado.has(k)) continue;
        grupoContado.add(k);
      }
      if (turno) porTurno.set(turno, (porTurno.get(turno) ?? 0) + somaTempos(a.distribuicao));
      else inteira += somaTempos(a.distribuicao);
    }
    const minimo = inteira + Math.max(0, ...porTurno.values());
    if (minimo === 0) {
      aviso(`A turma ${t.nome} ainda não tem aulas.`, { pagina: 'turmas', id: t.id });
      continue;
    }
    const livres = slotsLivres(t.indisp);
    if (minimo > livres)
      erro(`A turma ${t.nome} tem ${minimo} tempos de aulas mas só ${livres} tempos disponíveis por semana.`, {
        pagina: 'turmas',
        id: t.id,
      });
    const max = t.maxTemposDia ?? p.regras.maxTemposDiaTurma;
    if (max > 0 && minimo > max * nDias)
      erro(`A turma ${t.nome} tem ${minimo} tempos, mais do que o máximo de ${max} tempos por dia × ${nDias} dias permite.`, {
        pagina: 'turmas',
        id: t.id,
      });
  }

  // ── Aulas sem nenhum tempo possível
  if (!res.some((r) => r.nivel === 'erro')) {
    const problema = compilar(p, { usarHorarioAtual: false, manterFixas: false });
    const vistas = new Set<string>();
    for (const un of problema.unidades) {
      if (un.inicios.length > 0) continue;
      const aula = idx.aula.get(un.membros[0].aulaId);
      if (!aula || vistas.has(aula.id)) continue;
      vistas.add(aula.id);
      const envolvidos = [
        ...un.profs.map((i) => p.professores[i].nome),
        ...un.turmas.map((i) => `turma ${p.turmas[i].nome}`),
        ...new Set(un.membros.map((m) => `disciplina ${p.disciplinas[m.disc].nome}`)),
      ];
      if (un.membros.some((m) => m.salas.length)) envolvidos.push('salas');
      erro(
        `Não há nenhum tempo possível para "${descreverAula(p, aula)}" (${un.dur === 1 ? '1 tempo' : `bloco de ${un.dur} tempos`}). ` +
          `Verifique as indisponibilidades de: ${envolvidos.join(', ')}.`,
        { pagina: 'aulas', id: aula.id },
      );
    }

    // Procura de salas por tipo
    const procura = new Map<number, number>();
    for (const un of problema.unidades)
      for (const m of un.membros)
        if (m.salas.length > 1 || (m.salas.length === 1 && p.salas[m.salas[0]].capacidade > 1)) {
          const k = m.salas[0];
          procura.set(k, (procura.get(k) ?? 0) + un.dur);
        }
    for (const [primeira, tempos2] of procura) {
      const tipo = p.salas[primeira].tipo;
      const capacidade = p.salas
        .filter((s) => normalizar(s.tipo) === normalizar(tipo))
        .reduce((a, s) => a + s.capacidade * problema.S, 0);
      if (tempos2 > capacidade)
        erro(`As salas do tipo "${tipo}" não chegam: são precisos ${tempos2} tempos e só há ${capacidade} disponíveis.`, {
          pagina: 'salas',
        });
      else if (tempos2 > capacidade * 0.85)
        aviso(`As salas do tipo "${tipo}" estão quase sempre ocupadas (${tempos2} de ${capacidade} tempos). O horário pode ficar difícil.`, {
          pagina: 'salas',
        });
    }
    for (const a of problema.avisos) aviso(a, { pagina: 'aulas' });
  }

  return res;
}
