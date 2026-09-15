import type { ID } from './tipos';

let contador = 0;
export function novoId(prefixo = ''): ID {
  contador = (contador + 1) % 1296;
  return (
    prefixo +
    Date.now().toString(36).slice(-5) +
    Math.floor(Math.random() * 1679616).toString(36).padStart(4, '0') +
    contador.toString(36).padStart(2, '0')
  );
}

/** "08:15" → 495 (minutos desde a meia-noite). Devolve NaN se inválido. */
export function paraMinutos(hora: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hora || '').trim());
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return NaN;
  return h * 60 + min;
}

export function deMinutos(total: number): string {
  const t = ((Math.round(total) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** "2+1+1" → [2,1,1]. Devolve null se inválido. */
export function lerDistribuicao(texto: string): number[] | null {
  const limpo = (texto || '').replace(/\s/g, '');
  if (!limpo) return null;
  const partes = limpo.split(/[+,;]/).filter(Boolean);
  const nums = partes.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > 8)) return null;
  return nums;
}

export const textoDistribuicao = (d: number[]) => d.join('+');

export const somaTempos = (d: number[]) => d.reduce((a, b) => a + b, 0);

/** Normaliza texto para pesquisas: sem acentos, minúsculas. */
export function normalizar(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Sigla automática a partir de um nome: "Maria João Silva" → "MJS". */
export function siglaDeNome(nome: string, max = 4): string {
  const ignorar = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o']);
  const palavras = (nome || '')
    .split(/\s+/)
    .filter((p) => p && !ignorar.has(p.toLowerCase()));
  if (palavras.length === 0) return '';
  if (palavras.length === 1) return palavras[0].slice(0, 3).toUpperCase();
  return palavras
    .map((p) => p[0])
    .join('')
    .slice(0, max)
    .toUpperCase();
}

export function compararTexto(a: string, b: string): number {
  return a.localeCompare(b, 'pt-PT', { numeric: true, sensitivity: 'base' });
}

/** Cor de texto legível (preto/branco) sobre um fundo. */
export function corTexto(fundo: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(fundo || '');
  if (!m) return '#1b2430';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#1b2430' : '#ffffff';
}

/** Versão clara de uma cor (mistura com branco). */
export function corClara(cor: string, fator = 0.72): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(cor || '');
  if (!m) return '#eef2f7';
  const n = parseInt(m[1], 16);
  const mix = (c: number) => Math.round(c + (255 - c) * fator);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

export const PALETA = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#9a6324',
  '#469990', '#800000', '#808000', '#000075', '#e6a800', '#2f8f5b', '#b0306a', '#5a6fd6',
  '#c0582d', '#6b8e23', '#7b4fa0', '#1f8aa8',
];

/** Retira a marca BOM que o Bloco de Notas do Windows pode pôr no início de um ficheiro de texto. */
export function semBOM(texto: string): string {
  return texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
}

export function plural(n: number, singular: string, pluralTxt: string) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}
