import { useMemo, useState } from 'preact/hooks';
import { Botao, CabecalhoPagina, Campo, Modal, Numero, Pesquisa, Texto, Vazio, confirmar, notificar } from '../comum';
import { GrelhaDisponibilidade } from '../GrelhaDisponibilidade';
import { ImportarColar } from '../ImportarColar';
import { atualizar, useProjeto } from '../../estado/store';
import type { Sala } from '../../model/tipos';
import { eliminarSala } from '../../model/operacoes';
import { tiposDeSala } from '../../model/consultas';
import { compararTexto, novoId, normalizar } from '../../model/util';
import { irPara, useRota } from '../navegacao';

const novaSala = (parcial: Partial<Sala> = {}): Sala => ({ id: novoId('s'), nome: '', tipo: 'Sala de aula', capacidade: 1, indisp: {}, ...parcial });

function CampoTipo({ valor, aoMudar, id }: { valor: string; aoMudar: (v: string) => void; id: string }) {
  const p = useProjeto();
  return (
    <>
      <input class="entrada" list={id} value={valor} placeholder="Ex.: Laboratório" onInput={(e) => aoMudar((e.target as HTMLInputElement).value)} />
      <datalist id={id}>
        {tiposDeSala(p).map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </>
  );
}

function EditorSala({ inicial, aoFechar }: { inicial: Sala; aoFechar: () => void }) {
  const p = useProjeto();
  const [s, setS] = useState(inicial);
  const existe = p.salas.some((x) => x.id === inicial.id);
  const mudar = (parcial: Partial<Sala>) => setS((x) => ({ ...x, ...parcial }));
  const guardar = () => {
    if (!s.nome.trim()) return notificar('Indique o nome da sala.', 'aviso');
    atualizar((x) => {
      const i = x.salas.findIndex((y) => y.id === s.id);
      const final = { ...s, nome: s.nome.trim(), tipo: s.tipo.trim() };
      if (i >= 0) x.salas[i] = final;
      else x.salas.push(final);
    });
    notificar(existe ? 'Sala atualizada.' : 'Sala adicionada.');
    aoFechar();
  };
  return (
    <Modal
      titulo={existe ? `Editar ${inicial.nome}` : 'Nova sala'}
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
          <Texto valor={s.nome} autoFocus placeholder="Ex.: Sala 12" aoMudar={(v) => mudar({ nome: v })} aoEnter={guardar} />
        </Campo>
        <Campo rotulo="Tipo de sala" ajuda="As disciplinas que exigem um tipo de sala usam as salas desse tipo.">
          <CampoTipo id="tipo-sala-editor" valor={s.tipo} aoMudar={(v) => mudar({ tipo: v })} />
        </Campo>
        <Campo rotulo="Turmas em simultâneo" ajuda="Normalmente 1. Um pavilhão pode receber 2 ou 3 turmas.">
          <Numero valor={s.capacidade} min={1} max={20} aoMudar={(v) => mudar({ capacidade: v ?? 1 })} />
        </Campo>
      </div>
      <h3 class="mt">Tempos em que a sala não está disponível</h3>
      <GrelhaDisponibilidade compacta permitirEvitar={false} dias={p.config.dias} tempos={p.config.tempos} bloqueios={p.bloqueios} valor={s.indisp} aoMudar={(g) => mudar({ indisp: g })} />
    </Modal>
  );
}

function AdicionarVarias({ aoFechar }: { aoFechar: () => void }) {
  const [prefixo, setPrefixo] = useState('Sala ');
  const [de, setDe] = useState<number | null>(1);
  const [ate, setAte] = useState<number | null>(10);
  const [tipo, setTipo] = useState('Sala de aula');
  const total = de != null && ate != null && ate >= de ? ate - de + 1 : 0;
  return (
    <Modal
      titulo="Adicionar várias salas"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            disabled={total === 0 || total > 200}
            onClick={() => {
              atualizar((x) => {
                for (let i = de!; i <= ate!; i++) x.salas.push(novaSala({ nome: `${prefixo}${i}`.trim(), tipo }));
              });
              notificar(`${total} salas adicionadas.`);
              aoFechar();
            }}
          >
            Adicionar {total} salas
          </Botao>
        </>
      }
    >
      <div class="grelha-campos">
        <Campo rotulo="Nome (antes do número)">
          <Texto valor={prefixo} aoMudar={setPrefixo} />
        </Campo>
        <Campo rotulo="Do número">
          <Numero valor={de} min={0} max={999} aoMudar={setDe} />
        </Campo>
        <Campo rotulo="Até ao número">
          <Numero valor={ate} min={0} max={999} aoMudar={setAte} />
        </Campo>
        <Campo rotulo="Tipo">
          <CampoTipo id="tipo-sala-varias" valor={tipo} aoMudar={setTipo} />
        </Campo>
      </div>
      {total > 0 && (
        <p class="texto-secundario">
          Serão criadas: {prefixo}
          {de}, {prefixo}
          {(de ?? 0) + 1}, … {prefixo}
          {ate}
        </p>
      )}
    </Modal>
  );
}

export function PaginaSalas() {
  const p = useProjeto();
  const rota = useRota();
  const [pesquisa, setPesquisa] = useState('');
  const [editar, setEditar] = useState<Sala | null>(() => p.salas.find((s) => s.id === rota.id) ?? null);
  const [varias, setVarias] = useState(false);
  const [colar, setColar] = useState(false);

  const turmasPorSala = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const t of p.turmas) if (t.salaId) m.set(t.salaId, [...(m.get(t.salaId) ?? []), t.nome]);
    return m;
  }, [p.turmas]);

  const disciplinasPorTipo = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const d of p.disciplinas) if (d.tipoSala) m.set(normalizar(d.tipoSala), [...(m.get(normalizar(d.tipoSala)) ?? []), d.sigla || d.nome]);
    return m;
  }, [p.disciplinas]);

  const lista = p.salas
    .filter((s) => !pesquisa || normalizar(s.nome + ' ' + s.tipo).includes(normalizar(pesquisa)))
    .sort((a, b) => compararTexto(a.tipo, b.tipo) || compararTexto(a.nome, b.nome));

  const tiposEmFalta = [...new Set(p.disciplinas.filter((d) => d.tipoSala && !p.salas.some((s) => normalizar(s.tipo) === normalizar(d.tipoSala))).map((d) => d.tipoSala))];

  return (
    <div class="pagina">
      <CabecalhoPagina
        passo="Passo 3"
        titulo="Salas"
        descricao="Registe as salas e espaços. Só é necessário registar as salas que quer controlar — por exemplo, laboratórios, salas de informática e pavilhão."
        acoes={
          <>
            <Botao icone="colar" onClick={() => setColar(true)}>
              Colar do Excel
            </Botao>
            <Botao icone="mais" onClick={() => setVarias(true)}>
              Várias salas
            </Botao>
            <Botao variante="primario" icone="mais" onClick={() => setEditar(novaSala())}>
              Nova sala
            </Botao>
          </>
        }
      />
      {tiposEmFalta.length > 0 && (
        <div class="nota aviso mb">
          <span>
            Há disciplinas que precisam de salas que ainda não existem: <strong>{tiposEmFalta.join(', ')}</strong>.{' '}
            <button class="botao pequeno" onClick={() => setEditar(novaSala({ tipo: tiposEmFalta[0], nome: tiposEmFalta[0] }))}>
              Criar sala «{tiposEmFalta[0]}»
            </button>
          </span>
        </div>
      )}
      <div class="cartao">
        {p.salas.length === 0 ? (
          <Vazio icone="porta" titulo="Ainda não há salas">
            <p>Se as salas não forem importantes para o seu horário, pode passar este passo.</p>
            <div class="acoes" style={{ justifyContent: 'center' }}>
              <Botao variante="primario" icone="mais" onClick={() => setEditar(novaSala())}>
                Nova sala
              </Botao>
              <Botao icone="mais" onClick={() => setVarias(true)}>
                Adicionar várias salas
              </Botao>
            </div>
          </Vazio>
        ) : (
          <>
            <div class="barra-lista">
              <Pesquisa valor={pesquisa} aoMudar={setPesquisa} placeholder="Procurar sala…" />
              <span class="texto-secundario pequeno-texto">{p.salas.length} salas</span>
            </div>
            <div class="tabela-envolvente">
              <table class="tabela">
                <thead>
                  <tr>
                    <th>Sala</th>
                    <th>Tipo</th>
                    <th>Turmas em simultâneo</th>
                    <th>Usada por</th>
                    <th>Indisponível</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((s) => {
                    const usos = [...(turmasPorSala.get(s.id) ?? []), ...(disciplinasPorTipo.get(normalizar(s.tipo)) ?? [])];
                    const restr = Object.keys(s.indisp).length;
                    return (
                      <tr key={s.id} class="clicavel" onClick={() => setEditar(s)}>
                        <td>
                          <strong>{s.nome}</strong>
                        </td>
                        <td class="secundario">{s.tipo || '—'}</td>
                        <td class="secundario">{s.capacidade}</td>
                        <td class="secundario">{usos.length ? usos.join(', ') : '—'}</td>
                        <td>{restr ? <span class="etiqueta ambar">{restr} tempos</span> : <span class="secundario">—</span>}</td>
                        <td class="acoes-linha" onClick={(e) => e.stopPropagation()}>
                          <Botao variante="fantasma" pequeno icone="calendario" title="Ver horário da sala" onClick={() => irPara('horarios', 'sala:' + s.id)} />
                          <Botao variante="fantasma" pequeno icone="lapis" title="Editar" onClick={() => setEditar(s)} />
                          <Botao
                            variante="fantasma"
                            pequeno
                            icone="lixo"
                            title="Eliminar"
                            onClick={async () => {
                              if (await confirmar({ titulo: `Eliminar ${s.nome}?`, texto: 'A sala deixa de estar associada a turmas e aulas.', botao: 'Eliminar', perigo: true }))
                                atualizar((x) => eliminarSala(x, s.id));
                            }}
                          />
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
      {editar && <EditorSala key={editar.id} inicial={editar} aoFechar={() => setEditar(null)} />}
      {varias && <AdicionarVarias aoFechar={() => setVarias(false)} />}
      {colar && <ImportarColar tipo="salas" aoFechar={() => setColar(false)} />}
    </div>
  );
}
