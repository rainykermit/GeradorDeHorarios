// Executa o motor num Web Worker (a interface continua a responder).
// Se o worker não puder ser usado — ou falhar ao arrancar — o motor corre na própria página,
// em pequenas fatias, sem que o utilizador tenha de fazer nada.

import type { Colocacao, Projeto } from '../model/tipos';
import MotorWorker from './worker?worker&inline';
import type { MensagemDoWorker } from './worker';
import { compilar } from './compilar';
import { Motor } from './motor';
import { colocacoesDoMotor } from './conversao';

export interface ProgressoGeracao {
  fase: string;
  colocadas: number;
  total: number;
  custo: number;
  decorrido: number;
  fracao: number;
}

export interface ResultadoGeracao {
  colocacoes: Colocacao[];
  colocadas: number;
  total: number;
  segundos: number;
}

export interface OpcoesGeracao {
  segundos: number;
  usarHorarioAtual: boolean;
  manterFixas: boolean;
}

interface Execucao {
  resultado: Promise<ResultadoGeracao>;
  parar: () => void;
}

function naPagina(projeto: Projeto, opcoes: OpcoesGeracao, semente: number, aoProgredir: (p: ProgressoGeracao) => void): Execucao {
  let pararPedido = false;
  const resultado = new Promise<ResultadoGeracao>((resolve, reject) => {
    try {
      const problema = compilar(projeto, opcoes);
      const motor = new Motor(problema, { segundos: opcoes.segundos, semente });
      const passo = () => {
        try {
          if (pararPedido && motor.fase !== 'concluido') motor.parar();
          const terminou = motor.fase === 'concluido' || motor.executar(40);
          const p = motor.progresso();
          if (terminou) {
            resolve({ colocacoes: colocacoesDoMotor(problema, motor), colocadas: p.colocadas, total: p.total, segundos: p.decorrido });
          } else {
            aoProgredir(p);
            setTimeout(passo, 10);
          }
        } catch (e) {
          reject(e);
        }
      };
      setTimeout(passo, 0);
    } catch (e) {
      reject(e);
    }
  });
  return { resultado, parar: () => (pararPedido = true) };
}

export function gerarHorario(projeto: Projeto, opcoes: OpcoesGeracao, aoProgredir: (p: ProgressoGeracao) => void): Execucao {
  const semente = Math.floor(Math.random() * 2 ** 31);
  let worker: Worker | null = null;
  try {
    worker = new MotorWorker();
  } catch {
    worker = null;
  }
  if (!worker) return naPagina(projeto, opcoes, semente, aoProgredir);

  const w = worker;
  let alternativa: Execucao | null = null;
  let pararPedido = false;

  const resultado = new Promise<ResultadoGeracao>((resolve, reject) => {
    let respondeu = false;
    let terminado = false;
    const recorrer = () => {
      if (terminado || alternativa) return;
      clearTimeout(vigia);
      w.terminate();
      alternativa = naPagina(projeto, opcoes, semente, aoProgredir);
      if (pararPedido) alternativa.parar();
      alternativa.resultado.then(resolve, reject);
    };
    const vigia = setTimeout(() => {
      if (!respondeu) recorrer();
    }, 8000);

    w.onmessage = (e: MessageEvent<MensagemDoWorker>) => {
      if (alternativa) return;
      respondeu = true;
      const m = e.data;
      if (m.tipo === 'progresso') aoProgredir(m);
      else if (m.tipo === 'fim') {
        terminado = true;
        clearTimeout(vigia);
        w.terminate();
        resolve(m);
      } else if (m.tipo === 'erro') {
        terminado = true;
        clearTimeout(vigia);
        w.terminate();
        reject(new Error(m.mensagem));
      }
    };
    w.onerror = (ev) => {
      ev.preventDefault();
      if (!respondeu) recorrer();
      else if (!terminado) {
        terminado = true;
        clearTimeout(vigia);
        w.terminate();
        reject(new Error(ev.message || 'Erro no motor de geração.'));
      }
    };
    try {
      w.postMessage({ tipo: 'iniciar', projeto, semente, ...opcoes });
    } catch {
      recorrer();
    }
  });

  return {
    resultado,
    parar: () => {
      pararPedido = true;
      if (alternativa) alternativa.parar();
      else w.postMessage({ tipo: 'parar' });
    },
  };
}
