import { useEffect, useMemo, useState } from 'preact/hooks';
import { AreaTexto, Botao, CabecalhoPagina, Caixa, Campo, Modal, Numero, Pesquisa, Seletor, Texto, Vazio, confirmar, notificar } from '../comum';
import { GrelhaDisponibilidade } from '../GrelhaDisponibilidade';
import { ImportarColar } from '../ImportarColar';
import { CampoDistribuicao, EditorAula } from '../EditorAula';
import { atualizar, useProjeto } from '../../estado/store';
import type { Aula, Turma } from '../../model/tipos';
import { aplicarPlanoCurricular, eliminarAula, eliminarTurma, novaAula } from '../../model/operacoes';
import { PLANOS_CURRICULARES } from '../../model/padrao';
import { aulasDaTurma, indices, nomesProfessores, ordenarPorNome, temposPorProfessor, temposPorTurma } from '../../model/consultas';
import { compararTexto, novoId, normalizar, somaTempos } from '../../model/util';
import { irPara, useRota } from '../navegacao';

export const novaTurma = (parcial: Partial<Turma> = {}): Turma => ({
  id: novoId('tu'),
  nome: '',
  ano: '',
  dtId: null,
  salaId: null,
  maxTemposDia: null,
  indisp: {},
  notas: '',
  ...parcial,
});

function VariasTurmas({ aoFechar }: { aoFechar: () => void }) {
  const p = useProjeto();
  const [ano, setAno] = useState('5');
  const [quantas, setQuantas] = useState<number | null>(4);
  const [plano, setPlano] = useState(true);
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const nomes = Array.from({ length: Math.min(26, quantas ?? 0) }, (_, i) => `${ano}.º ${letras[i]}`);
  const existentes = new Set(p.turmas.map((t) => normalizar(t.nome)));
  const novas = nomes.filter((n) => !existentes.has(normalizar(n)));
  return (
    <Modal
      titulo="Adicionar várias turmas"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            disabled={novas.length === 0}
            onClick={() => {
              let aulas = 0;
              atualizar((d) => {
                for (const nome of novas) {
                  const t = novaTurma({ nome, ano });
                  d.turmas.push(t);
                  if (plano && PLANOS_CURRICULARES[ano]) aulas += aplicarPlanoCurricular(d, t.id, ano).aulas;
                }
              });
              notificar(`${novas.length} turmas criadas${aulas ? ` com ${aulas} aulas` : ''}.`);
              aoFechar();
            }}
          >
            Criar {novas.length} turmas
          </Botao>
        </>
      }
    >
      <div class="grelha-campos">
        <Campo rotulo="Ano de escolaridade">
          <Seletor valor={ano} aoMudar={setAno} opcoes={['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((a) => ({ valor: a, texto: `${a}.º ano` }))} />
        </Campo>
        <Campo rotulo="Número de turmas">
          <Numero valor={quantas} min={1} max={26} aoMudar={setQuantas} />
        </Campo>
      </div>
      {PLANOS_CURRICULARES[ano] && (
        <div class="mt">
          <Caixa marcado={plano} aoMudar={setPlano}>
            Criar também as aulas do plano curricular sugerido para o {ano}.º ano (sem docentes; pode ajustar depois)
          </Caixa>
        </div>
      )}
      <p class="texto-secundario">Turmas a criar: {novas.join(', ') || '—'}</p>
    </Modal>
  );
}

function LinhaAula({ aula, aoEditar }: { aula: Aula; aoEditar: () => void }) {
  const p = useProjeto();
  const idx = indices(p);
  const disc = idx.disc.get(aula.disciplinaId);
  const carga = temposPorProfessor(p);
  const mudar = (parcial: Partial<Aula>) =>
    atualizar((d) => {
      const a = d.aulas.find((x) => x.id === aula.id);
      if (!a) return;
      if (parcial.distribuicao && parcial.distribuicao.join('+') !== a.distribuicao.join('+'))
        d.horario.colocacoes = d.horario.colocacoes.filter((c) => c.aulaId !== aula.id);
      Object.assign(a, parcial);
    });
  const variosProfs = aula.professorIds.length > 1;
  return (
    <tr>
      <td>
        <span class="linha" style={{ gap: '8px', flexWrap: 'nowrap' }}>
          <span class="pastilha-cor" style={{ background: disc?.cor }} />
          <span>
            {disc?.nome ?? '?'}
            {aula.turno && <span class="etiqueta" style={{ marginLeft: '6px' }}>{aula.turno}</span>}
            {aula.turmaIds.length > 1 && <div class="secundario">com {aula.turmaIds.length - 1} outra(s) turma(s)</div>}
          </span>
        </span>
      </td>
      <td style={{ minWidth: '220px' }}>
        {variosProfs ? (
          <button class="botao fantasma pequeno" onClick={aoEditar}>
            {nomesProfessores(p, aula.professorIds)}
          </button>
        ) : (
          <select
            class="entrada"
            value={aula.professorIds[0] ?? ''}
            style={!aula.professorIds.length ? { borderColor: 'var(--ambar)', background: 'var(--ambar-claro)' } : undefined}
            onChange={(e) => {
              const v = (e.target as HTMLSelectElement).value;
              mudar({ professorIds: v ? [v] : [] });
            }}
          >
            <option value="">— Sem docente —</option>
            {ordenarPorNome(p.professores).map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome} ({carga.get(x.id) ?? 0} t)
              </option>
            ))}
          </select>
        )}
      </td>
      <td>
        <CampoDistribuicao compacto valor={aula.distribuicao} aoMudar={(v) => mudar({ distribuicao: v })} />
      </td>
      <td class="secundario">{somaTempos(aula.distribuicao)}</td>
      <td class="acoes-linha">
        <Botao variante="fantasma" pequeno icone="lapis" title="Editar todos os detalhes" onClick={aoEditar} />
        <Botao
          variante="fantasma"
          pequeno
          icone="lixo"
          title="Eliminar aula"
          onClick={async () => {
            if (await confirmar({ titulo: 'Eliminar esta aula?', texto: `${disc?.nome ?? 'Aula'} será removida desta turma.`, botao: 'Eliminar', perigo: true }))
              atualizar((d) => eliminarAula(d, aula.id));
          }}
        />
      </td>
    </tr>
  );
}

function Detalhe({ turma }: { turma: Turma }) {
  const p = useProjeto();
  const idx = indices(p);
  const [editarAula, setEditarAula] = useState<Aula | null>(null);
  const aulas = aulasDaTurma(p, turma.id).sort((a, b) => compararTexto(idx.disc.get(a.disciplinaId)?.nome ?? '', idx.disc.get(b.disciplinaId)?.nome ?? ''));
  const total = temposPorTurma(p).get(turma.id) ?? 0;
  const mudar = (parcial: Partial<Turma>, campo: string) =>
    atualizar(
      (d) => {
        const x = d.turmas.find((y) => y.id === turma.id);
        if (x) Object.assign(x, parcial);
      },
      { agrupar: `turma:${turma.id}:${campo}` },
    );
  const semDocente = aulas.filter((a) => !a.professorIds.length).length;

  return (
    <div class="coluna">
      <div class="cartao cartao-corpo">
        <div class="linha mb">
          <span class="avatar" style={{ width: '44px', height: '44px', fontSize: '13px' }}>
            {turma.nome.replace(/\s|\.º/g, '') || '?'}
          </span>
          <div class="flex-1">
            <h2 style={{ margin: 0 }}>Turma {turma.nome || 'sem nome'}</h2>
            <span class="texto-secundario pequeno-texto">
              {total} tempos semanais · {aulas.length} aulas{turma.dtId ? ` · DT: ${idx.prof.get(turma.dtId)?.nome ?? '?'}` : ''}
            </span>
          </div>
          <Botao icone="calendario" onClick={() => irPara('horarios', 'turma:' + turma.id)}>
            Ver horário
          </Botao>
          <Botao
            variante="perigo"
            icone="lixo"
            title="Eliminar turma"
            onClick={async () => {
              if (
                await confirmar({
                  titulo: `Eliminar a turma ${turma.nome}?`,
                  texto: 'As aulas desta turma também serão eliminadas (exceto as partilhadas com outras turmas).',
                  botao: 'Eliminar',
                  perigo: true,
                })
              )
                atualizar((d) => eliminarTurma(d, turma.id));
            }}
          />
        </div>
        <div class="grelha-campos">
          <Campo rotulo="Nome da turma">
            <Texto valor={turma.nome} autoFocus={!turma.nome} placeholder="Ex.: 7.º A" aoMudar={(v) => mudar({ nome: v }, 'nome')} />
          </Campo>
          <Campo rotulo="Ano de escolaridade">
            <Texto valor={turma.ano} placeholder="Ex.: 7" aoMudar={(v) => mudar({ ano: v }, 'ano')} />
          </Campo>
          <Campo rotulo="Diretor(a) de turma">
            <Seletor valor={turma.dtId ?? ''} vazio="— Nenhum —" opcoes={ordenarPorNome(p.professores).map((x) => ({ valor: x.id, texto: x.nome }))} aoMudar={(v) => mudar({ dtId: v || null }, 'dt')} />
          </Campo>
          <Campo rotulo="Sala habitual" ajuda="Usada nas aulas que não precisam de sala especial.">
            <Seletor valor={turma.salaId ?? ''} vazio="— Nenhuma —" opcoes={ordenarPorNome(p.salas).map((s) => ({ valor: s.id, texto: s.nome }))} aoMudar={(v) => mudar({ salaId: v || null }, 'sala')} />
          </Campo>
          <Campo rotulo="Máximo de tempos por dia" ajuda={`Vazio = valor geral (${p.regras.maxTemposDiaTurma || 'sem limite'}).`}>
            <Numero valor={turma.maxTemposDia} min={1} max={20} placeholder="Geral" aoMudar={(v) => mudar({ maxTemposDia: v }, 'max')} />
          </Campo>
        </div>
        <Campo rotulo="Notas" classe="mt">
          <AreaTexto valor={turma.notas} linhas={2} placeholder="Opcional" aoMudar={(v) => mudar({ notas: v }, 'notas')} />
        </Campo>
      </div>

      <div class="cartao">
        <div class="cartao-corpo linha" style={{ paddingBottom: '8px' }}>
          <div class="flex-1">
            <h2 style={{ margin: 0 }}>Aulas da turma</h2>
            {semDocente > 0 && <span class="etiqueta ambar">{semDocente} sem docente</span>}
          </div>
          {PLANOS_CURRICULARES[turma.ano] && (
            <Botao
              icone="varinha"
              onClick={() => {
                let r = { aulas: 0, disciplinas: 0 };
                atualizar((d) => void (r = aplicarPlanoCurricular(d, turma.id, turma.ano)));
                notificar(r.aulas ? `${r.aulas} aulas adicionadas a partir do plano do ${turma.ano}.º ano.` : 'A turma já tem todas as disciplinas do plano.', r.aulas ? 'sucesso' : 'info');
              }}
            >
              Plano curricular do {turma.ano}.º ano
            </Botao>
          )}
          <Botao icone="mais" onClick={() => setEditarAula(novaAula({ turmaIds: [turma.id] }))}>
            Adicionar aula
          </Botao>
        </div>
        {aulas.length === 0 ? (
          <p class="texto-secundario" style={{ padding: '0 20px 16px' }}>
            Ainda não há aulas.{' '}
            {PLANOS_CURRICULARES[turma.ano] ? 'Use «Plano curricular» para criar as disciplinas habituais deste ano.' : 'Indique o ano de escolaridade (5 a 9) para usar um plano curricular sugerido.'}
          </p>
        ) : (
          <div class="tabela-envolvente">
            <table class="tabela">
              <thead>
                <tr>
                  <th>Disciplina</th>
                  <th>Docente</th>
                  <th title="Ex.: 2+1 = um bloco de 2 tempos e uma aula de 1 tempo">Distribuição</th>
                  <th>Tempos</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {aulas.map((a) => (
                  <LinhaAula key={a.id} aula={a} aoEditar={() => setEditarAula(a)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div class="cartao cartao-corpo">
        <h2>Disponibilidade da turma</h2>
        <p class="texto-secundario" style={{ marginTop: 0 }}>
          Ex.: uma turma que só tem aulas de manhã. Os tempos bloqueados para toda a escola aparecem a cinzento.
        </p>
        <GrelhaDisponibilidade dias={p.config.dias} tempos={p.config.tempos} bloqueios={p.bloqueios} valor={turma.indisp} aoMudar={(g) => mudar({ indisp: g }, 'indisp' + Date.now())} />
      </div>
      {editarAula && <EditorAula key={editarAula.id} inicial={editarAula} aoFechar={() => setEditarAula(null)} />}
    </div>
  );
}

export function PaginaTurmas() {
  const p = useProjeto();
  const rota = useRota();
  const [pesquisa, setPesquisa] = useState('');
  const [selId, setSelId] = useState<string | null>(rota.id ?? null);
  const [varias, setVarias] = useState(false);
  const [colar, setColar] = useState(false);
  useEffect(() => {
    if (rota.id) setSelId(rota.id);
  }, [rota.id]);

  const tempos = useMemo(() => temposPorTurma(p), [p.aulas]);
  const lista = p.turmas
    .filter((t) => !pesquisa || normalizar(t.nome).includes(normalizar(pesquisa)))
    .sort((a, b) => compararTexto(a.ano, b.ano) || compararTexto(a.nome, b.nome));
  const sel = p.turmas.find((t) => t.id === selId) ?? lista[0] ?? null;
  const idx = indices(p);

  const adicionar = () => {
    const t = novaTurma();
    atualizar((d) => void d.turmas.push(t));
    setSelId(t.id);
    setPesquisa('');
  };

  return (
    <div class="pagina larga">
      <CabecalhoPagina
        passo="Passo 5"
        titulo="Turmas"
        descricao="Crie as turmas e atribua a cada uma o diretor de turma e as aulas. Pode usar o plano curricular sugerido para cada ano como ponto de partida."
        acoes={
          <>
            <Botao icone="colar" onClick={() => setColar(true)}>
              Colar do Excel
            </Botao>
            <Botao icone="mais" onClick={() => setVarias(true)}>
              Várias turmas
            </Botao>
            <Botao variante="primario" icone="mais" onClick={adicionar}>
              Nova turma
            </Botao>
          </>
        }
      />
      {p.turmas.length === 0 ? (
        <div class="cartao">
          <Vazio icone="grupo" titulo="Ainda não há turmas">
            <p>Crie as turmas de um ano de uma só vez (ex.: 5.º A a 5.º D), já com as aulas do plano curricular.</p>
            <div class="acoes" style={{ justifyContent: 'center' }}>
              <Botao variante="primario" icone="mais" onClick={() => setVarias(true)}>
                Adicionar várias turmas
              </Botao>
              <Botao icone="mais" onClick={adicionar}>
                Nova turma
              </Botao>
            </div>
          </Vazio>
        </div>
      ) : (
        <div class="mestre-detalhe">
          <div class="cartao">
            <div class="barra-lista">
              <Pesquisa valor={pesquisa} aoMudar={setPesquisa} placeholder="Procurar turma…" />
            </div>
            <div class="lista-mestre">
              {lista.map((t) => (
                <button key={t.id} class={`item-mestre ${sel?.id === t.id ? 'ativo' : ''}`} onClick={() => setSelId(t.id)}>
                  <span class="avatar">{t.nome.replace(/\s|\.º/g, '').slice(0, 4) || '?'}</span>
                  <span class="flex-1" style={{ minWidth: 0 }}>
                    <span class="nome">{t.nome || 'Sem nome'}</span>
                    <span class="sub">
                      {tempos.get(t.id) ?? 0} tempos{t.dtId ? ` · DT ${idx.prof.get(t.dtId)?.sigla || idx.prof.get(t.dtId)?.nome || ''}` : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          {sel ? <Detalhe key={sel.id} turma={sel} /> : <div />}
        </div>
      )}
      {varias && <VariasTurmas aoFechar={() => setVarias(false)} />}
      {colar && <ImportarColar tipo="turmas" aoFechar={() => setColar(false)} />}
    </div>
  );
}
