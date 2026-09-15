// Motor de geração de horários.
//
// Fase 1 — Colocação: todas as aulas são colocadas respeitando as regras obrigatórias
// (sem sobreposições de docentes, turmas e salas; indisponibilidades; máximos diários).
// Quando não há lugar livre, a aula ocupa o lugar "menos conflituoso" e as aulas em
// conflito são retiradas e voltam à fila (cadeias de ejeção com memória tabu).
//
// Fase 2 — Otimização: arrefecimento simulado (simulated annealing) que move e troca
// aulas mantendo as regras obrigatórias, minimizando furos, falta de almoço, etc.

import { INF, type Problema } from './compilar';

/** Penalização por aula não colocada: nenhuma otimização troca aulas colocadas por menos furos. */
const PENALIZACAO_NAO_COLOCADA = 1e7;

export function criarAleatorio(semente: number) {
  let a = semente >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const agora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export type Fase = 'colocar' | 'otimizar' | 'concluido';

export interface Progresso {
  fase: Fase;
  colocadas: number;
  total: number;
  custo: number;
  iteracoes: number;
  decorrido: number;
  fracao: number;
}

export interface DetalheTurma {
  furos: number;
  semAlmoco: number[];
  tardes: number;
  turnosIsolados: number;
  mesmoDia: number;
}

export interface DetalheProfessor {
  furos: number;
  semAlmoco: number[];
  excessoConsecutivos: number;
  dias: number;
}

export interface Analise {
  custo: number;
  turmas: DetalheTurma[];
  profs: DetalheProfessor[];
  aulasEmEvitar: number;
  naoColocadas: number[];
  totais: {
    furosTurmas: number;
    furosProfs: number;
    semAlmocoTurmas: number;
    semAlmocoProfs: number;
    mesmoDia: number;
    tardes: number;
    turnosIsolados: number;
    excessoConsecutivos: number;
  };
}

class Fila {
  private itens: number[] = [];
  private prio: number[] = [];
  get tamanho() {
    return this.itens.length;
  }
  push(item: number, p: number) {
    const it = this.itens;
    const pr = this.prio;
    let i = it.length;
    it.push(item);
    pr.push(p);
    while (i > 0) {
      const pai = (i - 1) >> 1;
      if (pr[pai] >= p) break;
      it[i] = it[pai];
      pr[i] = pr[pai];
      i = pai;
    }
    it[i] = item;
    pr[i] = p;
  }
  pop(): number {
    const it = this.itens;
    const pr = this.prio;
    const topo = it[0];
    const ultItem = it.pop()!;
    const ultP = pr.pop()!;
    const n = it.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let f = 2 * i + 1;
        if (f >= n) break;
        if (f + 1 < n && pr[f + 1] > pr[f]) f++;
        if (pr[f] <= ultP) break;
        it[i] = it[f];
        pr[i] = pr[f];
        i = f;
      }
      it[i] = ultItem;
      pr[i] = ultP;
    }
    return topo;
  }
  limpar() {
    this.itens.length = 0;
    this.prio.length = 0;
  }
}

export class Motor {
  readonly p: Problema;
  readonly U: number;
  private readonly S: number;
  private readonly T: number;
  private readonly D: number;

  readonly pos: Int32Array;
  readonly salas: Int32Array;
  readonly offSala: Int32Array;
  private readonly fixa: Uint8Array;

  private readonly profOcc: Int32Array;
  private readonly turmaOcc: number[][];
  private readonly salaOcc: number[][];
  private readonly profDia: Int32Array;
  private readonly turmaDiaOcup: Int32Array;
  private readonly discDia: Int32Array;
  private readonly custoProf: Float64Array;
  private readonly custoTurma: Float64Array;
  private penMesmoDia = 0;
  private penEstatico = 0;

  private readonly marca: Int32Array;
  private selo = 0;
  private readonly conf: number[] = [];
  private readonly occ: Uint8Array;
  private readonly bufMascaras: Int32Array;
  private readonly bufInteira: Uint8Array;
  private readonly almPrimeiro: number;
  private readonly almUltimo: number;
  private rnd: () => number;

  // Fase 1
  private readonly ejecoes: Int32Array;
  private readonly tabu: Int32Array;
  private readonly fila = new Fila();
  private readonly impossivel: Uint8Array;
  private iter = 0;
  private melhorPendentes = INF;
  private melhorPos: Int32Array;
  private melhorSalas: Int32Array;
  private readonly tmpA: Int32Array;
  private readonly tmpB: Int32Array;
  private readonly tmpC: Int32Array;
  private readonly tmpD: Int32Array;

  // Fase 2
  private moveis: number[] = [];
  private custoAtual = 0;
  private melhorCusto = INF;
  private temperatura = 1;
  private t0 = 1;
  private readonly tFinal = 0.02;
  private readonly chaves: Int32Array;
  private readonly guardados: Float64Array;
  private nChaves = 0;
  private readonly seloProf: Int32Array;
  private readonly seloTurma: Int32Array;
  private seloK = 0;
  private melhorGuardadoEm = 0;
  private iterSA = 0;

  // Controlo
  fase: Fase = 'colocar';
  private inicio = 0;
  private limiteColocar = 0;
  private limiteTotal = 0;
  private inicioSA = 0;
  private iniciado = false;
  private readonly segundos: number;

  constructor(p: Problema, opcoes: { segundos?: number; semente?: number } = {}) {
    this.p = p;
    this.U = p.unidades.length;
    this.S = p.S;
    this.T = p.T;
    this.D = p.D;
    this.segundos = opcoes.segundos ?? 30;
    this.rnd = criarAleatorio(opcoes.semente ?? Math.floor(Math.random() * 2 ** 31));

    const U = this.U;
    this.pos = new Int32Array(U).fill(-1);
    this.offSala = new Int32Array(U + 1);
    let maxMembros = 1;
    for (let u = 0; u < U; u++) {
      const m = p.unidades[u].membros.length;
      this.offSala[u + 1] = this.offSala[u] + m;
      if (m > maxMembros) maxMembros = m;
    }
    this.salas = new Int32Array(this.offSala[U]).fill(-1);
    this.fixa = Uint8Array.from(p.unidades.map((u) => (u.fixa ? 1 : 0)));

    this.profOcc = new Int32Array(p.nProf * this.S).fill(-1);
    this.turmaOcc = Array.from({ length: p.nTurma * this.S }, () => []);
    this.salaOcc = Array.from({ length: p.nSala * this.S }, () => []);
    this.profDia = new Int32Array(p.nProf * this.D);
    this.turmaDiaOcup = new Int32Array(p.nTurma * this.D);
    this.discDia = new Int32Array(Math.max(1, p.nChavesDisc) * this.D);
    this.custoProf = new Float64Array(p.nProf * this.D);
    this.custoTurma = new Float64Array(p.nTurma * this.D);

    this.marca = new Int32Array(U);
    this.occ = new Uint8Array(this.T);
    this.bufMascaras = new Int32Array(this.T);
    this.bufInteira = new Uint8Array(this.T);
    let primAlm = -1;
    let ultAlm = -1;
    for (let t = 0; t < this.T; t++)
      if (p.almoco[t]) {
        if (primAlm < 0) primAlm = t;
        ultAlm = t;
      }
    this.almPrimeiro = primAlm;
    this.almUltimo = ultAlm;
    this.ejecoes = new Int32Array(U);
    this.tabu = new Int32Array(U * this.S);
    this.impossivel = new Uint8Array(U);
    this.melhorPos = new Int32Array(U).fill(-1);
    this.melhorSalas = new Int32Array(this.salas.length).fill(-1);
    this.tmpA = new Int32Array(maxMembros);
    this.tmpB = new Int32Array(maxMembros);
    this.tmpC = new Int32Array(maxMembros);
    this.tmpD = new Int32Array(maxMembros);

    let maxChaves = 8;
    for (const un of p.unidades) maxChaves = Math.max(maxChaves, (un.profs.length + un.turmas.length) * 4 + 4);
    this.chaves = new Int32Array(maxChaves * 2);
    this.guardados = new Float64Array(maxChaves * 2);
    this.seloProf = new Int32Array(p.nProf * this.D);
    this.seloTurma = new Int32Array(p.nTurma * this.D);
  }

  // ───────────────────────── Estrutura básica ─────────────────────────

  private conflitoTurma(mascaraA: number, inteiraA: boolean, v: number, t: number): boolean {
    const uv = this.p.unidades[v];
    const k = uv.turmas.indexOf(t);
    if (k < 0) return false;
    if (inteiraA || uv.inteira[k]) return true;
    return (mascaraA & uv.mascaras[k]) !== 0;
  }

  colocar(u: number, s: number, salas: ArrayLike<number>) {
    const un = this.p.unidades[u];
    const { S, T, D } = this;
    const d = (s / T) | 0;
    this.pos[u] = s;
    const off = this.offSala[u];
    const nm = un.membros.length;
    for (let k = 0; k < nm; k++) this.salas[off + k] = salas[k] ?? -1;
    for (let i = 0; i < un.dur; i++) {
      const slot = s + i;
      for (const pr of un.profs) this.profOcc[pr * S + slot] = u;
      for (const t of un.turmas) {
        const lst = this.turmaOcc[t * S + slot];
        if (lst.length === 0) this.turmaDiaOcup[t * D + d]++;
        lst.push(u);
      }
      for (let k = 0; k < nm; k++) {
        const r = this.salas[off + k];
        if (r >= 0) this.salaOcc[r * S + slot].push(u);
      }
    }
    for (const pr of un.profs) this.profDia[pr * D + d] += un.dur;
    for (let k = 0; k < un.chavesDisc.length; k++) {
      const c = ++this.discDia[un.chavesDisc[k] * D + d];
      if (c > un.maxDisc[k]) this.penMesmoDia += this.p.pesos.mesmoDia;
    }
    this.penEstatico += un.custoEstatico[s];
  }

  retirar(u: number) {
    const s = this.pos[u];
    if (s < 0) return;
    const un = this.p.unidades[u];
    const { S, T, D } = this;
    const d = (s / T) | 0;
    const off = this.offSala[u];
    const nm = un.membros.length;
    for (let i = 0; i < un.dur; i++) {
      const slot = s + i;
      for (const pr of un.profs) if (this.profOcc[pr * S + slot] === u) this.profOcc[pr * S + slot] = -1;
      for (const t of un.turmas) {
        const lst = this.turmaOcc[t * S + slot];
        const j = lst.indexOf(u);
        if (j >= 0) {
          lst[j] = lst[lst.length - 1];
          lst.pop();
          if (lst.length === 0) this.turmaDiaOcup[t * D + d]--;
        }
      }
      for (let k = 0; k < nm; k++) {
        const r = this.salas[off + k];
        if (r < 0) continue;
        const lst = this.salaOcc[r * S + slot];
        const j = lst.indexOf(u);
        if (j >= 0) {
          lst[j] = lst[lst.length - 1];
          lst.pop();
        }
      }
    }
    for (const pr of un.profs) this.profDia[pr * D + d] -= un.dur;
    for (let k = 0; k < un.chavesDisc.length; k++) {
      const c = this.discDia[un.chavesDisc[k] * D + d]--;
      if (c > un.maxDisc[k]) this.penMesmoDia -= this.p.pesos.mesmoDia;
    }
    this.penEstatico -= un.custoEstatico[s];
    this.pos[u] = -1;
  }

  private salaLivre(r: number, s: number, dur: number, escolhidas: Int32Array, k: number): boolean {
    let usadas = 0;
    for (let j = 0; j < k; j++) if (escolhidas[j] === r) usadas++;
    const cap = this.p.salaCap[r];
    if (usadas >= cap) return false;
    const base = r * this.S;
    for (let i = 0; i < dur; i++) {
      const slot = s + i;
      if (this.p.salaBloq[base + slot]) return false;
      if (this.salaOcc[base + slot].length + usadas >= cap) return false;
    }
    return true;
  }

  private escolherSalas(u: number, s: number, out: Int32Array, preferidas: Int32Array | null, qualquerPreferida = false): boolean {
    const un = this.p.unidades[u];
    for (let k = 0; k < un.membros.length; k++) {
      const cands = un.membros[k].salas;
      const pref = preferidas ? preferidas[k] : -1;
      if (cands.length === 0 || (qualquerPreferida && pref >= 0 && !cands.includes(pref))) {
        // Sala escolhida à mão fora das salas habituais da aula: mantém-se se estiver livre.
        const manter = qualquerPreferida && pref >= 0 && pref < this.p.nSala && this.salaLivre(pref, s, un.dur, out, k);
        out[k] = manter ? pref : -1;
        if (manter || cands.length === 0) continue;
      }
      let escolhida = -1;
      if (pref >= 0 && cands.includes(pref) && this.salaLivre(pref, s, un.dur, out, k)) escolhida = pref;
      else {
        const n = cands.length;
        const off = n > 1 ? (this.rnd() * n) | 0 : 0;
        for (let j = 0; j < n; j++) {
          const r = cands[(off + j) % n];
          if (this.salaLivre(r, s, un.dur, out, k)) {
            escolhida = r;
            break;
          }
        }
      }
      if (escolhida < 0) return false;
      out[k] = escolhida;
    }
    return true;
  }

  /** Verifica se a unidade `u` (não colocada) pode ir para `s` sem conflitos. Preenche as salas em `out`. */
  viavel(u: number, s: number, out: Int32Array, preferidas: Int32Array | null = null, qualquerPreferida = false): boolean {
    const un = this.p.unidades[u];
    if (!un.permitido[s]) return false;
    const { S, T, D } = this;
    const d = (s / T) | 0;
    const dur = un.dur;
    for (let i = 0; i < dur; i++) {
      const slot = s + i;
      for (const pr of un.profs) {
        const v = this.profOcc[pr * S + slot];
        if (v >= 0 && v !== u) return false;
      }
      for (let k = 0; k < un.turmas.length; k++) {
        const t = un.turmas[k];
        for (const v of this.turmaOcc[t * S + slot]) {
          if (v !== u && this.conflitoTurma(un.mascaras[k], un.inteira[k], v, t)) return false;
        }
      }
    }
    for (const pr of un.profs) {
      if (this.profDia[pr * D + d] + dur > this.p.profMaxDia[pr]) return false;
    }
    for (const t of un.turmas) {
      const max = this.p.turmaMaxDia[t];
      if (max >= INF) continue;
      let novos = 0;
      for (let i = 0; i < dur; i++) if (this.turmaOcc[t * S + s + i].length === 0) novos++;
      if (this.turmaDiaOcup[t * D + d] + novos > max) return false;
    }
    return this.escolherSalas(u, s, out, preferidas, qualquerPreferida);
  }

  /** Unidades que impedem a colocação de `u` em `s` (para explicar ao utilizador). */
  conflitosEm(u: number, s: number): { unidades: number[]; maxDiaProf: number[]; maxDiaTurma: number[]; salaCheia: boolean } {
    const un = this.p.unidades[u];
    const { S, T, D } = this;
    const d = (s / T) | 0;
    const res = new Set<number>();
    const maxDiaProf: number[] = [];
    const maxDiaTurma: number[] = [];
    for (let i = 0; i < un.dur; i++) {
      const slot = s + i;
      if (slot >= S || ((slot / T) | 0) !== d) break;
      for (const pr of un.profs) {
        const v = this.profOcc[pr * S + slot];
        if (v >= 0 && v !== u) res.add(v);
      }
      for (let k = 0; k < un.turmas.length; k++) {
        const t = un.turmas[k];
        for (const v of this.turmaOcc[t * S + slot])
          if (v !== u && this.conflitoTurma(un.mascaras[k], un.inteira[k], v, t)) res.add(v);
      }
    }
    const propria = this.pos[u] >= 0 && ((this.pos[u] / T) | 0) === d;
    for (const pr of un.profs) {
      const atual = this.profDia[pr * D + d] - (propria ? un.dur : 0);
      if (atual + un.dur > this.p.profMaxDia[pr]) maxDiaProf.push(pr);
    }
    for (const t of un.turmas) {
      const max = this.p.turmaMaxDia[t];
      if (max >= INF) continue;
      let ocup = 0;
      for (let tt = 0; tt < T; tt++) {
        const slot = d * T + tt;
        const dentro = slot >= s && slot < s + un.dur;
        if (dentro || this.turmaOcc[t * S + slot].some((v) => v !== u)) ocup++;
      }
      if (ocup > max) maxDiaTurma.push(t);
    }
    let salaCheia = false;
    if (res.size === 0) {
      const estava = this.pos[u];
      const salasAntes = estava >= 0 ? this.salasDe(u) : null;
      if (estava >= 0) this.retirar(u);
      salaCheia = !this.escolherSalas(u, s, this.tmpD, null);
      if (estava >= 0) this.colocar(u, estava, salasAntes!);
    }
    return { unidades: [...res], maxDiaProf, maxDiaTurma, salaCheia };
  }

  salasDe(u: number): Int32Array {
    const off = this.offSala[u];
    return this.salas.slice(off, off + this.p.unidades[u].membros.length);
  }

  // ───────────────────────── Edição manual ─────────────────────────

  /**
   * Estado de cada tempo de início para arrastar a unidade `u`:
   * 0 = impossível, 1 = livre, 2 = livre mas a evitar, 3 = troca possível, 4 = conflito.
   */
  avaliarDestinos(u: number): { estados: Uint8Array; trocas: Int32Array } {
    const S = this.S;
    const un = this.p.unidades[u];
    const estados = new Uint8Array(S);
    const trocas = new Int32Array(S).fill(-1);
    const old = this.pos[u];
    const salasAntes = old >= 0 ? this.salasDe(u) : null;
    if (old >= 0) this.retirar(u);
    const tmp = new Int32Array(un.membros.length);
    for (let s = 0; s < S; s++) {
      if (!un.permitido[s]) continue;
      if (this.viavel(u, s, tmp, salasAntes)) {
        estados[s] = un.custoEstatico[s] > 0 ? 2 : 1;
        continue;
      }
      estados[s] = 4;
      if (old < 0 || s === old) continue;
      const conf = this.conflitosEm(u, s).unidades;
      if (conf.length !== 1) continue;
      const v = conf[0];
      const uv = this.p.unidades[v];
      if (this.fixa[v] || this.pos[v] !== s || uv.dur !== un.dur || !uv.permitido[old]) continue;
      if (this.salasParaTroca(u, v, old)) {
        estados[s] = 3;
        trocas[s] = v;
      }
    }
    if (old >= 0) this.colocar(u, old, salasAntes!);
    return { estados, trocas };
  }

  /** Salas para mover `u` para `s` (sem alterar o estado), ou null se não for possível. */
  salasParaMover(u: number, s: number): Int32Array | null {
    const old = this.pos[u];
    const salasAntes = old >= 0 ? this.salasDe(u) : null;
    if (old >= 0) this.retirar(u);
    const tmp = new Int32Array(this.p.unidades[u].membros.length);
    const ok = this.viavel(u, s, tmp, salasAntes);
    if (old >= 0) this.colocar(u, old, salasAntes!);
    return ok ? tmp : null;
  }

  /** Salas para trocar `u` (em `su`, ou na posição atual) com `v`. Não altera o estado. */
  salasParaTroca(u: number, v: number, su = this.pos[u]): [Int32Array, Int32Array] | null {
    const sv = this.pos[v];
    const uEstava = this.pos[u] >= 0;
    const salasU = uEstava ? this.salasDe(u) : new Int32Array(this.p.unidades[u].membros.length).fill(-1);
    const salasV = this.salasDe(v);
    if (uEstava) this.retirar(u);
    this.retirar(v);
    const novaU = new Int32Array(salasU.length);
    const novaV = new Int32Array(salasV.length);
    let ok = false;
    if (this.viavel(u, sv, novaU, salasV)) {
      this.colocar(u, sv, novaU);
      ok = su >= 0 && this.viavel(v, su, novaV, salasU);
      this.retirar(u);
    }
    this.colocar(v, sv, salasV);
    if (uEstava) this.colocar(u, su, salasU);
    return ok ? [novaU, novaV] : null;
  }

  /** Salas livres (qualquer sala) para o membro `k` da unidade `u` na sua posição atual. */
  salasLivres(u: number, k: number): number[] {
    const s = this.pos[u];
    if (s < 0) return [];
    const un = this.p.unidades[u];
    const off = this.offSala[u];
    const res: number[] = [];
    for (let r = 0; r < this.p.nSala; r++) {
      let ok = true;
      for (let i = 0; i < un.dur && ok; i++) {
        const slot = s + i;
        if (this.p.salaBloq[r * this.S + slot]) ok = false;
        const outros = this.salaOcc[r * this.S + slot].filter((v) => v !== u).length;
        let proprios = 0;
        for (let j = 0; j < un.membros.length; j++) if (j !== k && this.salas[off + j] === r) proprios++;
        if (outros + proprios >= this.p.salaCap[r]) ok = false;
      }
      if (ok) res.push(r);
    }
    return res;
  }

  estaFixa(u: number) {
    return this.fixa[u] === 1;
  }

  // ───────────────────────── Custos (regras preferenciais) ─────────────────────────

  private almocoEFuros(occ: Uint8Array, primeiro: number, ultimo: number): [number, number] {
    const alm = this.p.almoco;
    let livres = 0;
    let livresAlm = 0;
    for (let t = primeiro + 1; t < ultimo; t++) {
      if (!occ[t]) {
        livres++;
        if (alm[t]) livresAlm++;
      }
    }
    const furos = livres - (livresAlm > 0 ? 1 : 0);
    const primAlm = this.almPrimeiro;
    if (primAlm < 0) return [furos, 0];
    const ultAlm = this.almUltimo;
    let janelaCheia = true;
    for (let t = primAlm; t <= ultAlm; t++)
      if (alm[t] && !occ[t]) {
        janelaCheia = false;
        break;
      }
    const semAlmoco = janelaCheia && (primeiro < primAlm || ultimo > ultAlm) ? 1 : 0;
    return [furos, semAlmoco];
  }

  custoProfDia(pr: number, d: number, det?: DetalheProfessor): number {
    const { S, T } = this;
    const base = pr * S + d * T;
    const occ = this.occ;
    let primeiro = -1;
    let ultimo = -1;
    for (let t = 0; t < T; t++) {
      const o = this.profOcc[base + t] >= 0 ? 1 : 0;
      occ[t] = o;
      if (o) {
        if (primeiro < 0) primeiro = t;
        ultimo = t;
      }
    }
    if (primeiro < 0) return 0;
    const W = this.p.pesos;
    const [furos, semAlmoco] = this.almocoEFuros(occ, primeiro, ultimo);
    let excesso = 0;
    const max = this.p.profMaxCons[pr];
    if (max < INF) {
      let seguidos = 0;
      for (let t = 0; t < T; t++) {
        seguidos = occ[t] ? seguidos + 1 : 0;
        if (seguidos > max) excesso++;
      }
    }
    if (det) {
      det.furos += furos;
      if (semAlmoco) det.semAlmoco.push(d);
      det.excessoConsecutivos += excesso;
      det.dias++;
    }
    return W.dias + furos * W.furoProf + semAlmoco * W.almocoProf + excesso * W.consecutivos;
  }

  custoTurmaDia(tm: number, d: number, det?: DetalheTurma): number {
    const { S, T } = this;
    const base = tm * S + d * T;
    const occ = this.occ;
    let primeiro = -1;
    let ultimo = -1;
    let tarde = 0;
    for (let t = 0; t < T; t++) {
      const o = this.turmaOcc[base + t].length > 0 ? 1 : 0;
      occ[t] = o;
      if (o) {
        if (primeiro < 0) primeiro = t;
        ultimo = t;
        if (this.p.tarde[t]) tarde = 1;
      }
    }
    if (primeiro < 0) return 0;
    const W = this.p.pesos;
    const [furos, semAlmoco] = this.almocoEFuros(occ, primeiro, ultimo);

    let isolados = 0;
    const nTurnos = this.p.turnosTurma[tm];
    if (nTurnos > 0 && W.turnoIsolado > 0) {
      // Furos de cada subgrupo (turno) que não existem para a turma como um todo.
      const unidades = this.p.unidades;
      const mascaras = this.bufMascaras;
      const inteira = this.bufInteira;
      for (let t = primeiro; t <= ultimo; t++) {
        let m = 0;
        let int = 0;
        for (const v of this.turmaOcc[base + t]) {
          const uv = unidades[v];
          const k = uv.turmas.indexOf(tm);
          if (uv.inteira[k]) int = 1;
          m |= uv.mascaras[k];
        }
        mascaras[t] = m;
        inteira[t] = int;
      }
      for (let b = 0; b < nTurnos; b++) {
        const bit = 1 << b;
        let p1 = -1;
        let u1 = -1;
        for (let t = primeiro; t <= ultimo; t++) {
          const m = mascaras[t];
          const ocupado = inteira[t] || m & bit || popcount(m) >= 2;
          if (ocupado) {
            if (p1 < 0) p1 = t;
            u1 = t;
          }
        }
        if (p1 < 0) continue;
        for (let t = p1 + 1; t < u1; t++) {
          const m = mascaras[t];
          const ocupado = inteira[t] || m & bit || popcount(m) >= 2;
          if (!ocupado && occ[t]) isolados++;
        }
      }
    }
    if (det) {
      det.furos += furos;
      if (semAlmoco) det.semAlmoco.push(d);
      det.tardes += tarde;
      det.turnosIsolados += isolados;
    }
    return furos * W.furoTurma + semAlmoco * W.almocoTurma + tarde * W.tarde + isolados * W.turnoIsolado;
  }

  private calcularTodosCustos(): number {
    let total = 0;
    for (let pr = 0; pr < this.p.nProf; pr++)
      for (let d = 0; d < this.D; d++) {
        const c = this.custoProfDia(pr, d);
        this.custoProf[pr * this.D + d] = c;
        total += c;
      }
    for (let t = 0; t < this.p.nTurma; t++)
      for (let d = 0; d < this.D; d++) {
        const c = this.custoTurmaDia(t, d);
        this.custoTurma[t * this.D + d] = c;
        total += c;
      }
    let naoColocadas = 0;
    for (let u = 0; u < this.U; u++) if (this.pos[u] < 0) naoColocadas++;
    return total + this.penMesmoDia + this.penEstatico + naoColocadas * PENALIZACAO_NAO_COLOCADA;
  }

  // ───────────────────────── Fase 1: colocação ─────────────────────────

  /** Avalia colocar `u` em `s` retirando aulas em conflito. Devolve nº de conflitos (em this.conf) ou -1. */
  private avaliarComEjecao(u: number, s: number, out: Int32Array): number {
    const un = this.p.unidades[u];
    const { S, T, D } = this;
    const conf = this.conf;
    conf.length = 0;
    const selo = ++this.selo;
    const marca = this.marca;
    const fixa = this.fixa;
    const dur = un.dur;
    const d = (s / T) | 0;

    for (let i = 0; i < dur; i++) {
      const slot = s + i;
      for (const pr of un.profs) {
        const v = this.profOcc[pr * S + slot];
        if (v >= 0 && v !== u && marca[v] !== selo) {
          if (fixa[v]) return -1;
          marca[v] = selo;
          conf.push(v);
        }
      }
      for (let k = 0; k < un.turmas.length; k++) {
        const t = un.turmas[k];
        for (const v of this.turmaOcc[t * S + slot]) {
          if (v === u || marca[v] === selo) continue;
          if (this.conflitoTurma(un.mascaras[k], un.inteira[k], v, t)) {
            if (fixa[v]) return -1;
            marca[v] = selo;
            conf.push(v);
          }
        }
      }
    }

    // Salas
    for (let k = 0; k < un.membros.length; k++) {
      const cands = un.membros[k].salas;
      if (cands.length === 0) {
        out[k] = -1;
        continue;
      }
      let melhor = -1;
      let melhorCusto = INF;
      const n = cands.length;
      const off0 = n > 1 ? (this.rnd() * n) | 0 : 0;
      for (let j = 0; j < n && melhorCusto > 0; j++) {
        const r = cands[(off0 + j) % n];
        let usadas = 0;
        for (let q = 0; q < k; q++) if (out[q] === r) usadas++;
        const cap = this.p.salaCap[r];
        if (usadas >= cap) continue;
        let custo = 0;
        let ok = true;
        for (let i = 0; i < dur && ok; i++) {
          const slot = s + i;
          if (this.p.salaBloq[r * S + slot]) {
            ok = false;
            break;
          }
          let efetivo = usadas;
          let removiveis = 0;
          for (const v of this.salaOcc[r * S + slot]) {
            if (v === u || marca[v] === selo) continue;
            efetivo++;
            if (!fixa[v]) removiveis++;
          }
          if (efetivo >= cap) {
            const precisa = efetivo - cap + 1;
            if (removiveis < precisa) ok = false;
            else custo += precisa;
          }
        }
        if (ok && custo < melhorCusto) {
          melhorCusto = custo;
          melhor = r;
        }
      }
      if (melhor < 0) return -1;
      out[k] = melhor;
      if (melhorCusto > 0) {
        const cap = this.p.salaCap[melhor];
        let usadas = 0;
        for (let q = 0; q < k; q++) if (out[q] === melhor) usadas++;
        for (let i = 0; i < dur; i++) {
          const lst = this.salaOcc[melhor * S + s + i];
          let efetivo = usadas;
          for (const v of lst) if (v !== u && marca[v] !== selo) efetivo++;
          while (efetivo >= cap) {
            let escolhido = -1;
            for (const v of lst) {
              if (v === u || marca[v] === selo || fixa[v]) continue;
              if (escolhido < 0 || this.ejecoes[v] < this.ejecoes[escolhido]) escolhido = v;
            }
            if (escolhido < 0) return -1;
            marca[escolhido] = selo;
            conf.push(escolhido);
            efetivo--;
          }
        }
      }
    }

    // Máximos diários — docentes
    for (const pr of un.profs) {
      const max = this.p.profMaxDia[pr];
      if (max >= INF) continue;
      let total = this.profDia[pr * D + d] + dur;
      for (const v of conf) {
        const uv = this.p.unidades[v];
        if (((this.pos[v] / T) | 0) === d && uv.profs.includes(pr)) total -= uv.dur;
      }
      while (total > max) {
        let escolhido = -1;
        for (let t = 0; t < T; t++) {
          const v = this.profOcc[pr * S + d * T + t];
          if (v >= 0 && v !== u && marca[v] !== selo && !fixa[v]) {
            escolhido = v;
            if (this.rnd() < 0.5) break;
          }
        }
        if (escolhido < 0) return -1;
        marca[escolhido] = selo;
        conf.push(escolhido);
        total -= this.p.unidades[escolhido].dur;
      }
    }
    // Máximos diários — turmas
    for (const tm of un.turmas) {
      const max = this.p.turmaMaxDia[tm];
      if (max >= INF) continue;
      for (let tentativa = 0; tentativa < T; tentativa++) {
        let ocup = 0;
        let escolhido = -1;
        for (let t = 0; t < T; t++) {
          const slot = d * T + t;
          const dentro = slot >= s && slot < s + dur;
          let ocupado = dentro;
          for (const v of this.turmaOcc[tm * S + slot]) {
            if (v === u || marca[v] === selo) continue;
            ocupado = true;
            if (!dentro && !fixa[v] && (escolhido < 0 || this.rnd() < 0.3)) escolhido = v;
          }
          if (ocupado) ocup++;
        }
        if (ocup <= max) break;
        if (escolhido < 0) return -1;
        marca[escolhido] = selo;
        conf.push(escolhido);
      }
    }
    return conf.length;
  }

  private penalizacaoMesmoDia(u: number, s: number): number {
    const un = this.p.unidades[u];
    const d = (s / this.T) | 0;
    let pen = 0;
    for (let k = 0; k < un.chavesDisc.length; k++)
      if (this.discDia[un.chavesDisc[k] * this.D + d] >= un.maxDisc[k]) pen += this.p.pesos.mesmoDia;
    return pen;
  }

  private prioridade(u: number) {
    return this.p.unidades[u].dificuldade + Math.min(this.ejecoes[u], 50);
  }

  private pendentes() {
    return this.fila.tamanho;
  }

  private guardarMelhorColocacao() {
    const pend = this.pendentes();
    if (pend < this.melhorPendentes) {
      this.melhorPendentes = pend;
      this.melhorPos.set(this.pos);
      this.melhorSalas.set(this.salas);
    }
  }

  private limparEstado() {
    for (let u = 0; u < this.U; u++) if (this.pos[u] >= 0) this.retirar(u);
    this.penMesmoDia = 0;
    this.penEstatico = 0;
  }

  private restaurar(pos: Int32Array, salas: Int32Array) {
    this.limparEstado();
    for (let u = 0; u < this.U; u++) {
      if (pos[u] >= 0) {
        const off = this.offSala[u];
        this.colocar(u, pos[u], salas.subarray(off, off + this.p.unidades[u].membros.length));
      }
    }
  }

  private iniciar() {
    this.iniciado = true;
    this.inicio = agora();
    this.limiteTotal = this.inicio + this.segundos * 1000;
    this.limiteColocar = this.inicio + this.segundos * 1000 * 0.8;
    const U = this.U;
    const unidades = this.p.unidades;

    // 1) Aulas fixas
    for (let u = 0; u < U; u++) {
      const un = unidades[u];
      if (!un.fixa) continue;
      const s = un.inicial;
      const out = this.tmpA;
      const pref = un.salasIniciais ? Int32Array.from(un.salasIniciais) : null;
      if (s >= 0 && un.permitido[s] && this.viavel(u, s, out, pref)) this.colocar(u, s, out);
      else this.fixa[u] = 0; // fixação impossível: a aula volta a ser livre
    }
    // 2) Posições iniciais (horário atual)
    for (let u = 0; u < U; u++) {
      const un = unidades[u];
      if (this.pos[u] >= 0 || un.inicial < 0) continue;
      const out = this.tmpA;
      const pref = un.salasIniciais ? Int32Array.from(un.salasIniciais) : null;
      if (un.permitido[un.inicial] && this.viavel(u, un.inicial, out, pref)) this.colocar(u, un.inicial, out);
    }
    // 3) Fila com as restantes
    for (let u = 0; u < U; u++) {
      if (this.pos[u] >= 0) continue;
      if (unidades[u].inicios.length === 0) {
        this.impossivel[u] = 1;
        continue;
      }
      this.fila.push(u, this.prioridade(u) + this.rnd());
    }
    this.guardarMelhorColocacao();
  }

  private passoColocar() {
    const u = this.fila.pop();
    if (this.pos[u] >= 0) return;
    const un = this.p.unidades[u];
    const { S } = this;
    const inicios = un.inicios;
    const out = this.tmpA;
    let melhorS = -1;
    let melhorScore = Infinity;
    const ruido = 60 + Math.min(this.iter / 50, 400);
    const aleatorio = this.rnd() < 0.015;

    for (let j = 0; j < inicios.length; j++) {
      const s = inicios[j];
      const nc = this.avaliarComEjecao(u, s, out);
      if (nc < 0) continue;
      let score = 0;
      for (const v of this.conf) score += 1000 + 150 * Math.min(this.ejecoes[v], 12) + 40 * this.p.unidades[v].dur;
      if (this.tabu[u * S + s] > this.iter) score += 2500;
      score += un.custoEstatico[s] + this.penalizacaoMesmoDia(u, s);
      score += this.rnd() * (aleatorio ? 100000 : ruido);
      if (score < melhorScore) {
        melhorScore = score;
        melhorS = s;
      }
    }
    if (melhorS < 0) {
      this.impossivel[u] = 1;
      return;
    }
    if (this.avaliarComEjecao(u, melhorS, out) < 0) {
      this.fila.push(u, this.prioridade(u));
      return;
    }
    const salasEsc = Int32Array.from(out.subarray(0, un.membros.length));
    const ejetadas = [...this.conf];
    const tenure = 8 + ((this.rnd() * 12) | 0);
    for (const v of ejetadas) {
      const sv = this.pos[v];
      this.retirar(v);
      this.ejecoes[v]++;
      this.tabu[v * S + sv] = this.iter + tenure;
    }
    this.colocar(u, melhorS, salasEsc);
    for (const v of ejetadas) this.fila.push(v, this.prioridade(v) + this.rnd());
    this.iter++;
    this.guardarMelhorColocacao();
  }

  // ───────────────────────── Fase 2: otimização ─────────────────────────

  private recolher(u: number, d: number) {
    const un = this.p.unidades[u];
    const D = this.D;
    for (const pr of un.profs) {
      const key = pr * D + d;
      if (this.seloProf[key] !== this.seloK) {
        this.seloProf[key] = this.seloK;
        this.chaves[this.nChaves] = key * 2;
        this.guardados[this.nChaves] = this.custoProf[key];
        this.nChaves++;
      }
    }
    for (const t of un.turmas) {
      const key = t * D + d;
      if (this.seloTurma[key] !== this.seloK) {
        this.seloTurma[key] = this.seloK;
        this.chaves[this.nChaves] = key * 2 + 1;
        this.guardados[this.nChaves] = this.custoTurma[key];
        this.nChaves++;
      }
    }
  }

  private novaRecolha() {
    this.seloK++;
    this.nChaves = 0;
  }

  private recalcularChaves(): number {
    const D = this.D;
    let delta = 0;
    for (let i = 0; i < this.nChaves; i++) {
      const c = this.chaves[i];
      const key = c >> 1;
      const d = key % D;
      if (c & 1) {
        const v = this.custoTurmaDia((key - d) / D, d);
        this.custoTurma[key] = v;
        delta += v - this.guardados[i];
      } else {
        const v = this.custoProfDia((key - d) / D, d);
        this.custoProf[key] = v;
        delta += v - this.guardados[i];
      }
    }
    return delta;
  }

  private repororChaves() {
    for (let i = 0; i < this.nChaves; i++) {
      const c = this.chaves[i];
      if (c & 1) this.custoTurma[c >> 1] = this.guardados[i];
      else this.custoProf[c >> 1] = this.guardados[i];
    }
  }

  private aceitar(delta: number): boolean {
    if (delta <= 0) return true;
    return this.rnd() < Math.exp(-delta / this.temperatura);
  }

  /** Move uma aula para outro tempo. Devolve o delta aplicado ou NaN se rejeitado/inviável. */
  private moverAula(u: number, s: number, soAvaliar: boolean): number {
    const un = this.p.unidades[u];
    const old = this.pos[u];
    if (s === old) return NaN;
    const T = this.T;
    const salasAntes = this.tmpB;
    const off = this.offSala[u];
    const nm = un.membros.length;
    for (let k = 0; k < nm; k++) salasAntes[k] = this.salas[off + k];

    this.novaRecolha();
    this.recolher(u, (old / T) | 0);
    this.recolher(u, (s / T) | 0);
    const pm0 = this.penMesmoDia;
    const pe0 = this.penEstatico;
    this.retirar(u);
    if (!this.viavel(u, s, this.tmpA, salasAntes)) {
      this.colocar(u, old, salasAntes);
      return NaN;
    }
    this.colocar(u, s, this.tmpA);
    const delta = this.recalcularChaves() + (this.penMesmoDia - pm0) + (this.penEstatico - pe0);
    if (!soAvaliar && this.aceitar(delta)) return delta;
    this.retirar(u);
    this.colocar(u, old, salasAntes);
    this.repororChaves();
    this.penMesmoDia = pm0;
    this.penEstatico = pe0;
    return soAvaliar ? delta : NaN;
  }

  private trocarAulas(u: number, v: number, soAvaliar: boolean): number {
    const P = this.p.unidades;
    const su = this.pos[u];
    const sv = this.pos[v];
    if (su === sv || su < 0 || sv < 0) return NaN;
    if (!P[u].permitido[sv] || !P[v].permitido[su]) return NaN;
    const T = this.T;
    const salasU = this.tmpB;
    const salasV = this.tmpC;
    const offU = this.offSala[u];
    const offV = this.offSala[v];
    for (let k = 0; k < P[u].membros.length; k++) salasU[k] = this.salas[offU + k];
    for (let k = 0; k < P[v].membros.length; k++) salasV[k] = this.salas[offV + k];

    this.novaRecolha();
    this.recolher(u, (su / T) | 0);
    this.recolher(u, (sv / T) | 0);
    this.recolher(v, (su / T) | 0);
    this.recolher(v, (sv / T) | 0);
    const pm0 = this.penMesmoDia;
    const pe0 = this.penEstatico;
    this.retirar(u);
    this.retirar(v);
    const repor = () => {
      if (this.pos[u] >= 0) this.retirar(u);
      if (this.pos[v] >= 0) this.retirar(v);
      this.colocar(u, su, salasU);
      this.colocar(v, sv, salasV);
      this.penMesmoDia = pm0;
      this.penEstatico = pe0;
    };
    if (!this.viavel(u, sv, this.tmpA, salasV)) {
      repor();
      return NaN;
    }
    this.colocar(u, sv, this.tmpA);
    if (!this.viavel(v, su, this.tmpD, salasU)) {
      repor();
      return NaN;
    }
    this.colocar(v, su, this.tmpD);
    const delta = this.recalcularChaves() + (this.penMesmoDia - pm0) + (this.penEstatico - pe0);
    if (!soAvaliar && this.aceitar(delta)) return delta;
    repor();
    this.repororChaves();
    return soAvaliar ? delta : NaN;
  }

  private escolherVizinho(u: number, s: number): number {
    const un = this.p.unidades[u];
    const S = this.S;
    const n = un.profs.length + un.turmas.length;
    if (n === 0) return -1;
    let r = (this.rnd() * n) | 0;
    for (let i = 0; i < n; i++, r = (r + 1) % n) {
      if (r < un.profs.length) {
        const v = this.profOcc[un.profs[r] * S + s];
        if (v >= 0 && v !== u) return v;
      } else {
        const lst = this.turmaOcc[un.turmas[r - un.profs.length] * S + s];
        for (const v of lst) if (v !== u) return v;
      }
    }
    return -1;
  }

  private passoOtimizar(soAvaliar = false): number {
    const moveis = this.moveis;
    if (moveis.length === 0) return NaN;
    const u = moveis[(this.rnd() * moveis.length) | 0];
    const un = this.p.unidades[u];
    if (un.inicios.length < 2) return NaN;
    const s = un.inicios[(this.rnd() * un.inicios.length) | 0];
    if (s === this.pos[u]) return NaN;
    if (this.rnd() < 0.5) {
      const v = this.escolherVizinho(u, s);
      if (v >= 0 && !this.fixa[v] && this.p.unidades[v].dur === un.dur) return this.trocarAulas(u, v, soAvaliar);
    }
    return this.moverAula(u, s, soAvaliar);
  }

  private tentarColocarPendentes() {
    for (let u = 0; u < this.U; u++) {
      if (this.pos[u] >= 0 || this.impossivel[u] === 2) continue;
      const un = this.p.unidades[u];
      for (const s of un.inicios) {
        if (this.viavel(u, s, this.tmpA)) {
          this.colocar(u, s, this.tmpA);
          this.moveis.push(u);
          break;
        }
      }
    }
  }

  private iniciarOtimizacao() {
    if (this.melhorPendentes < this.pendentes()) this.restaurar(this.melhorPos, this.melhorSalas);
    this.fila.limpar();
    this.tentarColocarPendentes();
    this.fase = 'otimizar';
    this.inicioSA = agora();
    this.moveis = [];
    for (let u = 0; u < this.U; u++) if (this.pos[u] >= 0 && !this.fixa[u]) this.moveis.push(u);
    this.custoAtual = this.calcularTodosCustos();

    // Estimar temperatura inicial
    let soma = 0;
    let n = 0;
    for (let i = 0; i < 400; i++) {
      const d = this.passoOtimizar(true);
      if (d > 0) {
        soma += d;
        n++;
      }
    }
    this.t0 = n > 0 ? Math.max(0.5, (soma / n) * 0.35) : 1;
    this.temperatura = this.t0;
    this.melhorCusto = this.custoAtual;
    this.melhorPos.set(this.pos);
    this.melhorSalas.set(this.salas);
  }

  private guardarMelhor(forcar: boolean) {
    if (this.custoAtual < this.melhorCusto - 1e-9 || forcar) {
      this.melhorCusto = this.custoAtual;
      this.melhorPos.set(this.pos);
      this.melhorSalas.set(this.salas);
      this.melhorGuardadoEm = this.iterSA;
    }
  }

  private terminar() {
    if (this.fase === 'colocar') {
      if (this.melhorPendentes < this.pendentes()) this.restaurar(this.melhorPos, this.melhorSalas);
    } else if (this.fase === 'otimizar') {
      if (this.melhorCusto < this.custoAtual - 1e-9) this.restaurar(this.melhorPos, this.melhorSalas);
    }
    this.fila.limpar();
    this.fase = 'concluido';
    this.custoAtual = this.calcularTodosCustos();
  }

  /** Executa durante no máximo `ms` milissegundos. Devolve true quando terminou. */
  executar(ms: number): boolean {
    if (!this.iniciado) this.iniciar();
    const fimFatia = agora() + ms;
    while (this.fase !== 'concluido') {
      const t = agora();
      if (t >= fimFatia) break;
      if (this.fase === 'colocar') {
        if (this.fila.tamanho === 0 || t >= this.limiteColocar) {
          this.iniciarOtimizacao();
          continue;
        }
        for (let k = 0; k < 64 && this.fila.tamanho > 0; k++) this.passoColocar();
      } else {
        if (t >= this.limiteTotal || this.custoAtual <= 1e-9) {
          this.terminar();
          break;
        }
        const frac = (t - this.inicioSA) / Math.max(1, this.limiteTotal - this.inicioSA);
        // Arrefecimento geométrico; os últimos 10% são pura descida.
        this.temperatura = frac > 0.9 ? 1e-6 : this.t0 * Math.pow(this.tFinal / this.t0, frac / 0.9);
        for (let k = 0; k < 2048; k++) {
          const d = this.passoOtimizar(false);
          this.iterSA++;
          if (d === d) {
            this.custoAtual += d;
            if (this.custoAtual < this.melhorCusto - 1e-9 && (frac > 0.5 || this.iterSA - this.melhorGuardadoEm > 500))
              this.guardarMelhor(false);
          }
        }
        if (this.iterSA % 65536 < 2048) {
          if (this.moveis.length + this.contarFixas() < this.U) this.tentarColocarPendentes();
          this.custoAtual = this.calcularTodosCustos();
          this.guardarMelhor(false);
        }
      }
    }
    return this.fase === 'concluido';
  }

  private contarFixas() {
    let n = 0;
    for (let u = 0; u < this.U; u++) if (this.fixa[u] && this.pos[u] >= 0) n++;
    return n;
  }


  /** Pede ao motor que termine já, guardando o melhor resultado encontrado. */
  parar() {
    if (!this.iniciado) this.iniciar();
    if (this.fase === 'otimizar') this.guardarMelhor(false);
    this.terminar();
  }

  /** Executa até ao fim (bloqueante). Útil em testes. */
  resolver(): void {
    while (!this.executar(1000));
  }

  progresso(): Progresso {
    let colocadas = 0;
    for (let u = 0; u < this.U; u++) if (this.pos[u] >= 0) colocadas++;
    const t = agora();
    return {
      fase: this.fase,
      colocadas,
      total: this.U,
      custo: this.fase === 'otimizar' ? Math.min(this.custoAtual, this.melhorCusto) : this.custoAtual,
      iteracoes: this.iter + this.iterSA,
      decorrido: this.iniciado ? (t - this.inicio) / 1000 : 0,
      fracao: this.iniciado ? Math.min(1, (t - this.inicio) / (this.segundos * 1000)) : 0,
    };
  }

  /** Carrega um horário existente (sem otimizar). Devolve as unidades que não puderam ser colocadas. */
  carregar(posicoes: { u: number; s: number; salas: number[] }[]): number[] {
    const invalidas: number[] = [];
    for (const { u, s, salas } of posicoes) {
      const un = this.p.unidades[u];
      const pref = Int32Array.from(salas);
      if (s >= 0 && un.permitido[s] && this.viavel(u, s, this.tmpA, pref, true)) {
        // mantém a sala indicada mesmo que não seja a candidata habitual, se estiver livre
        this.colocar(u, s, this.tmpA);
      } else invalidas.push(u);
    }
    this.iniciado = true;
    this.fase = 'concluido';
    this.custoAtual = this.calcularTodosCustos();
    return invalidas;
  }

  analisar(): Analise {
    const { D } = this;
    const turmas: DetalheTurma[] = [];
    const profs: DetalheProfessor[] = [];
    let custo = 0;
    for (let t = 0; t < this.p.nTurma; t++) {
      const det: DetalheTurma = { furos: 0, semAlmoco: [], tardes: 0, turnosIsolados: 0, mesmoDia: 0 };
      for (let d = 0; d < D; d++) custo += this.custoTurmaDia(t, d, det);
      turmas.push(det);
    }
    for (let pr = 0; pr < this.p.nProf; pr++) {
      const det: DetalheProfessor = { furos: 0, semAlmoco: [], excessoConsecutivos: 0, dias: 0 };
      for (let d = 0; d < D; d++) custo += this.custoProfDia(pr, d, det);
      profs.push(det);
    }
    // Mesma disciplina no mesmo dia (contada por turma)
    const vistas = new Set<number>();
    let aulasEmEvitar = 0;
    const naoColocadas: number[] = [];
    for (let u = 0; u < this.U; u++) {
      const un = this.p.unidades[u];
      const s = this.pos[u];
      if (s < 0) {
        naoColocadas.push(u);
        continue;
      }
      if (un.custoEstatico[s] > 0) aulasEmEvitar++;
      const d = (s / this.T) | 0;
      for (let k = 0; k < un.chavesDisc.length; k++) {
        const key = un.chavesDisc[k] * D + d;
        if (vistas.has(key)) continue;
        vistas.add(key);
        const excesso = this.discDia[key] - un.maxDisc[k];
        if (excesso > 0) turmas[this.p.turmaDaChave[un.chavesDisc[k]]].mesmoDia += excesso;
      }
    }
    custo += this.penMesmoDia + this.penEstatico;
    const soma = <K extends string>(lista: Record<K, number | number[]>[], k: K) =>
      lista.reduce((a, x) => a + (Array.isArray(x[k]) ? (x[k] as number[]).length : (x[k] as number)), 0);
    return {
      custo,
      turmas,
      profs,
      aulasEmEvitar,
      naoColocadas,
      totais: {
        furosTurmas: soma(turmas as never, 'furos'),
        furosProfs: soma(profs as never, 'furos'),
        semAlmocoTurmas: soma(turmas as never, 'semAlmoco'),
        semAlmocoProfs: soma(profs as never, 'semAlmoco'),
        mesmoDia: soma(turmas as never, 'mesmoDia'),
        tardes: soma(turmas as never, 'tardes'),
        turnosIsolados: soma(turmas as never, 'turnosIsolados'),
        excessoConsecutivos: soma(profs as never, 'excessoConsecutivos'),
      },
    };
  }

  unidadeImpossivel(u: number) {
    return this.impossivel[u] === 1;
  }
}

function popcount(x: number) {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}
