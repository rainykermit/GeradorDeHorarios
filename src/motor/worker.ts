/// <reference lib="webworker" />
import type { Projeto } from '../model/tipos';
import { compilar } from './compilar';
import { Motor } from './motor';
import { colocacoesDoMotor } from './conversao';

export type MensagemParaWorker =
  | { tipo: 'iniciar'; projeto: Projeto; segundos: number; usarHorarioAtual: boolean; manterFixas: boolean; semente?: number }
  | { tipo: 'parar' };

export type MensagemDoWorker =
  | { tipo: 'progresso'; fase: string; colocadas: number; total: number; custo: number; decorrido: number; fracao: number }
  | { tipo: 'fim'; colocacoes: import('../model/tipos').Colocacao[]; colocadas: number; total: number; segundos: number }
  | { tipo: 'erro'; mensagem: string };

let motor: Motor | null = null;
let pararPedido = false;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<MensagemParaWorker>) => {
  const msg = e.data;
  if (msg.tipo === 'parar') {
    pararPedido = true;
    return;
  }
  if (msg.tipo === 'iniciar') {
    try {
      pararPedido = false;
      const problema = compilar(msg.projeto, { usarHorarioAtual: msg.usarHorarioAtual, manterFixas: msg.manterFixas });
      motor = new Motor(problema, { segundos: msg.segundos, semente: msg.semente });
      const m = motor;
      const passo = () => {
        if (pararPedido) m.parar();
        const terminou = m.fase === 'concluido' || m.executar(200);
        const p = m.progresso();
        if (terminou) {
          ctx.postMessage({
            tipo: 'fim',
            colocacoes: colocacoesDoMotor(problema, m),
            colocadas: p.colocadas,
            total: p.total,
            segundos: p.decorrido,
          } satisfies MensagemDoWorker);
          motor = null;
          return;
        }
        ctx.postMessage({ tipo: 'progresso', ...p } satisfies MensagemDoWorker);
        setTimeout(passo, 0);
      };
      passo();
    } catch (err) {
      ctx.postMessage({ tipo: 'erro', mensagem: String((err as Error)?.message ?? err) } satisfies MensagemDoWorker);
    }
  }
};
