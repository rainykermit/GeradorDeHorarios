import { Botao, CabecalhoPagina, Nota, Numero, NIVEIS, Segmentado, confirmar } from '../comum';
import { atualizar, useProjeto } from '../../estado/store';
import type { Nivel, Regras } from '../../model/tipos';
import { regrasPadrao } from '../../model/padrao';
import { irPara } from '../navegacao';

type ChaveNivel = { [K in keyof Regras]: Regras[K] extends Nivel ? K : never }[keyof Regras];

const PREFERENCIAS: { chave: ChaveNivel; titulo: string; texto: string }[] = [
  { chave: 'furosTurmas', titulo: 'Evitar furos nas turmas', texto: 'Tempos livres entre aulas no horário dos alunos (o almoço não conta como furo).' },
  { chave: 'mesmaDisciplinaMesmoDia', titulo: 'Espalhar as aulas da mesma disciplina pela semana', texto: 'Evita duas aulas da mesma disciplina no mesmo dia na mesma turma.' },
  { chave: 'almocoTurmas', titulo: 'Garantir tempo para almoço às turmas', texto: 'Pelo menos um tempo livre no período de almoço quando há aulas antes e depois.' },
  { chave: 'furosProfessores', titulo: 'Evitar furos nos docentes', texto: 'Tempos livres entre aulas no horário dos docentes.' },
  { chave: 'almocoProfessores', titulo: 'Garantir tempo para almoço aos docentes', texto: 'Pelo menos um tempo livre no período de almoço.' },
  { chave: 'preferencias', titulo: 'Respeitar os tempos marcados «evitar se possível»', texto: 'Preferências dos docentes, turmas, disciplinas e da escola.' },
  { chave: 'consecutivosProfessores', titulo: 'Limitar tempos seguidos dos docentes', texto: 'Penaliza quando um docente ultrapassa o número de tempos seguidos indicado abaixo.' },
  { chave: 'turnosIsolados', titulo: 'Evitar esperas nas aulas por turnos', texto: 'Quando só metade da turma tem aula, a outra metade não deve ficar à espera a meio do dia.' },
  { chave: 'tardesTurmas', titulo: 'Concentrar as aulas das turmas de manhã', texto: 'Reduz o número de tardes com aulas para os alunos.' },
  { chave: 'diasProfessores', titulo: 'Concentrar as aulas dos docentes em menos dias', texto: 'Tenta dar aos docentes dias sem aulas.' },
];

export function PaginaRegras() {
  const p = useProjeto();
  const r = p.regras;
  const mudar = (parcial: Partial<Regras>) => atualizar((d) => void Object.assign(d.regras, parcial));

  return (
    <div class="pagina">
      <CabecalhoPagina
        passo="Passo 7"
        titulo="Regras"
        descricao="Estas regras orientam a geração do horário. Os valores recomendados servem a maioria das escolas — só precisa de mudar se quiser dar prioridade a algo diferente."
        acoes={
          <>
            <Botao
              icone="anular"
              onClick={async () => {
                if (await confirmar({ titulo: 'Repor os valores recomendados?', texto: 'Todas as regras voltam aos valores de origem.', botao: 'Repor' }))
                  atualizar((d) => void (d.regras = regrasPadrao()));
              }}
            >
              Repor recomendados
            </Botao>
            <Botao variante="primario" icone="seta" onClick={() => irPara('gerar')}>
              Seguinte: Gerar horário
            </Botao>
          </>
        }
      />

      <div class="cartao mb">
        <div class="cartao-corpo" style={{ paddingBottom: 0 }}>
          <h2>Regras obrigatórias</h2>
          <Nota tipo="info">
            Estas regras são sempre cumpridas: um docente, uma turma ou uma sala nunca têm duas aulas ao mesmo tempo; as indisponibilidades marcadas como
            «indisponível» são respeitadas; e os limites diários abaixo nunca são ultrapassados.
          </Nota>
        </div>
        <div class="regra">
          <div class="descricao">
            <strong>Máximo de tempos por dia de uma turma</strong>
            <span>Pode ser ajustado turma a turma. Deixe vazio para não limitar.</span>
          </div>
          <Numero valor={r.maxTemposDiaTurma || null} min={1} max={20} placeholder="Sem limite" aoMudar={(v) => mudar({ maxTemposDiaTurma: v ?? 0 })} />
        </div>
        <div class="regra">
          <div class="descricao">
            <strong>Máximo de tempos letivos por dia de um docente</strong>
            <span>Pode ser ajustado docente a docente. Deixe vazio para não limitar.</span>
          </div>
          <Numero valor={r.maxTemposDiaProfessor || null} min={1} max={20} placeholder="Sem limite" aoMudar={(v) => mudar({ maxTemposDiaProfessor: v ?? 0 })} />
        </div>
      </div>

      <div class="cartao">
        <div class="cartao-corpo" style={{ paddingBottom: 4 }}>
          <h2>Preferências</h2>
          <p class="texto-secundario" style={{ marginTop: 0 }}>
            O gerador tenta cumprir todas. Quando não é possível, sacrifica primeiro as menos importantes.
          </p>
        </div>
        {PREFERENCIAS.map((pr) => (
          <div class="regra" key={pr.chave}>
            <div class="descricao">
              <strong>{pr.titulo}</strong>
              <span>{pr.texto}</span>
            </div>
            <Segmentado valor={r[pr.chave]} opcoes={NIVEIS} aoMudar={(v) => mudar({ [pr.chave]: v } as Partial<Regras>)} />
          </div>
        ))}
        <div class="regra">
          <div class="descricao">
            <strong>Número de tempos seguidos aceitável para um docente</strong>
            <span>Usado pela regra «Limitar tempos seguidos». Pode ser ajustado docente a docente.</span>
          </div>
          <Numero valor={r.maxConsecutivosProfessor || null} min={1} max={20} placeholder="Sem limite" aoMudar={(v) => mudar({ maxConsecutivosProfessor: v ?? 0 })} />
        </div>
      </div>
    </div>
  );
}
