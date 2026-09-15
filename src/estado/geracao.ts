// Estado da geração em curso (sobrevive à mudança de página).

import { useEffect, useState } from 'preact/hooks';
import type { Projeto } from '../model/tipos';
import { gerarHorario, type OpcoesGeracao, type ProgressoGeracao, type ResultadoGeracao } from '../motor/servico';
import { atualizar } from './store';

export interface EstadoGeracao {
  ativo: boolean;
  progresso: ProgressoGeracao | null;
  resultado: ResultadoGeracao | null;
  erro: string | null;
  segundos: number;
}

let estado: EstadoGeracao = { ativo: false, progresso: null, resultado: null, erro: null, segundos: 0 };
let parar: (() => void) | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

export function iniciarGeracao(projeto: Projeto, opcoes: OpcoesGeracao, aoTerminar?: (r: ResultadoGeracao) => void) {
  if (estado.ativo) return;
  const g = gerarHorario(projeto, opcoes, (pr) => {
    estado = { ...estado, progresso: pr };
    avisar();
  });
  parar = g.parar;
  estado = { ativo: true, progresso: null, resultado: null, erro: null, segundos: opcoes.segundos };
  avisar();
  g.resultado
    .then((r) => {
      atualizar((d) => {
        const aulas = new Map(d.aulas.map((a) => [a.id, a]));
        d.horario.colocacoes = r.colocacoes.filter((c) => {
          const a = aulas.get(c.aulaId);
          return a && c.indice < a.distribuicao.length;
        });
        d.horario.resumo = { data: new Date().toISOString(), segundos: r.segundos, totalAulas: r.total, colocadas: r.colocadas };
      });
      estado = { ...estado, ativo: false, resultado: r };
      parar = null;
      avisar();
      aoTerminar?.(r);
    })
    .catch((e: Error) => {
      estado = { ...estado, ativo: false, erro: e.message || String(e) };
      parar = null;
      avisar();
    });
}

export function pararGeracao() {
  parar?.();
}

export function useGeracao(): EstadoGeracao {
  const [, forcar] = useState(0);
  useEffect(() => {
    const f = () => forcar((n) => n + 1);
    ouvintes.add(f);
    return () => {
      ouvintes.delete(f);
    };
  }, []);
  return estado;
}
