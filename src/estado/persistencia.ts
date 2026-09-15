// Gravação automática no próprio computador (IndexedDB, com alternativa em localStorage)
// e leitura/gravação de ficheiros.

import type { Projeto } from '../model/tipos';

const BD = 'gerador-de-horarios';
const LOJA = 'projetos';
const CHAVE = 'atual';
const CHAVE_LS = 'gerador-de-horarios:atual';

/** API exposta pela aplicação de computador (Electron), quando existe. */
export interface ApiDesktop {
  guardarFicheiro(nomeSugerido: string, conteudo: string | Uint8Array, filtros: { name: string; extensions: string[] }[]): Promise<string | null>;
  abrirFicheiro(filtros: { name: string; extensions: string[] }[]): Promise<{ nome: string; conteudo: string } | null>;
  versao: string;
  /** Recebe as ações escolhidas no menu da janela (novo, abrir, guardar…). */
  aoMenu?: (cb: (acao: string) => void) => void;
  /** Chamado antes de a janela fechar; a janela espera que a promessa termine. */
  aoFechar?: (cb: () => Promise<void>) => void;
  /** Ficheiro aberto com duplo clique fora da aplicação. */
  aoAbrirFicheiro?: (cb: (f: { nome: string; conteudo: string }) => void) => void;
}

declare global {
  interface Window {
    gdhDesktop?: ApiDesktop;
  }
}

export const emDesktop = () => typeof window !== 'undefined' && !!window.gdhDesktop;

function abrirBD(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('sem IndexedDB'));
    const pedido = indexedDB.open(BD, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA);
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

let bdPromessa: Promise<IDBDatabase> | null = null;
const bd = () => (bdPromessa ??= abrirBD());

export async function guardarLocal(projeto: Projeto): Promise<void> {
  const json = JSON.stringify(projeto);
  try {
    const db = await bd();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(LOJA, 'readwrite');
      tx.objectStore(LOJA).put(json, CHAVE);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    try {
      localStorage.removeItem(CHAVE_LS);
    } catch {
      /* ignorar */
    }
  } catch {
    localStorage.setItem(CHAVE_LS, json);
  }
}

export async function carregarLocal(): Promise<unknown | null> {
  try {
    const db = await bd();
    const json = await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(LOJA, 'readonly');
      const pedido = tx.objectStore(LOJA).get(CHAVE);
      pedido.onsuccess = () => resolve(pedido.result);
      pedido.onerror = () => reject(pedido.error);
    });
    if (json) return JSON.parse(json);
  } catch {
    /* tentar localStorage */
  }
  try {
    const json = localStorage.getItem(CHAVE_LS);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

export const FILTRO_HORARIO = [{ name: 'Horário (Gerador de Horários)', extensions: ['horario'] }];
export const FILTRO_FICHA = [{ name: 'Ficha de disponibilidade', extensions: ['ficha'] }];

/** Guarda um ficheiro no computador. Devolve false se o utilizador cancelou. */
export async function guardarFicheiro(
  nome: string,
  conteudo: string | Uint8Array,
  tipoMime: string,
  filtros: { name: string; extensions: string[] }[],
): Promise<boolean> {
  if (window.gdhDesktop) {
    const caminho = await window.gdhDesktop.guardarFicheiro(nome, conteudo, filtros);
    return caminho !== null;
  }
  const blob = new Blob([conteudo as BlobPart], { type: tipoMime });
  const w = window as any;
  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: nome,
        types: filtros.map((f) => ({ description: f.name, accept: { [tipoMime]: f.extensions.map((e) => '.' + e) } })),
      });
      const escrita = await handle.createWritable();
      await escrita.write(blob);
      await escrita.close();
      return true;
    } catch (e: any) {
      if (e?.name === 'AbortError') return false;
      // continua para a descarga clássica
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/** Pede ao utilizador um ou mais ficheiros e devolve o texto de cada um. */
export async function abrirFicheiros(
  extensoes: string[],
  multiplos = false,
): Promise<{ nome: string; conteudo: string }[]> {
  if (window.gdhDesktop && !multiplos) {
    const r = await window.gdhDesktop.abrirFicheiro([{ name: 'Ficheiros', extensions: extensoes.map((e) => e.replace('.', '')) }]);
    return r ? [r] : [];
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = extensoes.join(',');
    input.multiple = multiplos;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const ficheiros = Array.from(input.files ?? []);
      const res = await Promise.all(ficheiros.map(async (f) => ({ nome: f.name, conteudo: await f.text() })));
      input.remove();
      resolve(res);
    });
    input.addEventListener('cancel', () => {
      input.remove();
      resolve([]);
    });
    input.click();
  });
}
