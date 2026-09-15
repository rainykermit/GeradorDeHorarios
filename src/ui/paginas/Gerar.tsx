import { useMemo, useState } from 'preact/hooks';
import { Botao, CabecalhoPagina, Caixa, Nota, Segmentado, notificar } from '../comum';
import { Icone } from '../icones';
import { irPara } from '../navegacao';
import { useProjeto } from '../../estado/store';
import { iniciarGeracao, pararGeracao, useGeracao } from '../../estado/geracao';
import { verificarProjeto } from '../../model/validacao';
import { estadoDoHorario } from '../../motor/conversao';
import { plural } from '../../model/util';

const DURACOES = [
  { valor: 20, texto: 'Rápida (20 s)' },
  { valor: 60, texto: 'Normal (1 min)' },
  { valor: 180, texto: 'Cuidada (3 min)' },
  { valor: 600, texto: 'Máxima (10 min)' },
];

function lerDuracao() {
  try {
    const v = Number(localStorage.getItem('gerador-de-horarios:duracao'));
    return DURACOES.some((d) => d.valor === v) ? v : 60;
  } catch {
    return 60;
  }
}

export function Estatisticas({ analise, total, colocadas }: { analise: ReturnType<ReturnType<typeof estadoDoHorario>['motor']['analisar']>; total: number; colocadas: number }) {
  const t = analise.totais;
  const cls = (v: number, medio = 1) => (v === 0 ? 'bom' : v <= medio ? 'medio' : 'mau');
  return (
    <div class="estatisticas">
      <div class={`estatistica ${colocadas === total ? 'bom' : 'mau'}`}>
        <div class="valor">
          {colocadas}/{total}
        </div>
        <div class="legenda">aulas colocadas</div>
      </div>
      <div class={`estatistica ${cls(t.furosTurmas, 3)}`}>
        <div class="valor">{t.furosTurmas}</div>
        <div class="legenda">furos nas turmas</div>
      </div>
      <div class={`estatistica ${cls(t.furosProfs, 20)}`}>
        <div class="valor">{t.furosProfs}</div>
        <div class="legenda">furos nos docentes</div>
      </div>
      <div class={`estatistica ${cls(t.semAlmocoTurmas + t.semAlmocoProfs, 2)}`}>
        <div class="valor">{t.semAlmocoTurmas + t.semAlmocoProfs}</div>
        <div class="legenda">dias sem tempo para almoço</div>
      </div>
      <div class={`estatistica ${cls(t.mesmoDia, 3)}`}>
        <div class="valor">{t.mesmoDia}</div>
        <div class="legenda">disciplinas repetidas no mesmo dia</div>
      </div>
      <div class={`estatistica ${cls(analise.aulasEmEvitar, 5)}`}>
        <div class="valor">{analise.aulasEmEvitar}</div>
        <div class="legenda">aulas em tempos «a evitar»</div>
      </div>
    </div>
  );
}

export function PaginaGerar() {
  const p = useProjeto();
  const g = useGeracao();
  const [duracao, setDuracao] = useState(lerDuracao);
  const [manterFixas, setManterFixas] = useState(true);
  const [melhorar, setMelhorar] = useState(false);
  const [mostrarAvisos, setMostrarAvisos] = useState(false);

  const ocorrencias = useMemo(() => (g.ativo ? [] : verificarProjeto(p)), [p, g.ativo]);
  const erros = ocorrencias.filter((o) => o.nivel === 'erro');
  const avisos = ocorrencias.filter((o) => o.nivel === 'aviso');
  const temHorario = p.horario.colocacoes.length > 0;
  const nFixas = new Set(p.horario.colocacoes.filter((c) => c.fixa).map((c) => c.aulaId + '#' + c.indice)).size;

  const analise = useMemo(() => {
    if (!temHorario || g.ativo) return null;
    const e = estadoDoHorario(p);
    return { analise: e.motor.analisar(), total: e.problema.unidades.length };
  }, [p, g.ativo]);

  const gerar = () => {
    try {
      localStorage.setItem('gerador-de-horarios:duracao', String(duracao));
    } catch {
      /* ignorar */
    }
    iniciarGeracao(p, { segundos: duracao, manterFixas, usarHorarioAtual: melhorar && temHorario }, (r) => {
      if (r.colocadas === r.total) notificar('Horário gerado com todas as aulas colocadas!', 'sucesso', 6000);
      else notificar(`Horário gerado, mas ${r.total - r.colocadas} aula(s) ficaram por colocar.`, 'aviso', 8000);
    });
  };

  const pr = g.progresso;
  const restantes = pr ? Math.max(0, Math.round(g.segundos - pr.decorrido)) : g.segundos;

  return (
    <div class="pagina">
      <CabecalhoPagina
        passo="Passo 8"
        titulo="Gerar horário"
        descricao="A aplicação verifica os dados e procura o melhor horário possível, respeitando as regras obrigatórias e reduzindo furos e outros incómodos."
      />

      {g.ativo ? (
        <div class="cartao cartao-corpo">
          <h2>
            <Icone nome="raio" /> A gerar o horário…
          </h2>
          <div class="barra-progresso mb">
            <div style={{ width: `${Math.round((pr?.fracao ?? 0) * 100)}%` }} />
          </div>
          <div class="linha mb" style={{ justifyContent: 'space-between' }}>
            <span>
              {!pr
                ? 'A preparar…'
                : pr.fase === 'colocar'
                  ? `A colocar as aulas: ${pr.colocadas} de ${pr.total}`
                  : `Todas as aulas possíveis colocadas (${pr.colocadas} de ${pr.total}). A melhorar o horário…`}
            </span>
            <span class="texto-secundario">Faltam cerca de {restantes >= 60 ? `${Math.ceil(restantes / 60)} min` : `${restantes} s`}</span>
          </div>
          <Nota tipo="info">
            Pode continuar a usar a aplicação enquanto o horário é gerado. Se estiver satisfeito com o progresso, pode parar a qualquer momento: fica com o
            melhor horário encontrado até agora.
          </Nota>
          <div class="acoes mt">
            <Botao variante="perigo" icone="stop" onClick={pararGeracao}>
              Parar e usar o melhor encontrado
            </Botao>
          </div>
        </div>
      ) : (
        <div class="coluna">
          <div class="cartao">
            <div class="cartao-corpo" style={{ paddingBottom: ocorrencias.length ? 8 : undefined }}>
              <h2>1. Verificação dos dados</h2>
              {erros.length === 0 && avisos.length === 0 && <Nota tipo="sucesso">Está tudo pronto para gerar o horário.</Nota>}
              {erros.length > 0 && (
                <Nota tipo="erro">
                  Há {plural(erros.length, 'problema que tem', 'problemas que têm')} de ser corrigido{erros.length === 1 ? '' : 's'} antes de gerar o horário.
                </Nota>
              )}
              {erros.length === 0 && avisos.length > 0 && (
                <Nota tipo="aviso">
                  Pode gerar o horário, mas veja {avisos.length === 1 ? 'o aviso' : `os ${avisos.length} avisos`}.{' '}
                  <button class="botao pequeno" onClick={() => setMostrarAvisos((v) => !v)}>
                    {mostrarAvisos ? 'Esconder' : 'Mostrar'}
                  </button>
                </Nota>
              )}
            </div>
            {(erros.length > 0 || mostrarAvisos) && (
              <div class="ocorrencias">
                {[...erros, ...(mostrarAvisos || erros.length ? avisos : [])].slice(0, 200).map((o, i) => (
                  <div key={i} class={`ocorrencia ${o.nivel}`}>
                    <Icone nome={o.nivel === 'erro' ? 'erro' : 'aviso'} />
                    <span class="texto">{o.texto}</span>
                    {o.destino && (
                      <Botao pequeno onClick={() => irPara(o.destino!.pagina, o.destino!.id)}>
                        Corrigir
                      </Botao>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div class="cartao cartao-corpo">
            <h2>2. Opções</h2>
            <div class="coluna" style={{ gap: '12px' }}>
              <div>
                <div class="pequeno-texto texto-secundario" style={{ marginBottom: '6px', fontWeight: 600 }}>
                  Tempo de procura — quanto mais tempo, melhor o resultado
                </div>
                <Segmentado valor={duracao} opcoes={DURACOES} aoMudar={setDuracao} />
              </div>
              {temHorario && (
                <>
                  <Caixa marcado={melhorar} aoMudar={setMelhorar}>
                    Partir do horário atual e tentar melhorá-lo (em vez de começar do zero)
                  </Caixa>
                  <Caixa marcado={manterFixas} aoMudar={setManterFixas}>
                    Manter as aulas fixadas no sítio {nFixas > 0 ? `(${nFixas} fixadas)` : '(não há aulas fixadas)'}
                  </Caixa>
                </>
              )}
            </div>
          </div>

          <div class="cartao cartao-corpo">
            <h2>3. Gerar</h2>
            {g.erro && (
              <Nota tipo="erro" classe="mb">
                Ocorreu um erro inesperado: {g.erro}
              </Nota>
            )}
            <div class="linha">
              <Botao variante="primario" grande icone="raio" disabled={erros.length > 0} onClick={gerar}>
                {temHorario ? 'Gerar novo horário' : 'Gerar horário'}
              </Botao>
              {temHorario && (
                <span class="texto-secundario pequeno-texto">
                  O horário atual será substituído. Pode sempre anular com <span class="kbd">Ctrl</span>+<span class="kbd">Z</span>.
                </span>
              )}
            </div>
          </div>

          {analise && (
            <div class="cartao cartao-corpo">
              <div class="linha mb">
                <h2 class="flex-1" style={{ margin: 0 }}>
                  Horário atual
                </h2>
                {p.horario.resumo && (
                  <span class="texto-secundario pequeno-texto">
                    Gerado em {new Date(p.horario.resumo.data).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                )}
                <Botao variante="sucesso" icone="calendario" onClick={() => irPara('horarios')}>
                  Ver e editar horários
                </Botao>
              </div>
              <Estatisticas analise={analise.analise} total={analise.total} colocadas={analise.total - analise.analise.naoColocadas.length} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
