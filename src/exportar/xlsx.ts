// Exportação para Excel (.xlsx) sem bibliotecas externas: XML SpreadsheetML num ZIP.

import type { Projeto } from '../model/tipos';
import { NOMES_DIAS } from '../model/tipos';
import { type TipoEntidade, chaveCelula, entidadesDe, grelhaDe, nomeEntidade, rotulosItem } from '../model/grelhaHorario';
import { indices, nomesProfessores, nomesTurmas } from '../model/consultas';
import { compararTexto, corClara, somaTempos, textoDistribuicao } from '../model/util';

// ───────── ZIP (método "store") ─────────

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(dados: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < dados.length; i++) c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function criarZip(ficheiros: { nome: string; conteudo: string | Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const agora = new Date();
  const hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1);
  const data = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of ficheiros) {
    const nome = enc.encode(f.nome);
    const dados = typeof f.conteudo === 'string' ? enc.encode(f.conteudo) : f.conteudo;
    const crc = crc32(dados);
    const local = new Uint8Array(30 + nome.length);
    const v = new DataView(local.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x0800, true);
    v.setUint16(8, 0, true);
    v.setUint16(10, hora, true);
    v.setUint16(12, data, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, dados.length, true);
    v.setUint32(22, dados.length, true);
    v.setUint16(26, nome.length, true);
    v.setUint16(28, 0, true);
    local.set(nome, 30);
    partes.push(local, dados);

    const cd = new Uint8Array(46 + nome.length);
    const w = new DataView(cd.buffer);
    w.setUint32(0, 0x02014b50, true);
    w.setUint16(4, 20, true);
    w.setUint16(6, 20, true);
    w.setUint16(8, 0x0800, true);
    w.setUint16(10, 0, true);
    w.setUint16(12, hora, true);
    w.setUint16(14, data, true);
    w.setUint32(16, crc, true);
    w.setUint32(20, dados.length, true);
    w.setUint32(24, dados.length, true);
    w.setUint16(28, nome.length, true);
    w.setUint32(42, offset, true);
    cd.set(nome, 46);
    central.push(cd);
    offset += local.length + dados.length;
  }
  const tamCentral = central.reduce((a, c) => a + c.length, 0);
  const fim = new Uint8Array(22);
  const e = new DataView(fim.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, ficheiros.length, true);
  e.setUint16(10, ficheiros.length, true);
  e.setUint32(12, tamCentral, true);
  e.setUint32(16, offset, true);
  const total = offset + tamCentral + 22;
  const res = new Uint8Array(total);
  let pos = 0;
  for (const p of [...partes, ...central, fim]) {
    res.set(p, pos);
    pos += p.length;
  }
  return res;
}

// ───────── Livro de Excel ─────────

interface Estilo {
  negrito?: boolean;
  tamanho?: number;
  fundo?: string;
  borda?: boolean;
  centro?: boolean;
  quebra?: boolean;
}

interface Celula {
  v: string | number;
  e?: Estilo;
}

interface Folha {
  nome: string;
  linhas: (Celula | null)[][];
  larguras: number[];
  alturas?: Map<number, number>;
  unir: string[];
}

// Construída a partir de texto: um carácter nulo literal no código seria corrompido dentro do HTML.
const CONTROLO = new RegExp('[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]', 'g');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(CONTROLO, '');

function colunaLetra(n: number) {
  let s = '';
  n++;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

class Livro {
  folhas: Folha[] = [];
  private estilos = new Map<string, number>();
  private listaEstilos: Estilo[] = [{}];
  private fundos: string[] = [];

  estilo(e?: Estilo): number {
    if (!e) return 0;
    const k = JSON.stringify(e);
    let i = this.estilos.get(k);
    if (i === undefined) {
      i = this.listaEstilos.length;
      this.listaEstilos.push(e);
      this.estilos.set(k, i);
      if (e.fundo && !this.fundos.includes(e.fundo)) this.fundos.push(e.fundo);
    }
    return i;
  }

  nomeUnico(nome: string) {
    let base = nome.replace(/[\[\]:*?/\\]/g, '-').slice(0, 31).trim() || 'Folha';
    let n = 2;
    let final = base;
    const usados = new Set(this.folhas.map((f) => f.nome.toLowerCase()));
    while (usados.has(final.toLowerCase())) {
      const suf = ` (${n++})`;
      final = base.slice(0, 31 - suf.length) + suf;
    }
    return final;
  }

  private xmlEstilos() {
    const fontes = ['<font><sz val="10"/><name val="Calibri"/></font>', '<font><b/><sz val="10"/><name val="Calibri"/></font>', '<font><b/><sz val="14"/><name val="Calibri"/></font>', '<font><sz val="9"/><name val="Calibri"/></font>'];
    const fontId = (e: Estilo) => (e.tamanho && e.tamanho >= 14 ? 2 : e.negrito ? 1 : e.tamanho && e.tamanho < 10 ? 3 : 0);
    const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>', ...this.fundos.map((c) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${c.replace('#', '').toUpperCase()}"/><bgColor indexed="64"/></patternFill></fill>`)];
    const borda = '<border><left style="thin"><color rgb="FF9A9A9A"/></left><right style="thin"><color rgb="FF9A9A9A"/></right><top style="thin"><color rgb="FF9A9A9A"/></top><bottom style="thin"><color rgb="FF9A9A9A"/></bottom><diagonal/></border>';
    const xfs = this.listaEstilos.map((e) => {
      const fill = e.fundo ? 2 + this.fundos.indexOf(e.fundo) : 0;
      const al = e.centro || e.quebra ? `<alignment${e.centro ? ' horizontal="center"' : ''} vertical="center"${e.quebra ? ' wrapText="1"' : ''}/>` : '';
      return `<xf numFmtId="0" fontId="${fontId(e)}" fillId="${fill}" borderId="${e.borda ? 1 : 0}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${al}</xf>`;
    });
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<fonts count="${fontes.length}">${fontes.join('')}</fonts>` +
      `<fills count="${fills.length}">${fills.join('')}</fills>` +
      `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${borda}</borders>` +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
    );
  }

  private xmlFolha(f: Folha) {
    const cols = f.larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
    const linhas = f.linhas
      .map((linha, r) => {
        const altura = f.alturas?.get(r);
        const cels = linha
          .map((c, i) => {
            if (!c) return '';
            const ref = `${colunaLetra(i)}${r + 1}`;
            const s = this.estilo(c.e);
            if (typeof c.v === 'number') return `<c r="${ref}" s="${s}"><v>${c.v}</v></c>`;
            return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
          })
          .join('');
        return `<row r="${r + 1}"${altura ? ` ht="${altura}" customHeight="1"` : ''}>${cels}</row>`;
      })
      .join('');
    const unir = f.unir.length ? `<mergeCells count="${f.unir.length}">${f.unir.map((u) => `<mergeCell ref="${u}"/>`).join('')}</mergeCells>` : '';
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/>' +
      (cols ? `<cols>${cols}</cols>` : '') +
      `<sheetData>${linhas}</sheetData>${unir}` +
      '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="1"/></worksheet>'
    );
  }

  gerar(): Uint8Array {
    // Pré-registar estilos (antes de gerar styles.xml)
    const folhasXml = this.folhas.map((f) => this.xmlFolha(f));
    const ficheiros = [
      {
        nome: '[Content_Types].xml',
        conteudo:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          this.folhas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
          '</Types>',
      },
      {
        nome: '_rels/.rels',
        conteudo:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
      },
      {
        nome: 'xl/workbook.xml',
        conteudo:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
          this.folhas.map((f, i) => `<sheet name="${esc(f.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
          '</sheets></workbook>',
      },
      {
        nome: 'xl/_rels/workbook.xml.rels',
        conteudo:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          this.folhas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
          `<Relationship Id="rId${this.folhas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      },
      ...folhasXml.map((x, i) => ({ nome: `xl/worksheets/sheet${i + 1}.xml`, conteudo: x })),
      { nome: 'xl/styles.xml', conteudo: this.xmlEstilos() },
    ];
    return criarZip(ficheiros);
  }
}

export interface OpcoesExcel {
  geralTurmas: boolean;
  geralProfs: boolean;
  turmas: boolean;
  profs: boolean;
  salas: boolean;
  distribuicao: boolean;
}

const TITULO: Record<TipoEntidade, string> = { turma: 'Turma', prof: 'Docente', sala: 'Sala' };

function folhaEntidade(livro: Livro, p: Projeto, tipo: TipoEntidade, id: string, prefixo: string) {
  const g = grelhaDe(p, tipo, id);
  const idx = indices(p);
  const nome = nomeEntidade(p, tipo, id);
  const linhas: (Celula | null)[][] = [];
  const unir: string[] = [];
  const nCols = g.dias.length + 1;
  linhas.push([{ v: `${TITULO[tipo]} ${nome}`, e: { tamanho: 14 } }]);
  unir.push(`A1:${colunaLetra(nCols - 1)}1`);
  let sub = `${p.escola} · Ano letivo ${p.anoLetivo}`;
  if (tipo === 'turma') {
    const t = idx.turma.get(id);
    if (t?.dtId) sub += ` · Diretor(a) de turma: ${idx.prof.get(t.dtId)?.nome ?? ''}`;
  }
  linhas.push([{ v: sub }]);
  unir.push(`A2:${colunaLetra(nCols - 1)}2`);
  const cab: Estilo = { negrito: true, borda: true, centro: true, fundo: '#E4E8EF' };
  linhas.push([{ v: 'Tempo', e: cab }, ...g.dias.map((d) => ({ v: NOMES_DIAS[d], e: cab }))]);
  const alturas = new Map<number, number>();
  const base = linhas.length;
  g.tempos.forEach((t, ti) => {
    const linha: (Celula | null)[] = [{ v: `${t.inicio}–${t.fim}`, e: { borda: true, centro: true, negrito: true } }];
    let maxLinhas = 1;
    g.dias.forEach((d) => {
      const itens = g.celulas.get(chaveCelula(d, ti)) ?? [];
      if (!itens.length) {
        linha.push({ v: '', e: { borda: true } });
        return;
      }
      const textos = itens.map((it) => {
        const r = rotulosItem(p, it, tipo);
        return [r.titulo, ...r.linhas].join('\n');
      });
      maxLinhas = Math.max(maxLinhas, textos.join('\n').split('\n').length);
      const fundo = corClara(itens[0].disc?.cor ?? '#dddddd', 0.72).toUpperCase();
      linha.push({ v: textos.join('\n—\n'), e: { borda: true, centro: true, quebra: true, fundo } });
    });
    alturas.set(base + ti, Math.max(30, maxLinhas * 13));
    linhas.push(linha);
  });
  // Unir blocos verticalmente
  g.dias.forEach((d, di) => {
    g.tempos.forEach((_, ti) => {
      const itens = g.celulas.get(chaveCelula(d, ti)) ?? [];
      if (itens.length !== 1 || itens[0].parte !== 0 || itens[0].dur < 2) return;
      let fim = ti;
      for (let k = 1; k < itens[0].dur; k++) {
        const o = g.celulas.get(chaveCelula(d, ti + k)) ?? [];
        if (o.length === 1 && o[0].col === itens[0].col) fim = ti + k;
        else break;
      }
      if (fim > ti) {
        const col = colunaLetra(di + 1);
        unir.push(`${col}${base + ti + 1}:${col}${base + fim + 1}`);
      }
    });
  });
  livro.folhas.push({ nome: livro.nomeUnico(`${prefixo}${nome}`), linhas, larguras: [13, ...g.dias.map(() => 22)], alturas, unir });
}

function folhaGeral(livro: Livro, p: Projeto, modo: TipoEntidade) {
  const entidades = entidadesDe(p, modo);
  const dias = [...p.config.dias].sort((a, b) => a - b);
  const tempos = grelhaDe(p, modo, '').tempos;
  const linhas: (Celula | null)[][] = [];
  const unir: string[] = [];
  const cab: Estilo = { negrito: true, borda: true, centro: true, fundo: '#E4E8EF' };
  linhas.push([{ v: `Mapa geral — ${modo === 'turma' ? 'Turmas' : 'Docentes'} · ${p.escola} · ${p.anoLetivo}`, e: { tamanho: 14 } }]);
  const l1: (Celula | null)[] = [{ v: '', e: cab }];
  const l2: (Celula | null)[] = [{ v: modo === 'turma' ? 'Turma' : 'Docente', e: cab }];
  dias.forEach((d, di) => {
    tempos.forEach((t, ti) => {
      l1.push(ti === 0 ? { v: NOMES_DIAS[d], e: cab } : { v: '', e: cab });
      l2.push({ v: `${ti + 1}.º ${t.inicio}`, e: { ...cab, tamanho: 9 } });
    });
    const c0 = 1 + di * tempos.length;
    unir.push(`${colunaLetra(c0)}2:${colunaLetra(c0 + tempos.length - 1)}2`);
  });
  linhas.push(l1, l2);
  for (const e of entidades) {
    const g = grelhaDe(p, modo, e.id);
    const linha: (Celula | null)[] = [{ v: e.nome, e: { negrito: true, borda: true } }];
    for (const d of dias)
      tempos.forEach((_, ti) => {
        const itens = g.celulas.get(chaveCelula(d, ti)) ?? [];
        if (!itens.length) linha.push({ v: '', e: { borda: true } });
        else
          linha.push({
            v: itens.map((it) => (it.disc?.sigla ?? '?') + (modo === 'prof' ? ` ${nomesTurmas(p, it.aula.turmaIds)}` : '')).join(' / '),
            e: { borda: true, centro: true, tamanho: 9, fundo: corClara(itens[0].disc?.cor ?? '#ddd', 0.72).toUpperCase() },
          });
      });
    linhas.push(linha);
  }
  livro.folhas.push({
    nome: livro.nomeUnico(modo === 'turma' ? 'Mapa geral turmas' : 'Mapa geral docentes'),
    linhas,
    larguras: [modo === 'turma' ? 10 : 26, ...dias.flatMap(() => tempos.map(() => (modo === 'turma' ? 7 : 11)))],
    unir,
  });
}

function folhaDistribuicao(livro: Livro, p: Projeto) {
  const idx = indices(p);
  const cab: Estilo = { negrito: true, borda: true, fundo: '#E4E8EF' };
  const linhas: (Celula | null)[][] = [[{ v: `Distribuição de serviço · ${p.escola} · ${p.anoLetivo}`, e: { tamanho: 14 } }], []];
  linhas.push(['Turma(s)', 'Turno', 'Disciplina', 'Sigla', 'Docente(s)', 'Tempos', 'Distribuição', 'Grupo simultâneo'].map((v) => ({ v, e: cab })));
  const aulas = [...p.aulas].sort((a, b) => compararTexto(nomesTurmas(p, a.turmaIds), nomesTurmas(p, b.turmaIds)));
  for (const a of aulas) {
    const d = idx.disc.get(a.disciplinaId);
    linhas.push(
      [nomesTurmas(p, a.turmaIds), a.turno, d?.nome ?? '', d?.sigla ?? '', nomesProfessores(p, a.professorIds), somaTempos(a.distribuicao), textoDistribuicao(a.distribuicao), a.simultaneo].map(
        (v) => ({ v, e: { borda: true } }),
      ),
    );
  }
  livro.folhas.push({ nome: livro.nomeUnico('Distribuição de serviço'), linhas, larguras: [16, 10, 30, 8, 36, 8, 12, 20], unir: [] });
}

export function exportarExcel(p: Projeto, o: OpcoesExcel): Uint8Array {
  const livro = new Livro();
  if (o.geralTurmas) folhaGeral(livro, p, 'turma');
  if (o.geralProfs) folhaGeral(livro, p, 'prof');
  if (o.turmas) for (const e of entidadesDe(p, 'turma')) folhaEntidade(livro, p, 'turma', e.id, '');
  if (o.profs) for (const e of entidadesDe(p, 'prof')) folhaEntidade(livro, p, 'prof', e.id, '');
  if (o.salas) for (const e of entidadesDe(p, 'sala')) folhaEntidade(livro, p, 'sala', e.id, 'Sala ');
  if (o.distribuicao) folhaDistribuicao(livro, p);
  if (livro.folhas.length === 0) folhaDistribuicao(livro, p);
  return livro.gerar();
}
