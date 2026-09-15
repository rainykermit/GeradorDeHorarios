// Fichas de disponibilidade: preenchidas por cada docente e importadas pelo responsável.

import type { FichaDocente, Grelha, Projeto } from './tipos';
import { chaveGrelha } from './tipos';
import { configPadrao } from './padrao';
import { normalizar, paraMinutos, semBOM } from './util';

export function fichaModelo(p: Projeto | null): FichaDocente {
  const cfg = p && p.config.tempos.length ? p.config : configPadrao();
  return {
    formato: 'gerador-de-horarios-ficha',
    versao: 1,
    nome: '',
    sigla: '',
    email: '',
    escola: p?.escola ?? '',
    dias: [...cfg.dias],
    tempos: cfg.tempos.map((t) => ({ ...t })),
    indisp: {},
    notas: '',
    criadaEm: new Date().toISOString(),
  };
}

export function lerFicha(texto: string): FichaDocente {
  let o: any;
  try {
    o = JSON.parse(semBOM(texto));
  } catch {
    throw new Error('O ficheiro não é uma ficha de disponibilidade válida.');
  }
  if (!o || o.formato !== 'gerador-de-horarios-ficha') throw new Error('O ficheiro não é uma ficha de disponibilidade do Gerador de Horários.');
  return {
    formato: 'gerador-de-horarios-ficha',
    versao: 1,
    nome: String(o.nome ?? ''),
    sigla: String(o.sigla ?? ''),
    email: String(o.email ?? ''),
    escola: String(o.escola ?? ''),
    dias: Array.isArray(o.dias) ? o.dias.filter((d: unknown) => Number.isInteger(d)) : [0, 1, 2, 3, 4],
    tempos: Array.isArray(o.tempos) ? o.tempos.filter((t: any) => t && t.id && t.inicio) : [],
    indisp: o.indisp && typeof o.indisp === 'object' ? o.indisp : {},
    notas: String(o.notas ?? ''),
    criadaEm: String(o.criadaEm ?? ''),
  };
}

/** Converte a grelha da ficha para os tempos do projeto (associando pela hora de início). */
export function grelhaDaFicha(ficha: FichaDocente, p: Projeto): { grelha: Grelha; naoAssociados: number } {
  const grelha: Grelha = {};
  let naoAssociados = 0;
  const porHora = new Map(p.config.tempos.map((t) => [paraMinutos(t.inicio), t.id]));
  const fichaOrdenada = [...ficha.tempos].sort((a, b) => paraMinutos(a.inicio) - paraMinutos(b.inicio));
  const projetoOrdenado = [...p.config.tempos].sort((a, b) => paraMinutos(a.inicio) - paraMinutos(b.inicio));
  for (const [chave, estado] of Object.entries(ficha.indisp)) {
    if (estado !== 'indisponivel' && estado !== 'evitar') continue;
    const [diaTxt, tempoId] = chave.split('|');
    const dia = Number(diaTxt);
    const tf = ficha.tempos.find((t) => t.id === tempoId);
    if (!tf) continue;
    let destino = porHora.get(paraMinutos(tf.inicio));
    if (!destino) {
      const i = fichaOrdenada.indexOf(tf);
      destino = projetoOrdenado[i]?.id;
    }
    if (destino && p.config.dias.includes(dia)) grelha[chaveGrelha(dia, destino)] = estado;
    else naoAssociados++;
  }
  return { grelha, naoAssociados };
}

export function associarFicha(ficha: FichaDocente, p: Projeto): string | null {
  const nome = normalizar(ficha.nome);
  const email = normalizar(ficha.email);
  const sigla = normalizar(ficha.sigla);
  return (
    p.professores.find((x) => nome && normalizar(x.nome) === nome)?.id ??
    p.professores.find((x) => email && normalizar(x.email) === email)?.id ??
    p.professores.find((x) => sigla && normalizar(x.sigla) === sigla)?.id ??
    null
  );
}
