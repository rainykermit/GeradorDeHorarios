import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Botao, Caixa, Modal, Nota, Pesquisa, Segmentado, Separadores, Vazio, confirmar, notificar } from '../comum';
import { Icone } from '../icones';
import { irPara, useRota } from '../navegacao';
import { atualizar, useProjeto } from '../../estado/store';
import { useGeracao } from '../../estado/geracao';
import type { Projeto } from '../../model/tipos';
import { NOMES_DIAS, NOMES_DIAS_CURTOS, chaveGrelha } from '../../model/tipos';
import { type ItemCelula, type TipoEntidade, chaveCelula, entidadesDe, grelhaDe, nomeEntidade, rotulosItem } from '../../model/grelhaHorario';
import { type EstadoHorario, colocacoesDaUnidade, estadoDoHorario, substituirColocacoes } from '../../motor/conversao';
import { chaveColocacao, temposOrdenados } from '../../motor/compilar';
import { indices } from '../../model/consultas';
import { corClara, normalizar, paraMinutos } from '../../model/util';
import { EditorAula } from '../EditorAula';
import { Estatisticas } from './Gerar';
import { imprimir } from '../../exportar/impressao';
import { exportarExcel, type OpcoesExcel } from '../../exportar/xlsx';
import { guardarFicheiro } from '../../estado/persistencia';
import { nomeFicheiroSeguro } from '../acoesFicheiro';
import { descreverUnidade, explicarConflitos, explicarImpossivel, textoTempo } from '../horario/explicar';

type Vista = TipoEntidade | 'geral';

interface Arrasto {
  u: number;
  estados: Uint8Array;
  trocas: Int32Array;
}

const CLASSES_ALVO = ['alvo-impossivel', 'alvo-ok', 'alvo-evitar', 'alvo-troca', 'alvo-conflito'];
const TITULOS_ALVO = ['Não é possível', 'Livre', 'Livre, mas marcado «evitar se possível»', 'Trocar com a aula que lá está', 'Há conflitos'];

function lerRotaHorario(id?: string): { vista?: Vista; id?: string } {
  if (!id) return {};
  const [v, x] = id.split(':');
  if (v === 'turma' || v === 'prof' || v === 'sala') return { vista: v, id: x };
  if (v === 'geral') return { vista: 'geral' };
  return {};
}

// ───────── Contexto partilhado pelos componentes da página ─────────

interface Ctx {
  p: Projeto;
  e: EstadoHorario;
  sel: number | null;
  setSel: (u: number | null) => void;
  arrasto: Arrasto | null;
  iniciarArrasto: (u: number) => void;
  terminarArrasto: () => void;
  largar: (s: number) => void;
  unidadeDe: (aulaId: string, indice: number) => number | undefined;
  fixaDe: (u: number) => boolean;
  temColocacao: (u: number) => boolean;
  invalidas: Set<number>;
  abrirEntidade: (tipo: TipoEntidade, id: string) => void;
}

function CartaoAula({ c, it, tipo, u }: { c: Ctx; it: ItemCelula; tipo: TipoEntidade; u: number | undefined }) {
  const r = rotulosItem(c.p, it, tipo);
  const cor = it.disc?.cor ?? '#8a8f98';
  const emConflito = u !== undefined && c.invalidas.has(u);
  const fixa = u !== undefined && c.fixaDe(u);
  const estilo: Record<string, string | number> = { background: corClara(cor, 0.78), borderLeftColor: cor, color: '#1b2430' };
  if (it.parte > 0) Object.assign(estilo, { borderTopLeftRadius: 0, borderTopRightRadius: 0 });
  if (it.parte < it.dur - 1) Object.assign(estilo, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 });
  const titulo = [it.disc?.nome ?? '', ...r.linhas, fixa ? 'Fixada' : '', emConflito ? 'Em conflito — mova esta aula' : ''].filter(Boolean).join('\n');
  return (
    <div
      class={`cartao-aula ${u !== undefined && c.sel === u ? 'selecionada' : ''} ${c.arrasto?.u === u ? 'a-arrastar' : ''} ${emConflito ? 'em-conflito' : ''}`}
      style={estilo}
      title={titulo}
      draggable={u !== undefined}
      onClick={(ev) => {
        ev.stopPropagation();
        if (u !== undefined) c.setSel(c.sel === u ? null : u);
      }}
      onDragStart={(ev) => {
        if (u === undefined) return;
        ev.dataTransfer?.setData('text/plain', String(u));
        if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
        c.iniciarArrasto(u);
      }}
      onDragEnd={c.terminarArrasto}
    >
      <span class="sigla">
        {r.titulo}
        {emConflito && <Icone nome="aviso" tamanho={13} />}
        {fixa && <Icone nome="cadeado" tamanho={12} />}
      </span>
      {it.parte === 0 ? (
        r.linhas.map((l, i) => (
          <span key={i} class="linha-sec">
            {l}
          </span>
        ))
      ) : (
        <span class="linha-sec">(continuação)</span>
      )}
    </div>
  );
}

function GrelhaEntidade({ c, tipo, id }: { c: Ctx; tipo: TipoEntidade; id: string }) {
  const { p, e } = c;
  const idx = indices(p);
  const g = useMemo(() => grelhaDe(p, tipo, id), [p, tipo, id]);
  const [sobre, setSobre] = useState<number | null>(null);
  const T = e.problema.T;
  const indispEnt = tipo === 'turma' ? idx.turma.get(id)?.indisp : tipo === 'prof' ? idx.prof.get(id)?.indisp : idx.sala.get(id)?.indisp;

  useEffect(() => {
    if (!c.arrasto) setSobre(null);
  }, [c.arrasto]);

  return (
    <div class="horario-envolvente">
      <table class="horario">
        <thead>
          <tr>
            <th class="col-hora">Tempo</th>
            {g.dias.map((d) => (
              <th key={d}>{NOMES_DIAS[d]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {g.tempos.map((t, ti) => {
            const intervalo = ti > 0 ? paraMinutos(t.inicio) - paraMinutos(g.tempos[ti - 1].fim) : 0;
            return [
              intervalo >= 10 ? (
                <tr key={`i${ti}`} class="intervalo">
                  <td colSpan={g.dias.length + 1} title={`Intervalo de ${intervalo} minutos`} />
                </tr>
              ) : null,
              <tr key={t.id}>
                <td class="hora">
                  <b>{ti + 1}.º</b>
                  {t.inicio}
                  <br />
                  {t.fim}
                </td>
                {g.dias.map((dia) => {
                  const di = e.problema.dias.indexOf(dia);
                  const s = di * T + ti;
                  const k = chaveGrelha(dia, t.id);
                  const itens = g.celulas.get(chaveCelula(dia, ti)) ?? [];
                  let classe = 'celula';
                  if (c.arrasto) classe += ' ' + CLASSES_ALVO[c.arrasto.estados[s]] + (sobre === s ? ' sob-cursor' : '');
                  else if (p.bloqueios[k] === 'indisponivel') classe += ' bloqueada';
                  else if (indispEnt?.[k] === 'indisponivel') classe += ' indisponivel-entidade';
                  return (
                    <td
                      key={dia}
                      class={classe}
                      title={c.arrasto ? TITULOS_ALVO[c.arrasto.estados[s]] : p.bloqueios[k] === 'indisponivel' ? 'Bloqueado para toda a escola' : indispEnt?.[k] === 'indisponivel' ? 'Indisponível' : undefined}
                      onClick={() => c.setSel(null)}
                      onDragOver={(ev) => {
                        if (!c.arrasto) return;
                        ev.preventDefault();
                        if (sobre !== s) setSobre(s);
                      }}
                      onDrop={(ev) => {
                        ev.preventDefault();
                        c.largar(s);
                      }}
                    >
                      {itens.length > 0 && (
                        <div class={itens.length > 1 ? 'celula-dupla' : ''} style={{ height: '100%' }}>
                          {itens.map((it, i) => (
                            <CartaoAula key={i} c={c} it={it} tipo={tipo} u={c.unidadeDe(it.col.aulaId, it.col.indice)} />
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

function PorColocar({ c, unidades }: { c: Ctx; unidades: number[] }) {
  const { p, e } = c;
  const idx = indices(p);
  if (!unidades.length) return null;
  return (
    <div class="cartao cartao-corpo mt">
      <h3>
        <Icone nome="aviso" /> Por colocar ({unidades.length})
      </h3>
      <p class="texto-secundario pequeno-texto" style={{ marginTop: 0 }}>
        Arraste estas aulas para a grelha. Os tempos a verde estão livres.
      </p>
      <div class="pendentes" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px' }}>
        {unidades.map((u) => {
          const un = e.problema.unidades[u];
          const aula = idx.aula.get(un.membros[0].aulaId)!;
          const disc = idx.disc.get(aula.disciplinaId);
          const cor = disc?.cor ?? '#8a8f98';
          return (
            <div
              key={u}
              class={`cartao-aula ${c.sel === u ? 'selecionada' : ''}`}
              style={{ background: corClara(cor, 0.78), borderLeftColor: cor, color: '#1b2430' }}
              draggable
              onClick={() => c.setSel(c.sel === u ? null : u)}
              onDragStart={(ev) => {
                ev.dataTransfer?.setData('text/plain', String(u));
                c.iniciarArrasto(u);
              }}
              onDragEnd={c.terminarArrasto}
            >
              <span class="sigla">
                {descreverUnidade(p, e, u)} <span class="etiqueta">{un.dur === 1 ? '1 tempo' : `${un.dur} tempos`}</span>
              </span>
              <span class="linha-sec">{aula.professorIds.map((id) => idx.prof.get(id)?.nome ?? '?').join(', ') || 'Sem docente'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PainelAula({ c, u }: { c: Ctx; u: number }) {
  const { p, e } = c;
  const idx = indices(p);
  const pr = e.problema;
  const un = pr.unidades[u];
  const [editar, setEditar] = useState(false);
  if (!un) return null;
  const s = e.motor.pos[u];
  const colocada = c.temColocacao(u);
  const invalida = c.invalidas.has(u);
  const fixa = c.fixaDe(u);
  const tempos = temposOrdenados(p);
  const aulas = un.membros.map((m) => idx.aula.get(m.aulaId)).filter(Boolean) as Projeto['aulas'];
  const primeira = aulas[0];
  const colocacao = p.horario.colocacoes.find((x) => x.aulaId === un.membros[0].aulaId && x.indice === un.membros[0].indice);

  let quando = 'Por colocar';
  if (colocacao) {
    const ti = tempos.findIndex((t) => t.id === colocacao.tempoId);
    const fim = tempos[ti + un.dur - 1];
    quando = `${NOMES_DIAS[colocacao.dia]}, ${tempos[ti]?.inicio ?? '?'}–${fim?.fim ?? '?'}`;
  }

  let razoesConflito: string[] = [];
  if (invalida && un.inicial >= 0) {
    razoesConflito = un.permitido[un.inicial] ? explicarConflitos(p, e, u, un.inicial).razoes : explicarImpossivel(p, e, u, un.inicial);
  }

  const alterarFixa = () =>
    atualizar((d) => {
      const chaves = new Set(un.membros.map((m) => chaveColocacao(m.aulaId, m.indice)));
      for (const col of d.horario.colocacoes) if (chaves.has(chaveColocacao(col.aulaId, col.indice))) col.fixa = !fixa;
    });

  const retirar = () => {
    atualizar((d) => substituirColocacoes(d.horario, pr, [u], []));
    notificar('Aula retirada do horário. Está agora na lista «Por colocar».', 'info');
  };

  return (
    <div class="cartao cartao-corpo painel-aula">
      <div class="linha mb" style={{ alignItems: 'flex-start' }}>
        <h3 class="flex-1" style={{ margin: 0 }}>
          {descreverUnidade(p, e, u)}
        </h3>
        <Botao variante="fantasma" pequeno icone="fechar" title="Fechar" onClick={() => c.setSel(null)} />
      </div>
      {invalida && (
        <Nota tipo="erro" classe="mb">
          Esta aula está em conflito depois de alterações nos dados:
          <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
            {razoesConflito.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          Arraste-a para um tempo livre.
        </Nota>
      )}
      <div class="campo-info">
        <div class="rotulo">Quando</div>
        <div>
          {quando}
          {fixa && (
            <span class="etiqueta azul" style={{ marginLeft: '6px' }}>
              <Icone nome="cadeado" tamanho={12} /> fixada
            </span>
          )}
        </div>
      </div>
      {aulas.map((a, k) => {
        const disc = idx.disc.get(a.disciplinaId);
        const col = p.horario.colocacoes.find((x) => x.aulaId === a.id && x.indice === un.membros[k].indice);
        const livres = s >= 0 ? e.motor.salasLivres(u, k) : [];
        const atual = col?.salaId ?? '';
        return (
          <div key={a.id} class="campo-info" style={aulas.length > 1 ? { borderTop: '1px solid var(--borda)', paddingTop: '8px' } : undefined}>
            <div class="rotulo">Disciplina</div>
            <div class="linha" style={{ gap: '6px' }}>
              <span class="pastilha-cor" style={{ background: disc?.cor }} />
              {disc?.nome}
              {a.turno && <span class="etiqueta">{a.turno}</span>}
            </div>
            {a.turmaIds.length > 0 && (
              <>
                <div class="rotulo mt" style={{ marginTop: '8px' }}>
                  Turma(s)
                </div>
                <div class="linha" style={{ gap: '8px' }}>
                  {a.turmaIds.map((id) => (
                    <button key={id} class="link-botao" onClick={() => c.abrirEntidade('turma', id)}>
                      {idx.turma.get(id)?.nome}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div class="rotulo" style={{ marginTop: '8px' }}>
              Docente(s)
            </div>
            <div class="coluna" style={{ gap: '2px' }}>
              {a.professorIds.length === 0 && <span class="texto-secundario">Sem docente</span>}
              {a.professorIds.map((id) => (
                <button key={id} class="link-botao" onClick={() => c.abrirEntidade('prof', id)}>
                  {idx.prof.get(id)?.nome}
                </button>
              ))}
            </div>
            {colocada && !invalida && (
              <>
                <div class="rotulo" style={{ marginTop: '8px' }}>
                  Sala
                </div>
                <select
                  class="entrada"
                  value={atual}
                  onChange={(ev) => {
                    const v = (ev.target as HTMLSelectElement).value;
                    atualizar((d) => {
                      const cc = d.horario.colocacoes.find((x) => x.aulaId === a.id && x.indice === un.membros[k].indice);
                      if (cc) cc.salaId = v || null;
                    });
                  }}
                >
                  <option value="">— Sem sala —</option>
                  {atual && !livres.some((r) => pr.salaIds[r] === atual) && <option value={atual}>{idx.sala.get(atual)?.nome}</option>}
                  {livres.map((r) => (
                    <option key={r} value={pr.salaIds[r]}>
                      {p.salas[r].nome}
                      {un.membros[k].salas.includes(r) ? '' : ` (${p.salas[r].tipo})`}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        );
      })}
      <div class="coluna" style={{ gap: '6px', marginTop: '6px' }}>
        {colocada && (
          <Botao icone={fixa ? 'cadeadoAberto' : 'cadeado'} onClick={alterarFixa} title="As aulas fixadas não mudam de sítio ao gerar de novo">
            {fixa ? 'Desafixar' : 'Fixar neste tempo'}
          </Botao>
        )}
        {colocada && (
          <Botao icone="sair" onClick={retirar}>
            Retirar do horário
          </Botao>
        )}
        {primeira && (
          <Botao icone="lapis" onClick={() => setEditar(true)}>
            Editar aula
          </Botao>
        )}
      </div>
      {editar && primeira && <EditorAula inicial={primeira} aoFechar={() => setEditar(false)} />}
    </div>
  );
}

function QuadroGeral({ c, modo, setModo }: { c: Ctx; modo: TipoEntidade; setModo: (m: TipoEntidade) => void }) {
  const { p } = c;
  const entidades = entidadesDe(p, modo);
  const tempos = temposOrdenados(p);
  const dias = [...p.config.dias].sort((a, b) => a - b);
  const grelhas = useMemo(() => entidades.map((en) => grelhaDe(p, modo, en.id)), [p, modo]);
  return (
    <div class="cartao">
      <div class="barra-lista">
        <Segmentado<TipoEntidade>
          valor={modo}
          opcoes={[
            { valor: 'turma', texto: 'Turmas' },
            { valor: 'prof', texto: 'Docentes' },
            { valor: 'sala', texto: 'Salas' },
          ]}
          aoMudar={setModo}
        />
        <span class="texto-secundario pequeno-texto">Clique num nome para abrir o respetivo horário.</span>
      </div>
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 290px)' }}>
        <table class="quadro-geral">
          <thead>
            <tr>
              <th rowSpan={2} style={{ left: 0, zIndex: 3 }} />
              {dias.map((d) => (
                <th key={d} colSpan={tempos.length} class="dia-inicio">
                  {NOMES_DIAS[d]}
                </th>
              ))}
            </tr>
            <tr>
              {dias.flatMap((d) =>
                tempos.map((t, i) => (
                  <th key={`${d}-${i}`} class={i === 0 ? 'dia-inicio' : ''} title={`${NOMES_DIAS_CURTOS[d]} ${t.inicio}–${t.fim}`} style={{ top: '25px' }}>
                    {i + 1}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {entidades.map((en, ei) => (
              <tr key={en.id}>
                <td class="nome" onClick={() => c.abrirEntidade(modo, en.id)}>
                  {modo === 'prof' ? p.professores.find((x) => x.id === en.id)?.sigla || en.nome : en.nome}
                </td>
                {dias.flatMap((d) =>
                  tempos.map((_, i) => {
                    const itens = grelhas[ei].celulas.get(chaveCelula(d, i)) ?? [];
                    const it = itens[0];
                    const texto = itens
                      .map((x) => {
                        const r = rotulosItem(p, x, modo);
                        return modo === 'turma' ? x.disc?.sigla ?? '?' : `${x.disc?.sigla ?? '?'} ${r.linhas[0] ?? ''}`.trim();
                      })
                      .join(' / ');
                    return (
                      <td
                        key={`${d}-${i}`}
                        class={i === 0 ? 'dia-inicio' : ''}
                        style={it ? { background: corClara(it.disc?.cor ?? '#ddd', 0.72) } : undefined}
                        title={itens.map((x) => [x.disc?.nome, ...rotulosItem(p, x, modo).linhas].join(' · ')).join('\n')}
                      >
                        {texto}
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModalImprimir({ p, tipo, id, aoFechar }: { p: Projeto; tipo: TipoEntidade | null; id: string | null; aoFechar: () => void }) {
  const [escolha, setEscolha] = useState<string>(tipo && id ? 'este' : 'turma');
  const opcoes = [
    ...(tipo && id ? [{ valor: 'este', texto: `Só este horário (${nomeEntidade(p, tipo, id)})` }] : []),
    { valor: 'turma', texto: `Todas as turmas (${p.turmas.length} páginas)` },
    { valor: 'prof', texto: `Todos os docentes (${p.professores.length} páginas)` },
    { valor: 'sala', texto: `Todas as salas (${p.salas.length} páginas)` },
    { valor: 'geral-turma', texto: 'Mapa geral das turmas (1 página)' },
    { valor: 'geral-prof', texto: 'Mapa geral dos docentes (1 página)' },
  ];
  return (
    <Modal
      titulo="Imprimir horários"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            icone="imprimir"
            onClick={() => {
              aoFechar();
              if (escolha === 'este' && tipo && id) imprimir(p, { tipo, ids: [id] });
              else if (escolha.startsWith('geral-')) imprimir(p, { tipo: 'geral', modo: escolha.slice(6) as TipoEntidade });
              else imprimir(p, { tipo: escolha as TipoEntidade, ids: entidadesDe(p, escolha as TipoEntidade).map((x) => x.id) });
            }}
          >
            Imprimir
          </Botao>
        </>
      }
    >
      <div class="coluna" style={{ gap: '10px' }}>
        {opcoes.map((o) => (
          <label key={o.valor} class="caixa-marcar">
            <input type="radio" name="imprimir" checked={escolha === o.valor} onChange={() => setEscolha(o.valor)} />
            {o.texto}
          </label>
        ))}
      </div>
      <Nota tipo="info" classe="mt">
        Para obter um PDF, escolha «Guardar como PDF» (ou «Microsoft Print to PDF») na janela de impressão. Cada horário fica numa página A4 horizontal.
      </Nota>
    </Modal>
  );
}

function ModalExcel({ p, aoFechar }: { p: Projeto; aoFechar: () => void }) {
  const [o, setO] = useState<OpcoesExcel>({ geralTurmas: true, geralProfs: true, turmas: true, profs: true, salas: false, distribuicao: true });
  const mudar = (k: keyof OpcoesExcel) => (v: boolean) => setO((x) => ({ ...x, [k]: v }));
  const [aGuardar, setAGuardar] = useState(false);
  return (
    <Modal
      titulo="Exportar para Excel"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            icone="folha"
            disabled={aGuardar}
            onClick={async () => {
              setAGuardar(true);
              try {
                const dados = exportarExcel(p, o);
                const ok = await guardarFicheiro(
                  nomeFicheiroSeguro(`Horários ${p.escola || 'escola'} ${p.anoLetivo.replace('/', '-')}.xlsx`),
                  dados,
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  [{ name: 'Livro do Excel', extensions: ['xlsx'] }],
                );
                if (ok) notificar('Ficheiro Excel guardado.');
                aoFechar();
              } catch (err) {
                notificar('Erro ao exportar: ' + (err as Error).message, 'erro', 7000);
                setAGuardar(false);
              }
            }}
          >
            Exportar
          </Botao>
        </>
      }
    >
      <p style={{ marginTop: 0 }}>Escolha o que incluir no ficheiro (cada horário fica numa folha separada):</p>
      <div class="coluna" style={{ gap: '10px' }}>
        <Caixa marcado={o.geralTurmas} aoMudar={mudar('geralTurmas')}>
          Mapa geral das turmas
        </Caixa>
        <Caixa marcado={o.geralProfs} aoMudar={mudar('geralProfs')}>
          Mapa geral dos docentes
        </Caixa>
        <Caixa marcado={o.turmas} aoMudar={mudar('turmas')}>
          Horário de cada turma ({p.turmas.length})
        </Caixa>
        <Caixa marcado={o.profs} aoMudar={mudar('profs')}>
          Horário de cada docente ({p.professores.length})
        </Caixa>
        <Caixa marcado={o.salas} aoMudar={mudar('salas')}>
          Horário de cada sala ({p.salas.length})
        </Caixa>
        <Caixa marcado={o.distribuicao} aoMudar={mudar('distribuicao')}>
          Distribuição de serviço
        </Caixa>
      </div>
    </Modal>
  );
}

export function PaginaHorarios() {
  const p = useProjeto();
  const rota = useRota();
  const geracao = useGeracao();
  const idx = indices(p);
  const inicial = lerRotaHorario(rota.id);
  const [vista, setVista] = useState<Vista>(inicial.vista ?? 'turma');
  const [modoGeral, setModoGeral] = useState<TipoEntidade>('turma');
  const [selecionados, setSelecionados] = useState<Record<TipoEntidade, string | null>>({
    turma: inicial.vista === 'turma' ? inicial.id ?? null : null,
    prof: inicial.vista === 'prof' ? inicial.id ?? null : null,
    sala: inicial.vista === 'sala' ? inicial.id ?? null : null,
  });
  const [pesquisa, setPesquisa] = useState('');
  const [sel, setSel] = useState<number | null>(null);
  const [arrasto, setArrastoEstado] = useState<Arrasto | null>(null);
  const arrastoRef = useRef<Arrasto | null>(null);
  const [imprimirAberto, setImprimirAberto] = useState(false);
  const [excelAberto, setExcelAberto] = useState(false);
  const [mostrarResumo, setMostrarResumo] = useState(false);

  useEffect(() => {
    const r = lerRotaHorario(rota.id);
    if (r.vista) setVista(r.vista);
    if (r.vista && r.vista !== 'geral' && r.id) setSelecionados((s) => ({ ...s, [r.vista as TipoEntidade]: r.id! }));
  }, [rota.id]);

  const e = useMemo(() => estadoDoHorario(p), [p]);
  const analise = useMemo(() => e.motor.analisar(), [e]);
  const invalidas = useMemo(() => new Set(e.invalidas), [e]);
  const colPorChave = useMemo(() => new Map(p.horario.colocacoes.map((x) => [chaveColocacao(x.aulaId, x.indice), x])), [p.horario.colocacoes]);

  useEffect(() => {
    if (sel !== null && sel >= e.problema.unidades.length) setSel(null);
  }, [e]);

  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      const alvo = ev.target as HTMLElement;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT')) return;
      if (ev.key === 'Escape') setSel(null);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  const pr = e.problema;
  const fixaDe = (u: number) => {
    const m = pr.unidades[u]?.membros[0];
    return !!m && !!colPorChave.get(chaveColocacao(m.aulaId, m.indice))?.fixa;
  };
  const temColocacao = (u: number) => {
    const m = pr.unidades[u]?.membros[0];
    return !!m && colPorChave.has(chaveColocacao(m.aulaId, m.indice));
  };

  const setArrasto = (a: Arrasto | null) => {
    arrastoRef.current = a;
    setArrastoEstado(a);
  };

  const largar = async (s: number) => {
    const a = arrastoRef.current;
    setArrasto(null);
    if (!a) return;
    const u = a.u;
    const st = a.estados[s];
    const m = e.motor;
    if (st === 0) {
      notificar(explicarImpossivel(p, e, u, s).join(' '), 'aviso', 8000);
      return;
    }
    if (st === 1 || st === 2) {
      const salas = m.salasParaMover(u, s);
      if (!salas) return notificar('Não foi possível mover a aula para este tempo.', 'erro');
      atualizar((d) => substituirColocacoes(d.horario, pr, [u], colocacoesDaUnidade(pr, u, s, salas, fixaDe(u))));
      if (st === 2) notificar('Aula movida. Atenção: este tempo estava marcado como «evitar se possível».', 'aviso');
      setSel(u);
      return;
    }
    if (st === 3) {
      const v = a.trocas[s];
      const su = m.pos[u];
      const r = m.salasParaTroca(u, v);
      if (!r || su < 0) return notificar('Não foi possível trocar as aulas.', 'erro');
      atualizar((d) =>
        substituirColocacoes(d.horario, pr, [u, v], [...colocacoesDaUnidade(pr, u, s, r[0], fixaDe(u)), ...colocacoesDaUnidade(pr, v, su, r[1], fixaDe(v))]),
      );
      notificar(`Aulas trocadas: ${descreverUnidade(p, e, u)} ↔ ${descreverUnidade(p, e, v)}.`);
      setSel(u);
      return;
    }
    const exp = explicarConflitos(p, e, u, s);
    if (exp.unidades.length === 0) return notificar(exp.razoes.join(' '), 'aviso', 8000);
    if (exp.bloqueantes) return notificar(`${exp.razoes.join(' ')} Há aulas fixadas no caminho: desafixe-as primeiro.`, 'aviso', 9000);
    const ok = await confirmar({
      titulo: `Conflitos em ${textoTempo(p, e, s)}`,
      texto: (
        <>
          <ul style={{ paddingLeft: '20px', margin: '0 0 10px' }}>
            {exp.razoes.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          Quer colocar a aula aqui e retirar do horário as aulas em conflito? Essas aulas ficam na lista «Por colocar», para as colocar noutro tempo.
        </>
      ),
      botao: 'Colocar e retirar conflitos',
    });
    if (!ok) return;
    const guardadas = exp.unidades.map((v) => ({ v, s: m.pos[v], salas: m.salasDe(v) }));
    for (const g of guardadas) m.retirar(g.v);
    const salas = m.salasParaMover(u, s);
    for (const g of guardadas) m.colocar(g.v, g.s, g.salas);
    if (!salas) return notificar('Mesmo retirando as aulas em conflito, a aula não cabe aqui (limite de tempos por dia ou salas).', 'aviso', 8000);
    atualizar((d) => {
      substituirColocacoes(d.horario, pr, exp.unidades, []);
      substituirColocacoes(d.horario, pr, [u], colocacoesDaUnidade(pr, u, s, salas, fixaDe(u)));
    });
    notificar(`Aula colocada. ${exp.unidades.length} aula(s) ficaram por colocar.`, 'aviso', 6000);
    setSel(u);
  };

  const abrirEntidade = (tipo: TipoEntidade, id: string) => {
    setVista(tipo);
    setSelecionados((s) => ({ ...s, [tipo]: id }));
    setPesquisa('');
  };

  const ctx: Ctx = {
    p,
    e,
    sel,
    setSel,
    arrasto,
    iniciarArrasto: (u) => {
      const a = { u, ...e.motor.avaliarDestinos(u) };
      arrastoRef.current = a;
      setTimeout(() => {
        if (arrastoRef.current === a) setArrastoEstado(a);
      }, 0);
    },
    terminarArrasto: () => setTimeout(() => setArrasto(null), 0),
    largar,
    unidadeDe: (aulaId, indice) => pr.mapa.get(chaveColocacao(aulaId, indice))?.[0],
    fixaDe,
    temColocacao,
    invalidas,
    abrirEntidade,
  };

  // Aulas por colocar, por entidade
  const naoColocadas = useMemo(() => {
    const lista: number[] = [];
    for (let u = 0; u < pr.unidades.length; u++) if (e.motor.pos[u] < 0 && !temColocacao(u)) lista.push(u);
    return lista;
  }, [e, colPorChave]);

  if (p.aulas.length === 0 || (p.horario.colocacoes.length === 0 && !geracao.ativo)) {
    return (
      <div class="pagina">
        <div class="cartao">
          <Vazio icone="calendario" titulo="Ainda não há horário">
            <p>Depois de preencher os dados, gere o horário. Depois pode vê-lo e ajustá-lo aqui.</p>
            <Botao variante="primario" icone="raio" onClick={() => irPara('gerar')}>
              Gerar horário
            </Botao>
          </Vazio>
        </div>
      </div>
    );
  }

  const tipo: TipoEntidade | null = vista === 'geral' ? null : vista;
  const entidades = tipo ? entidadesDe(p, tipo) : [];
  const idSel = tipo ? (entidades.some((x) => x.id === selecionados[tipo]) ? selecionados[tipo] : entidades[0]?.id ?? null) : null;
  const q = normalizar(pesquisa);
  const listaFiltrada = entidades.filter((x) => !q || normalizar(x.nome + ' ' + x.sub).includes(q));

  const indiceEnt = (t: TipoEntidade, id: string) => (t === 'turma' ? pr.turmaIds.indexOf(id) : t === 'prof' ? pr.profIds.indexOf(id) : pr.salaIds.indexOf(id));
  const envolve = (u: number, t: TipoEntidade, i: number) => {
    const un = pr.unidades[u];
    if (t === 'turma') return un.turmas.includes(i);
    if (t === 'prof') return un.profs.includes(i);
    return un.membros.some((m) => m.salas.includes(i));
  };
  const pendentesEnt = tipo && idSel ? naoColocadas.filter((u) => envolve(u, tipo, indiceEnt(tipo, idSel))) : naoColocadas;
  const contagemPendentes = (t: TipoEntidade, id: string) => {
    const i = indiceEnt(t, id);
    let n = 0;
    for (const u of naoColocadas) if (envolve(u, t, i)) n++;
    for (const u of invalidas) if (envolve(u, t, i)) n++;
    return n;
  };

  const detalheEntidade = () => {
    if (!tipo || !idSel) return null;
    const i = indiceEnt(tipo, idSel);
    if (tipo === 'turma') {
      const t = idx.turma.get(idSel);
      const a = analise.turmas[i];
      return (
        <>
          {t?.dtId && <span>DT: {idx.prof.get(t.dtId)?.nome}</span>}
          {a && <span class={`etiqueta ${a.furos ? 'ambar' : 'verde'}`}>{a.furos} furos</span>}
          {a && a.semAlmoco.length > 0 && <span class="etiqueta vermelha">sem almoço: {a.semAlmoco.map((d) => NOMES_DIAS_CURTOS[pr.dias[d]]).join(', ')}</span>}
        </>
      );
    }
    if (tipo === 'prof') {
      const a = analise.profs[i];
      return (
        <>
          {a && <span class={`etiqueta ${a.furos ? 'ambar' : 'verde'}`}>{a.furos} furos</span>}
          {a && <span class="etiqueta">{a.dias} dias com aulas</span>}
          {a && a.semAlmoco.length > 0 && <span class="etiqueta vermelha">sem almoço: {a.semAlmoco.map((d) => NOMES_DIAS_CURTOS[pr.dias[d]]).join(', ')}</span>}
        </>
      );
    }
    const sala = idx.sala.get(idSel);
    return <span>{sala?.tipo}{sala && sala.capacidade > 1 ? ` · ${sala.capacidade} turmas em simultâneo` : ''}</span>;
  };

  const totalUnidades = pr.unidades.length;
  const colocadas = totalUnidades - analise.naoColocadas.length;

  return (
    <div class="pagina larga">
      <div class="cabecalho-pagina" style={{ marginBottom: '12px' }}>
        <div class="textos">
          <div class="passo">Passo 9</div>
          <h1>Horários</h1>
          <p>Clique numa aula para ver os detalhes. Arraste uma aula para a mudar de tempo ou trocar com outra.</p>
        </div>
        <div class="acoes">
          <Botao icone="imprimir" onClick={() => setImprimirAberto(true)}>
            Imprimir / PDF
          </Botao>
          <Botao icone="folha" onClick={() => setExcelAberto(true)}>
            Exportar para Excel
          </Botao>
          <Botao icone="raio" onClick={() => irPara('gerar')}>
            Gerar de novo
          </Botao>
        </div>
      </div>

      {geracao.ativo && (
        <Nota tipo="info" classe="mb">
          Está a ser gerado um novo horário. Quando terminar, esta página é atualizada automaticamente.
        </Nota>
      )}

      <div class="linha mb" style={{ gap: '8px' }}>
        <span class={`etiqueta ${colocadas === totalUnidades ? 'verde' : 'vermelha'}`}>
          {colocadas}/{totalUnidades} aulas colocadas
        </span>
        <span class={`etiqueta ${analise.totais.furosTurmas ? 'ambar' : 'verde'}`}>{analise.totais.furosTurmas} furos nas turmas</span>
        <span class={`etiqueta ${analise.totais.furosProfs ? 'ambar' : 'verde'}`}>{analise.totais.furosProfs} furos nos docentes</span>
        {invalidas.size > 0 && <span class="etiqueta vermelha">{invalidas.size} aulas em conflito</span>}
        <button class="link-botao pequeno-texto" onClick={() => setMostrarResumo((v) => !v)}>
          {mostrarResumo ? 'Esconder detalhes' : 'Mais detalhes'}
        </button>
      </div>
      {mostrarResumo && (
        <div class="mb">
          <Estatisticas analise={analise} total={totalUnidades} colocadas={colocadas} />
        </div>
      )}
      {invalidas.size > 0 && (
        <Nota tipo="erro" classe="mb">
          {invalidas.size} aula(s) deixaram de ser válidas depois de alterações nos dados (por exemplo, uma nova indisponibilidade ou outro docente). Estão
          assinaladas com contorno vermelho: arraste-as para um tempo livre ou gere o horário de novo.
        </Nota>
      )}

      <Separadores<Vista>
        itens={[
          { id: 'turma', texto: 'Turmas', icone: 'grupo' },
          { id: 'prof', texto: 'Docentes', icone: 'pessoa' },
          { id: 'sala', texto: 'Salas', icone: 'porta' },
          { id: 'geral', texto: 'Mapa geral', icone: 'lista' },
        ]}
        ativo={vista}
        aoMudar={(v) => {
          setVista(v);
          setPesquisa('');
          setSel(null);
        }}
      />

      {vista === 'geral' ? (
        <>
          <QuadroGeral c={ctx} modo={modoGeral} setModo={setModoGeral} />
          <PorColocar c={ctx} unidades={naoColocadas} />
        </>
      ) : (
        <div class={`layout-horarios ${sel !== null ? 'com-painel' : ''}`}>
          <div class="cartao painel-lateral">
            <div class="barra-lista" style={{ padding: '10px' }}>
              <Pesquisa valor={pesquisa} aoMudar={setPesquisa} placeholder="Procurar…" />
            </div>
            <div class="lista-entidades">
              {listaFiltrada.map((en) => {
                const n = tipo ? contagemPendentes(tipo, en.id) : 0;
                return (
                  <button key={en.id} class={`item-mestre ${en.id === idSel ? 'ativo' : ''}`} onClick={() => abrirEntidade(tipo!, en.id)}>
                    <span class="flex-1" style={{ minWidth: 0 }}>
                      <span class="nome">{en.nome}</span>
                      <span class="sub">{en.sub}</span>
                    </span>
                    {n > 0 && (
                      <span class="etiqueta vermelha" title="Aulas por colocar ou em conflito">
                        {n}
                      </span>
                    )}
                  </button>
                );
              })}
              {listaFiltrada.length === 0 && <p class="texto-secundario" style={{ padding: '12px' }}>Nada encontrado.</p>}
            </div>
          </div>

          <div style={{ minWidth: 0 }}>
            {tipo && idSel ? (
              <>
                <div class="linha mb" style={{ gap: '10px' }}>
                  <h2 style={{ fontSize: '20px' }}>{nomeEntidade(p, tipo, idSel)}</h2>
                  {detalheEntidade()}
                  <span class="flex-1" />
                  <Botao pequeno icone="imprimir" onClick={() => imprimir(p, { tipo, ids: [idSel] })}>
                    Imprimir este
                  </Botao>
                  <Botao pequeno icone="lapis" onClick={() => irPara(tipo === 'prof' ? 'professores' : tipo === 'turma' ? 'turmas' : 'salas', idSel)}>
                    Editar dados
                  </Botao>
                </div>
                {arrasto && (
                  <div class="legenda-arrasto">
                    <span>
                      <i style={{ background: '#dff3e6', boxShadow: 'inset 0 0 0 2px #53b87c' }} /> Livre
                    </span>
                    <span>
                      <i style={{ background: '#fff1cf', boxShadow: 'inset 0 0 0 2px #e6b33f' }} /> Livre, mas a evitar
                    </span>
                    <span>
                      <i style={{ background: '#e3edfc', boxShadow: 'inset 0 0 0 2px #6d9ae0' }} /> Troca possível
                    </span>
                    <span>
                      <i style={{ background: '#fde8e8' }} /> Conflito
                    </span>
                    <span>
                      <i style={{ background: '#f3f4f6' }} /> Impossível
                    </span>
                  </div>
                )}
                <GrelhaEntidade c={ctx} tipo={tipo} id={idSel} />
                <PorColocar c={ctx} unidades={pendentesEnt} />
              </>
            ) : (
              <div class="cartao">
                <Vazio titulo="Nada para mostrar" />
              </div>
            )}
          </div>

          {sel !== null && (
            <div class="painel-lateral">
              <PainelAula key={sel} c={ctx} u={sel} />
            </div>
          )}
        </div>
      )}

      {imprimirAberto && <ModalImprimir p={p} tipo={tipo} id={idSel} aoFechar={() => setImprimirAberto(false)} />}
      {excelAberto && <ModalExcel p={p} aoFechar={() => setExcelAberto(false)} />}
    </div>
  );
}
