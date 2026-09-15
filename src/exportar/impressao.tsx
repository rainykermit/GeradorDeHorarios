// Impressão (e PDF, através de «Guardar como PDF») dos horários, um por página A4 horizontal.

import { render } from 'preact';
import type { Projeto } from '../model/tipos';
import { NOMES_DIAS, NOMES_DIAS_CURTOS } from '../model/tipos';
import { type TipoEntidade, chaveCelula, entidadesDe, grelhaDe, nomeEntidade, rotulosItem } from '../model/grelhaHorario';
import { indices } from '../model/consultas';
import { corClara, somaTempos } from '../model/util';

export type PedidoImpressao = { tipo: TipoEntidade; ids: string[] } | { tipo: 'geral'; modo: TipoEntidade };

const TITULOS: Record<TipoEntidade, string> = { turma: 'Horário da turma', prof: 'Horário do docente', sala: 'Horário da sala' };

function Cabecalho({ p, titulo, detalhe }: { p: Projeto; titulo: string; detalhe?: string }) {
  return (
    <div class="cab-impressao">
      <div>
        <h1>{titulo}</h1>
        {detalhe && <div>{detalhe}</div>}
      </div>
      <div class="escola" style={{ textAlign: 'right' }}>
        {p.agrupamento && <div>{p.agrupamento}</div>}
        <strong>{p.escola}</strong>
        <div>Ano letivo {p.anoLetivo}</div>
      </div>
    </div>
  );
}

function Rodape() {
  return (
    <div class="rodape-impressao">
      <span>Gerador de Horários</span>
      <span>Impresso em {new Date().toLocaleDateString('pt-PT')}</span>
    </div>
  );
}

export function FolhaEntidade({ p, tipo, id }: { p: Projeto; tipo: TipoEntidade; id: string }) {
  const idx = indices(p);
  const g = grelhaDe(p, tipo, id);
  let detalhe = '';
  if (tipo === 'turma') {
    const t = idx.turma.get(id);
    const dt = t?.dtId ? idx.prof.get(t.dtId)?.nome : '';
    detalhe = dt ? `Diretor(a) de turma: ${dt}` : '';
  } else if (tipo === 'prof') {
    const total = p.aulas.filter((a) => a.professorIds.includes(id)).reduce((a, x) => a + somaTempos(x.distribuicao), 0);
    const dts = p.turmas.filter((t) => t.dtId === id).map((t) => t.nome);
    detalhe = `${total} tempos semanais${dts.length ? ` · Diretor(a) de turma: ${dts.join(', ')}` : ''}`;
  } else {
    detalhe = idx.sala.get(id)?.tipo ?? '';
  }

  const ocultas = new Set<string>();
  const legenda = new Map<string, string>();

  return (
    <div class="folha-impressao">
      <Cabecalho p={p} titulo={`${TITULOS[tipo]} ${nomeEntidade(p, tipo, id)}`} detalhe={detalhe} />
      <table>
        <thead>
          <tr>
            <th style={{ width: '62px' }}>Tempo</th>
            {g.dias.map((d) => (
              <th key={d}>{NOMES_DIAS[d]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {g.tempos.map((t, ti) => (
            <tr key={t.id} style={{ height: `${Math.max(26, Math.min(48, 520 / g.tempos.length))}px` }}>
              <td class="h">
                {t.inicio}
                <br />
                {t.fim}
              </td>
              {g.dias.map((d) => {
                const chave = chaveCelula(d, ti);
                if (ocultas.has(chave)) return null;
                const itens = g.celulas.get(chave) ?? [];
                if (!itens.length) return <td key={d} />;
                let rowSpan = 1;
                if (itens.length === 1 && itens[0].parte === 0 && itens[0].dur > 1) {
                  const it = itens[0];
                  for (let k = 1; k < it.dur; k++) {
                    const outra = g.celulas.get(chaveCelula(d, ti + k)) ?? [];
                    if (outra.length === 1 && outra[0].col === it.col) {
                      rowSpan++;
                      ocultas.add(chaveCelula(d, ti + k));
                    } else break;
                  }
                }
                const primeira = itens[0];
                const fundo = itens.length === 1 ? corClara(primeira.disc?.cor ?? '#dddddd', 0.75) : '#fff';
                return (
                  <td key={d} rowSpan={rowSpan} class="aula-imp" style={{ background: fundo }}>
                    {itens.map((it, i) => {
                      const r = rotulosItem(p, it, tipo);
                      if (it.disc) legenda.set(it.disc.sigla || it.disc.nome, it.disc.nome);
                      return (
                        <div key={i} style={i > 0 ? { borderTop: '1px dotted #777', marginTop: '1px' } : undefined}>
                          <b>{r.titulo}</b>
                          {r.linhas.length > 0 && <div>{r.linhas.join(' · ')}</div>}
                        </div>
                      );
                    })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {legenda.size > 0 && (
        <div style={{ fontSize: '9px', marginTop: '5px' }}>
          {[...legenda.entries()].map(([s, n]) => (
            <span key={s} style={{ marginRight: '10px' }}>
              <b>{s}</b> {n}
            </span>
          ))}
        </div>
      )}
      <Rodape />
    </div>
  );
}

function FolhaGeral({ p, modo }: { p: Projeto; modo: TipoEntidade }) {
  const entidades = entidadesDe(p, modo);
  const tempos = grelhaDe(p, modo, '').tempos;
  const dias = [...p.config.dias].sort((a, b) => a - b);
  return (
    <div class="folha-impressao geral">
      <Cabecalho p={p} titulo={`Mapa geral — ${modo === 'turma' ? 'Turmas' : modo === 'prof' ? 'Docentes' : 'Salas'}`} />
      <table>
        <thead>
          <tr>
            <th rowSpan={2} style={{ width: '70px' }} />
            {dias.map((d) => (
              <th key={d} colSpan={tempos.length}>
                {NOMES_DIAS[d]}
              </th>
            ))}
          </tr>
          <tr>
            {dias.flatMap((d) => tempos.map((_, i) => <th key={`${d}-${i}`}>{i + 1}</th>))}
          </tr>
        </thead>
        <tbody>
          {entidades.map((e) => {
            const g = grelhaDe(p, modo, e.id);
            return (
              <tr key={e.id}>
                <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                  <b>{e.nome}</b>
                </td>
                {dias.flatMap((d) =>
                  tempos.map((_, i) => {
                    const itens = g.celulas.get(chaveCelula(d, i)) ?? [];
                    const it = itens[0];
                    return (
                      <td key={`${d}-${i}`} style={it ? { background: corClara(it.disc?.cor ?? '#ddd', 0.72) } : undefined}>
                        {itens.map((x) => x.disc?.sigla ?? '?').join('/')}
                      </td>
                    );
                  }),
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: '8px', marginTop: '3px' }}>
        {dias.map((d) => NOMES_DIAS_CURTOS[d]).join(', ')} · Tempos: {tempos.map((t, i) => `${i + 1}) ${t.inicio}`).join('  ')}
      </div>
      <Rodape />
    </div>
  );
}

export function imprimir(p: Projeto, pedido: PedidoImpressao) {
  document.querySelectorAll('.area-impressao').forEach((el) => el.remove());
  const area = document.createElement('div');
  area.className = 'area-impressao';
  document.body.appendChild(area);
  render(
    <>
      {pedido.tipo === 'geral' ? (
        <FolhaGeral p={p} modo={pedido.modo} />
      ) : (
        pedido.ids.map((id) => <FolhaEntidade key={id} p={p} tipo={pedido.tipo} id={id} />)
      )}
    </>,
    area,
  );
  document.body.classList.add('a-imprimir');
  const limpar = () => {
    window.removeEventListener('afterprint', limpar);
    document.body.classList.remove('a-imprimir');
    render(null, area);
    area.remove();
  };
  window.addEventListener('afterprint', limpar);
  setTimeout(() => window.print(), 50);
}
