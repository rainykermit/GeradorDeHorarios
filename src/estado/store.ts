// Estado global da aplicação: o projeto atual, histórico para anular/refazer
// e gravação automática.

import { produce, type Draft } from 'immer';
import { useEffect, useState } from 'preact/hooks';
import type { Projeto } from '../model/tipos';
import { novoProjeto } from '../model/padrao';
import { guardarLocal } from './persistencia';

type Ouvinte = () => void;

let projeto: Projeto = novoProjeto();
let passado: Projeto[] = [];
let futuro: Projeto[] = [];
let ultimoGrupo: { chave: string; quando: number } | null = null;
const ouvintes = new Set<Ouvinte>();
const MAX_HISTORICO = 80;

export type EstadoGravacao = { estado: 'guardado' | 'pendente' | 'erro'; quando: Date | null };
let gravacao: EstadoGravacao = { estado: 'guardado', quando: null };
const ouvintesGravacao = new Set<Ouvinte>();
let temporizador: ReturnType<typeof setTimeout> | null = null;
/** Indica se existem alterações desde a última vez que o projeto foi guardado num ficheiro. */
let alteradoDesdeFicheiro = false;

function notificar() {
  for (const f of ouvintes) f();
}

function agendarGravacao() {
  gravacao = { estado: 'pendente', quando: gravacao.quando };
  ouvintesGravacao.forEach((f) => f());
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(async () => {
    temporizador = null;
    try {
      await guardarLocal(projeto);
      gravacao = { estado: 'guardado', quando: new Date() };
    } catch {
      gravacao = { estado: 'erro', quando: gravacao.quando };
    }
    ouvintesGravacao.forEach((f) => f());
  }, 700);
}

export function obterProjeto(): Projeto {
  return projeto;
}

export interface OpcoesAtualizacao {
  /** Alterações sucessivas com a mesma chave (ex.: escrever num campo) contam como um só passo de anular. */
  agrupar?: string;
  semHistorico?: boolean;
}

export function atualizar(receita: (rascunho: Draft<Projeto>) => void, opcoes: OpcoesAtualizacao = {}) {
  // Alterações que não mudam nada não criam passos de "anular" nem gravações.
  const alterado = produce(projeto, receita);
  if (alterado === projeto) return;
  const novo = produce(alterado, (d) => {
    d.atualizadoEm = new Date().toISOString();
  });
  const agoraMs = Date.now();
  const mesmoGrupo =
    opcoes.agrupar && ultimoGrupo && ultimoGrupo.chave === opcoes.agrupar && agoraMs - ultimoGrupo.quando < 1500;
  if (!opcoes.semHistorico && !mesmoGrupo) {
    passado.push(projeto);
    if (passado.length > MAX_HISTORICO) passado.shift();
    futuro = [];
  }
  ultimoGrupo = opcoes.agrupar ? { chave: opcoes.agrupar, quando: agoraMs } : null;
  projeto = novo;
  alteradoDesdeFicheiro = true;
  notificar();
  agendarGravacao();
}

/** Substitui o projeto por completo (novo, abrir ficheiro, exemplo). */
export function substituirProjeto(p: Projeto, opcoes: { manterHistorico?: boolean; gravar?: boolean } = {}) {
  if (opcoes.manterHistorico) {
    passado.push(projeto);
    futuro = [];
  } else {
    passado = [];
    futuro = [];
  }
  projeto = p;
  ultimoGrupo = null;
  alteradoDesdeFicheiro = false;
  notificar();
  if (opcoes.gravar !== false) agendarGravacao();
}

export function anular() {
  const anterior = passado.pop();
  if (!anterior) return;
  futuro.push(projeto);
  projeto = anterior;
  ultimoGrupo = null;
  notificar();
  agendarGravacao();
}

export function refazer() {
  const seguinte = futuro.pop();
  if (!seguinte) return;
  passado.push(projeto);
  projeto = seguinte;
  ultimoGrupo = null;
  notificar();
  agendarGravacao();
}

export const podeAnular = () => passado.length > 0;
export const podeRefazer = () => futuro.length > 0;
export const temAlteracoesPorGuardar = () => alteradoDesdeFicheiro;
export const marcarGuardadoEmFicheiro = () => {
  alteradoDesdeFicheiro = false;
  notificar();
};

export function subscrever(f: Ouvinte) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

/** Hook: devolve o projeto atual e volta a desenhar o componente quando muda. */
export function useProjeto(): Projeto {
  const [, forcar] = useState(0);
  useEffect(() => subscrever(() => forcar((n) => n + 1)), []);
  return projeto;
}

export function useGravacao(): EstadoGravacao {
  const [, forcar] = useState(0);
  useEffect(() => {
    const f = () => forcar((n) => n + 1);
    ouvintesGravacao.add(f);
    return () => {
      ouvintesGravacao.delete(f);
    };
  }, []);
  return gravacao;
}

/** Força a gravação imediata (ex.: antes de fechar a janela). */
export async function gravarAgora() {
  if (temporizador) {
    clearTimeout(temporizador);
    temporizador = null;
  }
  await guardarLocal(projeto);
  gravacao = { estado: 'guardado', quando: new Date() };
  ouvintesGravacao.forEach((f) => f());
}
