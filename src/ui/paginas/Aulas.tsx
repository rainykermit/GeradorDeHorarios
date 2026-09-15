import { useEffect, useMemo, useState } from 'preact/hooks';
import { Botao, CabecalhoPagina, Caixa, Pesquisa, Seletor, Vazio, confirmar } from '../comum';
import { EditorAula } from '../EditorAula';
import { ImportarColar } from '../ImportarColar';
import { atualizar, useProjeto } from '../../estado/store';
import type { Aula } from '../../model/tipos';
import { eliminarAula, novaAula } from '../../model/operacoes';
import { descreverAula, indices, nomesProfessores, nomesTurmas, ordenarPorNome } from '../../model/consultas';
import { compararTexto, normalizar, somaTempos, textoDistribuicao } from '../../model/util';
import { irPara, useRota } from '../navegacao';

export function PaginaAulas() {
  const p = useProjeto();
  const rota = useRota();
  const idx = indices(p);
  const [pesquisa, setPesquisa] = useState('');
  const [turma, setTurma] = useState('');
  const [prof, setProf] = useState('');
  const [disc, setDisc] = useState('');
  const [semDocente, setSemDocente] = useState(false);
  const [editar, setEditar] = useState<Aula | null>(null);
  const [colar, setColar] = useState(false);

  useEffect(() => {
    const id = rota.id;
    if (!id) return;
    if (id.startsWith('disc:')) setDisc(id.slice(5));
    else if (id.startsWith('prof:')) setProf(id.slice(5));
    else if (id.startsWith('turma:')) setTurma(id.slice(6));
    else {
      const a = p.aulas.find((x) => x.id === id);
      if (a) setEditar(a);
    }
  }, [rota.id]);

  const lista = useMemo(() => {
    const q = normalizar(pesquisa);
    return p.aulas
      .filter((a) => (!turma || a.turmaIds.includes(turma)) && (!prof || a.professorIds.includes(prof)) && (!disc || a.disciplinaId === disc))
      .filter((a) => !semDocente || a.professorIds.length === 0)
      .filter((a) => !q || normalizar(descreverAula(p, a) + ' ' + a.turno + ' ' + a.simultaneo).includes(q))
      .sort(
        (a, b) =>
          compararTexto(nomesTurmas(p, a.turmaIds), nomesTurmas(p, b.turmaIds)) ||
          compararTexto(idx.disc.get(a.disciplinaId)?.nome ?? '', idx.disc.get(b.disciplinaId)?.nome ?? ''),
      );
  }, [p, pesquisa, turma, prof, disc, semDocente]);

  const totalTempos = lista.reduce((a, x) => a + somaTempos(x.distribuicao), 0);
  const nSemDocente = p.aulas.filter((a) => !a.professorIds.length).length;
  const filtros = !!(turma || prof || disc || semDocente || pesquisa);

  return (
    <div class="pagina larga">
      <CabecalhoPagina
        passo="Passo 6"
        titulo="Aulas (distribuição de serviço)"
        descricao="Cada linha é uma aula semanal: disciplina, turma(s), docente(s) e quantos tempos. Também pode editar as aulas a partir de cada turma ou docente."
        acoes={
          <>
            <Botao icone="colar" onClick={() => setColar(true)}>
              Colar do Excel
            </Botao>
            <Botao
              variante="primario"
              icone="mais"
              onClick={() => setEditar(novaAula({ turmaIds: turma ? [turma] : [], professorIds: prof ? [prof] : [], disciplinaId: disc }))}
            >
              Nova aula
            </Botao>
          </>
        }
      />
      <div class="cartao">
        {p.aulas.length === 0 ? (
          <Vazio icone="lista" titulo="Ainda não há aulas">
            <p>
              A forma mais rápida é criar as turmas com o plano curricular (página Turmas) e depois escolher o docente de cada disciplina. Também pode colar a
              distribuição de serviço a partir do Excel.
            </p>
            <div class="acoes" style={{ justifyContent: 'center' }}>
              <Botao variante="primario" icone="grupo" onClick={() => irPara('turmas')}>
                Ir para Turmas
              </Botao>
              <Botao icone="colar" onClick={() => setColar(true)}>
                Colar do Excel
              </Botao>
            </div>
          </Vazio>
        ) : (
          <>
            <div class="barra-lista">
              <Pesquisa valor={pesquisa} aoMudar={setPesquisa} placeholder="Procurar…" />
              <Seletor estilo={{ maxWidth: '170px' }} valor={turma} vazio="Todas as turmas" opcoes={ordenarPorNome(p.turmas).map((t) => ({ valor: t.id, texto: t.nome }))} aoMudar={setTurma} />
              <Seletor estilo={{ maxWidth: '220px' }} valor={prof} vazio="Todos os docentes" opcoes={ordenarPorNome(p.professores).map((t) => ({ valor: t.id, texto: t.nome }))} aoMudar={setProf} />
              <Seletor estilo={{ maxWidth: '220px' }} valor={disc} vazio="Todas as disciplinas" opcoes={ordenarPorNome(p.disciplinas).map((t) => ({ valor: t.id, texto: t.nome }))} aoMudar={setDisc} />
              {nSemDocente > 0 && (
                <Caixa marcado={semDocente} aoMudar={setSemDocente}>
                  Só sem docente ({nSemDocente})
                </Caixa>
              )}
              {filtros && (
                <Botao
                  variante="fantasma"
                  pequeno
                  onClick={() => {
                    setPesquisa('');
                    setTurma('');
                    setProf('');
                    setDisc('');
                    setSemDocente(false);
                  }}
                >
                  Limpar filtros
                </Botao>
              )}
              <span class="flex-1" />
              <span class="texto-secundario pequeno-texto">
                {lista.length} aulas · {totalTempos} tempos
              </span>
            </div>
            <div class="tabela-envolvente">
              <table class="tabela">
                <thead>
                  <tr>
                    <th>Turma(s)</th>
                    <th>Disciplina</th>
                    <th>Docente(s)</th>
                    <th>Tempos</th>
                    <th>Sala</th>
                    <th>Simultânea com</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((a) => {
                    const d = idx.disc.get(a.disciplinaId);
                    const sala =
                      a.modoSala === 'fixa' ? idx.sala.get(a.salaId ?? '')?.nome ?? '?' : a.modoSala === 'nenhuma' ? 'Sem sala' : d?.tipoSala ? `Auto (${d.tipoSala})` : 'Automática';
                    return (
                      <tr key={a.id} class="clicavel" onClick={() => setEditar(a)}>
                        <td>
                          {a.turmaIds.length ? <strong>{nomesTurmas(p, a.turmaIds)}</strong> : <span class="secundario">—</span>}
                          {a.turno && <span class="etiqueta" style={{ marginLeft: '6px' }}>{a.turno}</span>}
                        </td>
                        <td>
                          <span class="linha" style={{ gap: '8px', flexWrap: 'nowrap' }}>
                            <span class="pastilha-cor" style={{ background: d?.cor }} />
                            {d?.nome ?? '?'}
                          </span>
                        </td>
                        <td>{a.professorIds.length ? nomesProfessores(p, a.professorIds) : <span class="etiqueta ambar">Sem docente</span>}</td>
                        <td>
                          <strong>{somaTempos(a.distribuicao)}</strong> <span class="secundario">({textoDistribuicao(a.distribuicao)})</span>
                        </td>
                        <td class="secundario">{sala}</td>
                        <td class="secundario">{a.simultaneo || '—'}</td>
                        <td class="acoes-linha" onClick={(e) => e.stopPropagation()}>
                          <Botao
                            variante="fantasma"
                            pequeno
                            icone="copiar"
                            title="Duplicar"
                            onClick={() => setEditar(novaAula({ ...a, id: '' }))}
                          />
                          <Botao
                            variante="fantasma"
                            pequeno
                            icone="lixo"
                            title="Eliminar"
                            onClick={async () => {
                              if (await confirmar({ titulo: 'Eliminar esta aula?', texto: descreverAula(p, a), botao: 'Eliminar', perigo: true }))
                                atualizar((x) => eliminarAula(x, a.id));
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {lista.length === 0 && <p class="texto-secundario" style={{ padding: '16px' }}>Nenhuma aula corresponde aos filtros.</p>}
            </div>
          </>
        )}
      </div>
      {editar && <EditorAula key={editar.id} inicial={editar} aoFechar={() => setEditar(null)} />}
      {colar && <ImportarColar tipo="aulas" aoFechar={() => setColar(false)} />}
    </div>
  );
}
