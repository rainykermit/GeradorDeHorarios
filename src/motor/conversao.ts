// Ligação entre o Projeto (dados da interface) e o Motor.

import type { Colocacao, Projeto } from '../model/tipos';
import { compilar, type Problema } from './compilar';
import { Motor } from './motor';

export function colocacoesDoMotor(problema: Problema, motor: Motor): Colocacao[] {
  const res: Colocacao[] = [];
  const { T } = problema;
  for (let u = 0; u < motor.U; u++) {
    const s = motor.pos[u];
    if (s < 0) continue;
    const un = problema.unidades[u];
    const salas = motor.salasDe(u);
    const d = Math.floor(s / T);
    const t = s % T;
    un.membros.forEach((m, k) => {
      res.push({
        aulaId: m.aulaId,
        indice: m.indice,
        dia: problema.dias[d],
        tempoId: problema.tempoIds[t],
        salaId: salas[k] >= 0 ? problema.salaIds[salas[k]] : null,
        // O motor pode ter libertado uma fixação impossível de cumprir.
        fixa: motor.estaFixa(u),
      });
    });
  }
  return res;
}

export function colocacoesDaUnidade(problema: Problema, u: number, s: number, salas: ArrayLike<number>, fixa: boolean): Colocacao[] {
  const { T } = problema;
  const un = problema.unidades[u];
  return un.membros.map((m, k) => ({
    aulaId: m.aulaId,
    indice: m.indice,
    dia: problema.dias[Math.floor(s / T)],
    tempoId: problema.tempoIds[s % T],
    salaId: salas[k] >= 0 ? problema.salaIds[salas[k]] : null,
    fixa,
  }));
}

/** Retira do horário as colocações das unidades indicadas e acrescenta as novas. */
export function substituirColocacoes(horario: { colocacoes: Colocacao[] }, problema: Problema, unidades: number[], novas: Colocacao[]) {
  const chaves = new Set<string>();
  for (const u of unidades) for (const m of problema.unidades[u].membros) chaves.add(`${m.aulaId}#${m.indice}`);
  horario.colocacoes = horario.colocacoes.filter((c) => !chaves.has(`${c.aulaId}#${c.indice}`));
  horario.colocacoes.push(...novas);
}

export interface EstadoHorario {
  problema: Problema;
  motor: Motor;
  /** Unidades que estavam no horário mas já não são válidas (dados alterados depois de gerar). */
  invalidas: number[];
}

/** Reconstrói o estado do motor a partir do horário guardado no projeto (para análise e edição manual). */
export function estadoDoHorario(projeto: Projeto): EstadoHorario {
  const problema = compilar(projeto, { usarHorarioAtual: true, manterFixas: true });
  const motor = new Motor(problema, { semente: 1 });
  const posicoes = problema.unidades
    .map((un, u) => ({ u, s: un.inicial, salas: un.salasIniciais ?? un.membros.map(() => -1), fixa: un.fixa }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => Number(b.fixa) - Number(a.fixa));
  const invalidas = motor.carregar(posicoes);
  return { problema, motor, invalidas };
}
