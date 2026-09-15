import { useMemo, useState } from 'preact/hooks';
import { Botao, CabecalhoPagina, Caixa, Campo, Modal, Numero, Pesquisa, SeletorCor, Texto, Vazio, confirmar, notificar } from '../comum';
import { GrelhaDisponibilidade } from '../GrelhaDisponibilidade';
import { ImportarColar } from '../ImportarColar';
import { atualizar, useProjeto } from '../../estado/store';
import type { Disciplina } from '../../model/tipos';
import { DISCIPLINAS_HABITUAIS, novaDisciplina } from '../../model/padrao';
import { eliminarDisciplina } from '../../model/operacoes';
import { tiposDeSala } from '../../model/consultas';
import { PALETA, compararTexto, normalizar, siglaDeNome } from '../../model/util';
import { irPara, useRota } from '../navegacao';

export function EditorDisciplina({ inicial, aoFechar }: { inicial: Disciplina; aoFechar: () => void }) {
  const p = useProjeto();
  const [d, setD] = useState<Disciplina>(inicial);
  const existe = p.disciplinas.some((x) => x.id === inicial.id);
  const mudar = (parcial: Partial<Disciplina>) => setD((x) => ({ ...x, ...parcial }));
  const tipos = tiposDeSala(p);

  const guardar = () => {
    if (!d.nome.trim()) {
      notificar('Indique o nome da disciplina.', 'aviso');
      return;
    }
    const final = { ...d, nome: d.nome.trim(), sigla: d.sigla.trim() || siglaDeNome(d.nome) };
    atualizar((x) => {
      const i = x.disciplinas.findIndex((y) => y.id === final.id);
      if (i >= 0) x.disciplinas[i] = final;
      else x.disciplinas.push(final);
    });
    notificar(existe ? 'Disciplina atualizada.' : 'Disciplina adicionada.');
    aoFechar();
  };

  return (
    <Modal
      titulo={existe ? `Editar ${inicial.nome}` : 'Nova disciplina'}
      tamanho="grande"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" onClick={guardar}>
            Guardar
          </Botao>
        </>
      }
    >
      <div class="grelha-campos">
        <Campo rotulo="Nome">
          <Texto valor={d.nome} autoFocus placeholder="Ex.: Matemática" aoMudar={(v) => mudar({ nome: v })} aoEnter={guardar} />
        </Campo>
        <Campo rotulo="Sigla" ajuda="Aparece nas células do horário.">
          <Texto valor={d.sigla} maxLength={8} placeholder={siglaDeNome(d.nome) || 'MAT'} aoMudar={(v) => mudar({ sigla: v.toUpperCase() })} aoEnter={guardar} />
        </Campo>
        <Campo rotulo="Tipo de sala necessário" ajuda="Deixe vazio se pode ser dada numa sala normal.">
          <input class="entrada" list="tipos-sala" value={d.tipoSala} placeholder="Nenhum (sala normal)" onInput={(e) => mudar({ tipoSala: (e.target as HTMLInputElement).value })} />
          <datalist id="tipos-sala">
            {tipos.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Campo>
        <Campo rotulo="Máximo de aulas por dia na mesma turma">
          <Numero valor={d.maxPorDia} min={1} max={10} aoMudar={(v) => mudar({ maxPorDia: v ?? 1 })} />
        </Campo>
      </div>
      <Campo rotulo="Cor" classe="mt">
        <SeletorCor valor={d.cor} aoMudar={(v) => mudar({ cor: v })} />
      </Campo>
      <h3 class="mt">Tempos em que esta disciplina não pode (ou não deve) ser lecionada</h3>
      <p class="texto-secundario pequeno-texto" style={{ marginTop: 0 }}>
        Ex.: Educação Física não pode ser logo a seguir ao almoço.
      </p>
      <GrelhaDisponibilidade compacta dias={p.config.dias} tempos={p.config.tempos} bloqueios={p.bloqueios} valor={d.indisp} aoMudar={(g) => mudar({ indisp: g })} />
    </Modal>
  );
}

function AdicionarHabituais({ aoFechar }: { aoFechar: () => void }) {
  const p = useProjeto();
  const existentes = new Set(p.disciplinas.map((d) => normalizar(d.sigla)));
  const disponiveis = DISCIPLINAS_HABITUAIS.filter((d) => !existentes.has(normalizar(d.sigla)));
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set(disponiveis.map((d) => d.sigla)));

  return (
    <Modal
      titulo="Adicionar disciplinas habituais do 2.º e 3.º ciclos"
      aoFechar={aoFechar}
      tamanho="grande"
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            disabled={marcadas.size === 0}
            onClick={() => {
              atualizar((x) => {
                for (const h of disponiveis)
                  if (marcadas.has(h.sigla)) x.disciplinas.push(novaDisciplina({ nome: h.nome, sigla: h.sigla, cor: h.cor, tipoSala: h.tipoSala }));
              });
              notificar(`${marcadas.size} disciplinas adicionadas.`);
              aoFechar();
            }}
          >
            Adicionar {marcadas.size}
          </Botao>
        </>
      }
    >
      {disponiveis.length === 0 ? (
        <p>Todas as disciplinas habituais já foram adicionadas.</p>
      ) : (
        <>
          <div class="linha mb">
            <Botao pequeno onClick={() => setMarcadas(new Set(disponiveis.map((d) => d.sigla)))}>
              Marcar todas
            </Botao>
            <Botao pequeno onClick={() => setMarcadas(new Set())}>
              Desmarcar todas
            </Botao>
          </div>
          <div class="grelha-campos" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px' }}>
            {disponiveis.map((h) => (
              <Caixa
                key={h.sigla}
                marcado={marcadas.has(h.sigla)}
                aoMudar={(v) =>
                  setMarcadas((s) => {
                    const n = new Set(s);
                    if (v) n.add(h.sigla);
                    else n.delete(h.sigla);
                    return n;
                  })
                }
              >
                <span class="pastilha-cor" style={{ background: h.cor, marginRight: '6px', verticalAlign: 'middle' }} />
                {h.nome} <span class="texto-secundario">({h.sigla} · {h.ciclos.map((c) => `${c}.º ciclo`).join(', ')})</span>
              </Caixa>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

export function PaginaDisciplinas() {
  const p = useProjeto();
  const rota = useRota();
  const [pesquisa, setPesquisa] = useState('');
  const [editar, setEditar] = useState<Disciplina | null>(() => p.disciplinas.find((d) => d.id === rota.id) ?? null);
  const [habituais, setHabituais] = useState(false);
  const [colar, setColar] = useState(false);

  const contagemAulas = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of p.aulas) m.set(a.disciplinaId, (m.get(a.disciplinaId) ?? 0) + 1);
    return m;
  }, [p.aulas]);

  const lista = p.disciplinas
    .filter((d) => !pesquisa || normalizar(d.nome + ' ' + d.sigla).includes(normalizar(pesquisa)))
    .sort((a, b) => compararTexto(a.nome, b.nome));

  const eliminar = async (d: Disciplina) => {
    const n = contagemAulas.get(d.id) ?? 0;
    const ok = await confirmar({
      titulo: `Eliminar ${d.nome}?`,
      texto: n ? `Esta disciplina tem ${n} aula(s) na distribuição de serviço, que também serão eliminadas.` : 'Esta ação pode ser anulada com Ctrl+Z.',
      botao: 'Eliminar',
      perigo: true,
    });
    if (ok) atualizar((x) => eliminarDisciplina(x, d.id));
  };

  const nova = () => novaDisciplina({ cor: PALETA[p.disciplinas.length % PALETA.length] });

  return (
    <div class="pagina">
      <CabecalhoPagina
        passo="Passo 2"
        titulo="Disciplinas"
        descricao="Liste as disciplinas lecionadas. Pode começar pelas disciplinas habituais e ajustar depois."
        acoes={
          <>
            <Botao icone="colar" onClick={() => setColar(true)}>
              Colar do Excel
            </Botao>
            <Botao icone="estrela" onClick={() => setHabituais(true)}>
              Disciplinas habituais
            </Botao>
            <Botao variante="primario" icone="mais" onClick={() => setEditar(nova())}>
              Nova disciplina
            </Botao>
          </>
        }
      />
      <div class="cartao">
        {p.disciplinas.length === 0 ? (
          <Vazio icone="livro" titulo="Ainda não há disciplinas">
            <p>Adicione de uma vez as disciplinas habituais do ensino básico, ou crie-as uma a uma.</p>
            <div class="acoes" style={{ justifyContent: 'center' }}>
              <Botao variante="primario" icone="estrela" onClick={() => setHabituais(true)}>
                Adicionar disciplinas habituais
              </Botao>
              <Botao icone="mais" onClick={() => setEditar(nova())}>
                Nova disciplina
              </Botao>
            </div>
          </Vazio>
        ) : (
          <>
            <div class="barra-lista">
              <Pesquisa valor={pesquisa} aoMudar={setPesquisa} placeholder="Procurar disciplina…" />
              <span class="texto-secundario pequeno-texto">{p.disciplinas.length} disciplinas</span>
            </div>
            <div class="tabela-envolvente">
              <table class="tabela">
                <thead>
                  <tr>
                    <th>Disciplina</th>
                    <th>Sigla</th>
                    <th>Tipo de sala</th>
                    <th>Máx. por dia</th>
                    <th>Restrições</th>
                    <th>Aulas</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((d) => {
                    const restr = Object.keys(d.indisp).length;
                    return (
                      <tr key={d.id} class="clicavel" onClick={() => setEditar(d)}>
                        <td>
                          <span class="linha" style={{ gap: '8px' }}>
                            <span class="pastilha-cor" style={{ background: d.cor }} />
                            <strong>{d.nome}</strong>
                          </span>
                        </td>
                        <td>{d.sigla}</td>
                        <td class="secundario">{d.tipoSala || '—'}</td>
                        <td class="secundario">{d.maxPorDia}</td>
                        <td>{restr ? <span class="etiqueta ambar">{restr} tempos</span> : <span class="secundario">—</span>}</td>
                        <td>
                          <button class="botao fantasma pequeno" onClick={(e) => (e.stopPropagation(), irPara('aulas', 'disc:' + d.id))}>
                            {contagemAulas.get(d.id) ?? 0}
                          </button>
                        </td>
                        <td class="acoes-linha" onClick={(e) => e.stopPropagation()}>
                          <Botao variante="fantasma" pequeno icone="lapis" title="Editar" onClick={() => setEditar(d)} />
                          <Botao variante="fantasma" pequeno icone="lixo" title="Eliminar" onClick={() => eliminar(d)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      {editar && <EditorDisciplina key={editar.id} inicial={editar} aoFechar={() => setEditar(null)} />}
      {habituais && <AdicionarHabituais aoFechar={() => setHabituais(false)} />}
      {colar && <ImportarColar tipo="disciplinas" aoFechar={() => setColar(false)} />}
    </div>
  );
}
