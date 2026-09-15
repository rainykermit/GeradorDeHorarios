import { useEffect, useMemo, useState } from 'preact/hooks';
import { AreaTexto, Botao, CabecalhoPagina, Campo, Modal, Nota, Numero, Pesquisa, Seletor, Texto, Vazio, confirmar, notificar } from '../comum';
import { GrelhaDisponibilidade } from '../GrelhaDisponibilidade';
import { ImportarColar } from '../ImportarColar';
import { EditorAula } from '../EditorAula';
import { Icone } from '../icones';
import { atualizar, useProjeto } from '../../estado/store';
import type { Aula, FichaDocente, Professor } from '../../model/tipos';
import { eliminarProfessor, novaAula } from '../../model/operacoes';
import { aulasDoProfessor, indices, nomesTurmas, temposPorProfessor } from '../../model/consultas';
import { associarFicha, fichaModelo, grelhaDaFicha, lerFicha } from '../../model/fichas';
import { FILTRO_FICHA, abrirFicheiros, guardarFicheiro } from '../../estado/persistencia';
import { compararTexto, novoId, normalizar, siglaDeNome, somaTempos, textoDistribuicao } from '../../model/util';
import { irPara, useRota } from '../navegacao';
import { nomeFicheiroSeguro } from '../acoesFicheiro';
import { retirarFichasPorImportar } from '../../estado/externo';

export const novoProfessor = (parcial: Partial<Professor> = {}): Professor => ({
  id: novoId('p'),
  nome: '',
  sigla: '',
  grupo: '',
  email: '',
  maxTemposDia: null,
  maxConsecutivos: null,
  indisp: {},
  notas: '',
  ...parcial,
});

function ImportarFichas({ fichas, aoFechar }: { fichas: { nome: string; ficha: FichaDocente }[]; aoFechar: () => void }) {
  const p = useProjeto();
  const [destinos, setDestinos] = useState<string[]>(() => fichas.map((f) => associarFicha(f.ficha, p) ?? (f.ficha.nome ? 'novo' : '')));
  return (
    <Modal
      titulo="Importar fichas de disponibilidade"
      tamanho="grande"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            disabled={destinos.every((d) => !d)}
            onClick={() => {
              let n = 0;
              let perdidos = 0;
              atualizar((d) => {
                fichas.forEach(({ ficha }, i) => {
                  const destino = destinos[i];
                  if (!destino) return;
                  let prof = d.professores.find((x) => x.id === destino);
                  if (destino === 'novo') {
                    prof = novoProfessor({ nome: ficha.nome, sigla: ficha.sigla || siglaDeNome(ficha.nome), email: ficha.email });
                    d.professores.push(prof);
                  }
                  if (!prof) return;
                  const { grelha, naoAssociados } = grelhaDaFicha(ficha, p);
                  perdidos += naoAssociados;
                  prof.indisp = grelha;
                  if (ficha.email && !prof.email) prof.email = ficha.email;
                  if (ficha.notas) prof.notas = [prof.notas, `Ficha: ${ficha.notas}`].filter(Boolean).join('\n');
                  n++;
                });
              });
              notificar(`${n} ficha(s) importada(s).${perdidos ? ` ${perdidos} marcação(ões) não correspondiam aos tempos da escola.` : ''}`, perdidos ? 'aviso' : 'sucesso', 6000);
              aoFechar();
            }}
          >
            Importar
          </Botao>
        </>
      }
    >
      <p class="texto-secundario" style={{ marginTop: 0 }}>
        Confirme a que docente corresponde cada ficha. As indisponibilidades do docente serão substituídas pelas da ficha.
      </p>
      <table class="tabela">
        <thead>
          <tr>
            <th>Ficha</th>
            <th>Marcações</th>
            <th>Associar a</th>
          </tr>
        </thead>
        <tbody>
          {fichas.map((f, i) => (
            <tr key={i}>
              <td>
                <strong>{f.ficha.nome || '(sem nome)'}</strong>
                <div class="secundario">{f.nome}</div>
              </td>
              <td class="secundario">{Object.keys(f.ficha.indisp).length} tempos</td>
              <td>
                <Seletor
                  valor={destinos[i]}
                  vazio="— Não importar —"
                  opcoes={[
                    { valor: 'novo', texto: '➕ Criar novo docente' },
                    ...[...p.professores].sort((a, b) => compararTexto(a.nome, b.nome)).map((x) => ({ valor: x.id, texto: x.nome })),
                  ]}
                  aoMudar={(v) => setDestinos((d) => d.map((x, j) => (j === i ? v : x)))}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

function Detalhe({ prof }: { prof: Professor }) {
  const p = useProjeto();
  const idx = indices(p);
  const [editarAula, setEditarAula] = useState<Aula | null>(null);
  const aulas = aulasDoProfessor(p, prof.id);
  const total = aulas.reduce((a, x) => a + somaTempos(x.distribuicao), 0);
  const dtDe = p.turmas.filter((t) => t.dtId === prof.id);
  const mudar = (parcial: Partial<Professor>, campo: string) =>
    atualizar(
      (d) => {
        const x = d.professores.find((y) => y.id === prof.id);
        if (x) Object.assign(x, parcial);
      },
      { agrupar: `prof:${prof.id}:${campo}` },
    );

  return (
    <div class="coluna">
      <div class="cartao cartao-corpo">
        <div class="linha mb">
          <span class="avatar" style={{ width: '44px', height: '44px', fontSize: '14px' }}>
            {prof.sigla || siglaDeNome(prof.nome) || '?'}
          </span>
          <div class="flex-1">
            <h2 style={{ margin: 0 }}>{prof.nome || 'Docente sem nome'}</h2>
            <span class="texto-secundario pequeno-texto">
              {total} tempos semanais · {aulas.length} aulas{dtDe.length ? ` · Diretor(a) de turma: ${dtDe.map((t) => t.nome).join(', ')}` : ''}
            </span>
          </div>
          <Botao icone="calendario" onClick={() => irPara('horarios', 'prof:' + prof.id)}>
            Ver horário
          </Botao>
          <Botao
            variante="perigo"
            icone="lixo"
            title="Eliminar docente"
            onClick={async () => {
              const ok = await confirmar({
                titulo: `Eliminar ${prof.nome || 'este docente'}?`,
                texto: aulas.length ? `O docente será retirado das ${aulas.length} aulas que tem atribuídas (as aulas mantêm-se, sem docente).` : 'Pode anular com Ctrl+Z.',
                botao: 'Eliminar',
                perigo: true,
              });
              if (ok) atualizar((d) => eliminarProfessor(d, prof.id));
            }}
          />
        </div>
        <div class="grelha-campos">
          <Campo rotulo="Nome completo">
            <Texto
              valor={prof.nome}
              autoFocus={!prof.nome}
              placeholder="Ex.: Ana Maria Silva"
              aoMudar={(v) => mudar({ nome: v }, 'nome')}
              aoSair={() => {
                if (!prof.sigla && prof.nome) mudar({ sigla: siglaDeNome(prof.nome) }, 'sigla');
              }}
            />
          </Campo>
          <Campo rotulo="Sigla" ajuda="Abreviatura usada nos horários.">
            <Texto valor={prof.sigla} maxLength={8} placeholder={siglaDeNome(prof.nome)} aoMudar={(v) => mudar({ sigla: v.toUpperCase() }, 'sigla')} />
          </Campo>
          <Campo rotulo="Grupo de recrutamento">
            <Texto valor={prof.grupo} placeholder="Ex.: 300" aoMudar={(v) => mudar({ grupo: v }, 'grupo')} />
          </Campo>
          <Campo rotulo="E-mail">
            <Texto valor={prof.email} placeholder="Opcional" aoMudar={(v) => mudar({ email: v }, 'email')} />
          </Campo>
          <Campo rotulo="Máximo de tempos por dia" ajuda={`Vazio = valor geral (${p.regras.maxTemposDiaProfessor || 'sem limite'}).`}>
            <Numero valor={prof.maxTemposDia} min={1} max={20} placeholder="Geral" aoMudar={(v) => mudar({ maxTemposDia: v }, 'maxdia')} />
          </Campo>
          <Campo rotulo="Máximo de tempos seguidos" ajuda={`Vazio = valor geral (${p.regras.maxConsecutivosProfessor || 'sem limite'}).`}>
            <Numero valor={prof.maxConsecutivos} min={1} max={20} placeholder="Geral" aoMudar={(v) => mudar({ maxConsecutivos: v }, 'maxcons')} />
          </Campo>
        </div>
        <Campo rotulo="Notas" classe="mt">
          <AreaTexto valor={prof.notas} linhas={2} placeholder="Ex.: motivo das indisponibilidades, pedidos especiais…" aoMudar={(v) => mudar({ notas: v }, 'notas')} />
        </Campo>
      </div>

      <div class="cartao cartao-corpo">
        <h2>Disponibilidade</h2>
        <p class="texto-secundario" style={{ marginTop: 0 }}>
          <strong>Indisponível</strong>: o docente nunca terá aulas nesses tempos. <strong>Evitar se possível</strong>: o gerador tenta não usar esses tempos.
        </p>
        <GrelhaDisponibilidade dias={p.config.dias} tempos={p.config.tempos} bloqueios={p.bloqueios} valor={prof.indisp} aoMudar={(g) => mudar({ indisp: g }, 'indisp' + Date.now())} />
      </div>

      <div class="cartao">
        <div class="cartao-corpo linha" style={{ paddingBottom: '8px' }}>
          <h2 class="flex-1" style={{ margin: 0 }}>
            Aulas atribuídas
          </h2>
          <Botao icone="mais" onClick={() => setEditarAula(novaAula({ professorIds: [prof.id] }))}>
            Atribuir aula
          </Botao>
        </div>
        {aulas.length === 0 ? (
          <p class="texto-secundario" style={{ padding: '0 20px 16px' }}>
            Este docente ainda não tem aulas atribuídas.
          </p>
        ) : (
          <table class="tabela">
            <thead>
              <tr>
                <th>Disciplina</th>
                <th>Turma(s)</th>
                <th>Tempos</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {aulas.map((a) => {
                const d = idx.disc.get(a.disciplinaId);
                return (
                  <tr key={a.id} class="clicavel" onClick={() => setEditarAula(a)}>
                    <td>
                      <span class="linha" style={{ gap: '8px' }}>
                        <span class="pastilha-cor" style={{ background: d?.cor }} />
                        {d?.nome ?? '?'}
                      </span>
                    </td>
                    <td>
                      {a.turmaIds.length ? nomesTurmas(p, a.turmaIds) : <span class="secundario">— (sem turma)</span>}
                      {a.turno && <span class="etiqueta" style={{ marginLeft: '6px' }}>{a.turno}</span>}
                    </td>
                    <td class="secundario">
                      {somaTempos(a.distribuicao)} ({textoDistribuicao(a.distribuicao)})
                    </td>
                    <td class="acoes-linha">
                      <Botao variante="fantasma" pequeno icone="lapis" title="Editar aula" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {editarAula && <EditorAula key={editarAula.id} inicial={editarAula} aoFechar={() => setEditarAula(null)} />}
    </div>
  );
}

export function PaginaProfessores() {
  const p = useProjeto();
  const rota = useRota();
  const [pesquisa, setPesquisa] = useState('');
  const [selId, setSelId] = useState<string | null>(rota.id ?? null);
  const [colar, setColar] = useState(false);
  const [fichas, setFichas] = useState<{ nome: string; ficha: FichaDocente }[] | null>(null);
  const [ajudaFichas, setAjudaFichas] = useState(false);

  useEffect(() => {
    if (rota.id && rota.id !== 'importar-fichas') setSelId(rota.id);
    const pendentes = retirarFichasPorImportar();
    const lidas: { nome: string; ficha: FichaDocente }[] = [];
    for (const f of pendentes) {
      try {
        lidas.push({ nome: f.nome, ficha: lerFicha(f.conteudo) });
      } catch (e) {
        notificar(`${f.nome}: ${(e as Error).message}`, 'erro', 7000);
      }
    }
    if (lidas.length) setFichas(lidas);
  }, [rota.id]);

  const carga = useMemo(() => temposPorProfessor(p), [p.aulas]);
  const lista = p.professores
    .filter((x) => !pesquisa || normalizar(`${x.nome} ${x.sigla} ${x.grupo}`).includes(normalizar(pesquisa)))
    .sort((a, b) => compararTexto(a.nome, b.nome));
  const sel = p.professores.find((x) => x.id === selId) ?? lista[0] ?? null;

  const adicionar = () => {
    const pr = novoProfessor();
    atualizar((d) => void d.professores.push(pr));
    setSelId(pr.id);
    setPesquisa('');
  };

  const importarFichas = async () => {
    const ficheiros = await abrirFicheiros(['.ficha', '.json'], true);
    const lidas: { nome: string; ficha: FichaDocente }[] = [];
    for (const f of ficheiros) {
      try {
        lidas.push({ nome: f.nome, ficha: lerFicha(f.conteudo) });
      } catch (e) {
        notificar(`${f.nome}: ${(e as Error).message}`, 'erro', 7000);
      }
    }
    if (lidas.length) setFichas(lidas);
  };

  const enviarModelo = async () => {
    const ok = await guardarFicheiro(
      nomeFicheiroSeguro(`Ficha de disponibilidade - ${p.escola || 'escola'}.ficha`),
      JSON.stringify(fichaModelo(p), null, 1),
      'application/json',
      FILTRO_FICHA,
    );
    if (ok) setAjudaFichas(true);
  };

  return (
    <div class="pagina larga">
      <CabecalhoPagina
        passo="Passo 4"
        titulo="Docentes"
        descricao="Registe os docentes e as suas indisponibilidades. Pode também pedir a cada docente que preencha a sua ficha de disponibilidade."
        acoes={
          <>
            <Botao icone="ficha" onClick={enviarModelo} title="Cria um ficheiro para enviar por e-mail aos docentes">
              Criar ficha para docentes
            </Botao>
            <Botao icone="carregar" onClick={importarFichas}>
              Importar fichas
            </Botao>
            <Botao icone="colar" onClick={() => setColar(true)}>
              Colar do Excel
            </Botao>
            <Botao variante="primario" icone="mais" onClick={adicionar}>
              Novo docente
            </Botao>
          </>
        }
      />
      {p.professores.length === 0 ? (
        <div class="cartao">
          <Vazio icone="pessoa" titulo="Ainda não há docentes">
            <p>Adicione os docentes um a um, ou cole a lista a partir de uma folha de Excel.</p>
            <div class="acoes" style={{ justifyContent: 'center' }}>
              <Botao variante="primario" icone="mais" onClick={adicionar}>
                Novo docente
              </Botao>
              <Botao icone="colar" onClick={() => setColar(true)}>
                Colar do Excel
              </Botao>
            </div>
          </Vazio>
        </div>
      ) : (
        <div class="mestre-detalhe">
          <div class="cartao">
            <div class="barra-lista">
              <Pesquisa valor={pesquisa} aoMudar={setPesquisa} placeholder="Procurar docente…" />
            </div>
            <div class="lista-mestre">
              {lista.map((x) => {
                const dt = p.turmas.filter((t) => t.dtId === x.id);
                const restr = Object.keys(x.indisp).length;
                return (
                  <button key={x.id} class={`item-mestre ${sel?.id === x.id ? 'ativo' : ''}`} onClick={() => setSelId(x.id)}>
                    <span class="avatar">{x.sigla || siglaDeNome(x.nome) || '?'}</span>
                    <span class="flex-1" style={{ minWidth: 0 }}>
                      <span class="nome">{x.nome || 'Sem nome'}</span>
                      <span class="sub">
                        {carga.get(x.id) ?? 0} tempos{x.grupo ? ` · grupo ${x.grupo}` : ''}
                        {dt.length ? ` · DT ${dt.map((t) => t.nome).join(', ')}` : ''}
                      </span>
                    </span>
                    {restr > 0 && (
                      <span title={`${restr} tempos com restrições`} style={{ color: 'var(--ambar)' }}>
                        <Icone nome="calendario" tamanho={15} />
                      </span>
                    )}
                  </button>
                );
              })}
              {lista.length === 0 && <p class="texto-secundario" style={{ padding: '14px' }}>Nenhum docente encontrado.</p>}
            </div>
          </div>
          {sel ? <Detalhe key={sel.id} prof={sel} /> : <div />}
        </div>
      )}
      {colar && <ImportarColar tipo="professores" aoFechar={() => setColar(false)} />}
      {fichas && <ImportarFichas fichas={fichas} aoFechar={() => setFichas(null)} />}
      {ajudaFichas && (
        <Modal titulo="Ficha criada" aoFechar={() => setAjudaFichas(false)} rodape={<Botao variante="primario" onClick={() => setAjudaFichas(false)}>Percebi</Botao>}>
          <Nota tipo="sucesso">A ficha foi guardada com os dias e tempos da sua escola.</Nota>
          <ol style={{ paddingLeft: '20px', lineHeight: 1.7 }}>
            <li>Envie o ficheiro da ficha por e-mail aos docentes.</li>
            <li>
              Cada docente abre o Gerador de Horários, carrega em <strong>«Abrir a ficha para docentes»</strong> (na página Início) e depois em{' '}
              <strong>«Abrir ficha recebida»</strong>.
            </li>
            <li>O docente marca as indisponibilidades, carrega em «Guardar ficha preenchida» e devolve-lhe o ficheiro por e-mail.</li>
            <li>
              Aqui, na página Docentes, carregue em <strong>«Importar fichas»</strong> e escolha todas as fichas recebidas de uma vez.
            </li>
          </ol>
        </Modal>
      )}
    </div>
  );
}
