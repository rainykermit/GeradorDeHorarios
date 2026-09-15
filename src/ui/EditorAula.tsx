import { useEffect, useState } from 'preact/hooks';
import { Botao, Campo, Modal, Nota, Segmentado, Seletor, SeletorMultiplo, Texto, confirmar, notificar } from './comum';
import { atualizar, useProjeto } from '../estado/store';
import type { Aula, ModoSala } from '../model/tipos';
import { ajustarColocacoesAula, eliminarAula, novaAula } from '../model/operacoes';
import { gruposSimultaneos, indices, ordenarPorNome, temposPorProfessor } from '../model/consultas';
import { compararTexto, lerDistribuicao, normalizar, somaTempos, textoDistribuicao } from '../model/util';

export function descreverDistribuicao(d: number[]): string {
  if (!d.length) return '';
  const total = somaTempos(d);
  const partes = d.map((x) => (x === 1 ? '1 tempo' : `bloco de ${x} tempos seguidos`));
  return `${total} ${total === 1 ? 'tempo' : 'tempos'} por semana: ${partes.join(' + ')}`;
}

/** Campo de texto para a distribuição semanal ("2+1"). Só grava quando o valor é válido. */
export function CampoDistribuicao({ valor, aoMudar, compacto }: { valor: number[]; aoMudar: (v: number[]) => void; compacto?: boolean }) {
  const [texto, setTexto] = useState(textoDistribuicao(valor));
  useEffect(() => {
    if (lerDistribuicao(texto)?.join('+') !== valor.join('+')) setTexto(textoDistribuicao(valor));
  }, [valor.join('+')]);
  const lido = lerDistribuicao(texto);
  return (
    <input
      class={`entrada ${lido ? '' : 'invalida'}`}
      value={texto}
      style={compacto ? { maxWidth: '96px' } : undefined}
      title="Ex.: 1+1+1 (três aulas de 1 tempo) ou 2+1 (um bloco de 2 tempos e uma aula de 1 tempo)"
      onInput={(e) => {
        const v = (e.target as HTMLInputElement).value;
        setTexto(v);
        const d = lerDistribuicao(v);
        if (d && !compacto) aoMudar(d);
      }}
      onBlur={() => {
        const d = lerDistribuicao(texto);
        if (d) aoMudar(d);
        else setTexto(textoDistribuicao(valor));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

const ATALHOS = ['1', '1+1', '1+1+1', '1+1+1+1', '1+1+1+1+1', '2', '2+1', '2+2', '2+1+1'];

export function EditorAula({ inicial, aoFechar }: { inicial: Aula; aoFechar: () => void }) {
  const p = useProjeto();
  const idx = indices(p);
  const [a, setA] = useState<Aula>(inicial);
  const existe = idx.aula.has(inicial.id);
  const mudar = (parcial: Partial<Aula>) => setA((x) => ({ ...x, ...parcial }));
  const carga = temposPorProfessor(p);
  const disc = idx.disc.get(a.disciplinaId);

  const turnos = [...new Set(p.aulas.map((x) => x.turno).filter(Boolean))].sort(compararTexto);
  const grupos = gruposSimultaneos(p);

  const guardar = (outra: boolean) => {
    if (!a.disciplinaId) return notificar('Escolha a disciplina.', 'aviso');
    if (!a.distribuicao.length) return notificar('Indique os tempos por semana.', 'aviso');
    if (a.modoSala === 'fixa' && !a.salaId) return notificar('Escolha a sala fixa.', 'aviso');
    const final: Aula = { ...a, turno: a.turno.trim(), simultaneo: a.simultaneo.trim() };
    atualizar((d) => {
      const i = d.aulas.findIndex((x) => x.id === final.id);
      const antes = i >= 0 ? (JSON.parse(JSON.stringify(d.aulas[i])) as Aula) : undefined;
      if (i >= 0) d.aulas[i] = final;
      else d.aulas.push(final);
      ajustarColocacoesAula(d, antes, final);
    });
    notificar(existe ? 'Aula atualizada.' : 'Aula adicionada.');
    if (outra) setA(novaAula({ turmaIds: a.turmaIds, professorIds: a.professorIds, distribuicao: [1] }));
    else aoFechar();
  };

  let explicacaoSala = '';
  if (a.modoSala === 'auto') {
    if (disc?.tipoSala) explicacaoSala = `Será escolhida uma sala do tipo «${disc.tipoSala}».`;
    else if (a.turmaIds.length === 1 && idx.turma.get(a.turmaIds[0])?.salaId)
      explicacaoSala = `Será usada a sala habitual da turma (${idx.sala.get(idx.turma.get(a.turmaIds[0])!.salaId!)?.nome}).`;
    else if (p.config.atribuirSalasNormais) explicacaoSala = `Será escolhida uma sala do tipo «${p.config.tipoSalaNormal}».`;
    else explicacaoSala = 'Esta aula não ocupa nenhuma sala controlada.';
  }

  return (
    <Modal
      titulo={existe ? 'Editar aula' : 'Nova aula'}
      tamanho="grande"
      aoFechar={aoFechar}
      rodape={
        <>
          {existe && (
            <Botao
              variante="perigo"
              icone="lixo"
              classe="flex-1-esq"
              onClick={async () => {
                if (await confirmar({ titulo: 'Eliminar esta aula?', texto: 'A aula é removida da distribuição de serviço e do horário.', botao: 'Eliminar', perigo: true })) {
                  atualizar((d) => eliminarAula(d, a.id));
                  aoFechar();
                }
              }}
            >
              Eliminar
            </Botao>
          )}
          <span class="flex-1" />
          <Botao onClick={aoFechar}>Cancelar</Botao>
          {!existe && <Botao onClick={() => guardar(true)}>Guardar e adicionar outra</Botao>}
          <Botao variante="primario" onClick={() => guardar(false)}>
            Guardar
          </Botao>
        </>
      }
    >
      <div class="grelha-campos" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        <Campo rotulo="Disciplina">
          <Seletor
            valor={a.disciplinaId}
            vazio="— Escolha a disciplina —"
            opcoes={ordenarPorNome(p.disciplinas).map((d) => ({ valor: d.id, texto: `${d.nome}${d.sigla ? ` (${d.sigla})` : ''}` }))}
            aoMudar={(v) => mudar({ disciplinaId: v })}
          />
        </Campo>
        <Campo rotulo="Turma(s)" ajuda="Pode escolher várias turmas se tiverem aula juntas (ex.: EMRC).">
          <SeletorMultiplo
            valores={a.turmaIds}
            placeholder="Escreva o nome da turma…"
            opcoes={ordenarPorNome(p.turmas).map((t) => ({ valor: t.id, texto: t.nome }))}
            aoMudar={(v) => mudar({ turmaIds: v })}
          />
        </Campo>
        <Campo rotulo="Docente(s)" ajuda="Dois docentes na mesma aula = par pedagógico / coadjuvação.">
          <SeletorMultiplo
            valores={a.professorIds}
            placeholder="Escreva o nome do docente…"
            opcoes={ordenarPorNome(p.professores).map((x) => ({ valor: x.id, texto: x.nome, detalhe: `${x.sigla ? x.sigla + ' · ' : ''}${carga.get(x.id) ?? 0} tempos` }))}
            aoMudar={(v) => mudar({ professorIds: v })}
          />
        </Campo>
        <Campo rotulo="Tempos por semana" ajuda={descreverDistribuicao(a.distribuicao) || 'Ex.: 1+1+1 ou 2+1'}>
          <CampoDistribuicao valor={a.distribuicao} aoMudar={(v) => mudar({ distribuicao: v })} />
          <div class="linha" style={{ gap: '4px' }}>
            {ATALHOS.map((t) => (
              <button key={t} type="button" class={`botao pequeno ${a.distribuicao.join('+') === t ? 'primario' : 'fantasma'}`} onClick={() => mudar({ distribuicao: lerDistribuicao(t)! })}>
                {t}
              </button>
            ))}
          </div>
        </Campo>
      </div>

      <h3 class="mt">Sala</h3>
      <Segmentado<ModoSala>
        valor={a.modoSala}
        opcoes={[
          { valor: 'auto', texto: 'Automática' },
          { valor: 'fixa', texto: 'Sala fixa' },
          { valor: 'nenhuma', texto: 'Sem sala' },
        ]}
        aoMudar={(v) => mudar({ modoSala: v })}
      />
      {a.modoSala === 'fixa' && (
        <div class="mt" style={{ maxWidth: '360px' }}>
          <Seletor
            valor={a.salaId ?? ''}
            vazio="— Escolha a sala —"
            opcoes={ordenarPorNome(p.salas).map((s) => ({ valor: s.id, texto: `${s.nome}${s.tipo ? ` (${s.tipo})` : ''}` }))}
            aoMudar={(v) => mudar({ salaId: v || null })}
          />
        </div>
      )}
      {explicacaoSala && <p class="texto-secundario pequeno-texto">{explicacaoSala}</p>}

      <details class="mt" open={!!(a.turno || a.simultaneo || a.notas)}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Opções avançadas: turnos, aulas simultâneas e notas</summary>
        <div class="grelha-campos mt" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          <Campo rotulo="Turno / grupo de alunos" ajuda="Deixe vazio se é para a turma toda. Use quando a turma se divide (ex.: «Turno 1» e «Turno 2», ou «Francês» e «Espanhol»).">
            <input class="entrada" list="lista-turnos" value={a.turno} placeholder="Turma toda" onInput={(e) => mudar({ turno: (e.target as HTMLInputElement).value })} />
            <datalist id="lista-turnos">
              {['Turno 1', 'Turno 2', ...turnos.filter((t) => !['turno 1', 'turno 2'].includes(normalizar(t)))].map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Campo>
          <Campo rotulo="Grupo simultâneo" ajuda="Aulas com o mesmo nome de grupo decorrem sempre à mesma hora (ex.: Francês e Espanhol do 7.º A).">
            <input class="entrada" list="lista-grupos" value={a.simultaneo} placeholder="Nenhum" onInput={(e) => mudar({ simultaneo: (e.target as HTMLInputElement).value })} />
            <datalist id="lista-grupos">
              {grupos.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Campo>
          <Campo rotulo="Notas">
            <Texto valor={a.notas} aoMudar={(v) => mudar({ notas: v })} placeholder="Opcional" />
          </Campo>
        </div>
        {a.turno && a.turmaIds.length > 0 && (
          <Nota tipo="info" classe="mt">
            As aulas de turnos diferentes da mesma turma podem acontecer ao mesmo tempo (ex.: Turno 1 em Ciências e Turno 2 em Físico-Química).
          </Nota>
        )}
      </details>
    </Modal>
  );
}
