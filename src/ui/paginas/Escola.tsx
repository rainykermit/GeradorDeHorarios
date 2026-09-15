import { useState } from 'preact/hooks';
import { Botao, CabecalhoPagina, Caixa, Campo, Hora, Modal, Nota, Numero, Texto, notificar, confirmar } from '../comum';
import { GrelhaDisponibilidade } from '../GrelhaDisponibilidade';
import { atualizar, useProjeto } from '../../estado/store';
import { NOMES_DIAS } from '../../model/tipos';
import { gerarTempos } from '../../model/padrao';
import { deMinutos, novoId, paraMinutos } from '../../model/util';
import { tiposDeSala } from '../../model/consultas';
import { remapearGrelhas } from '../../model/operacoes';
import { irPara } from '../navegacao';

function ordenar<T extends { inicio: string }>(lista: T[]) {
  return [...lista].sort((a, b) => (paraMinutos(a.inicio) || 0) - (paraMinutos(b.inicio) || 0));
}

function GerarTemposModal({ aoFechar }: { aoFechar: () => void }) {
  const [inicio, setInicio] = useState('08:15');
  const [duracao, setDuracao] = useState<number | null>(50);
  const [manha, setManha] = useState<number | null>(6);
  const [inicioTarde, setInicioTarde] = useState('13:40');
  const [tarde, setTarde] = useState<number | null>(4);
  const [intervalos, setIntervalos] = useState('0, 15, 0, 10, 0, 0, 10, 0, 10');

  const valores = intervalos.split(/[,;\s]+/).filter(Boolean).map(Number).filter((n) => Number.isFinite(n) && n >= 0);
  const previsao = gerarTempos({
    inicio,
    duracao: duracao ?? 50,
    temposManha: manha ?? 0,
    temposTarde: tarde ?? 0,
    inicioTarde,
    intervalos: valores.length ? valores : [0],
  });

  return (
    <Modal
      titulo="Criar tempos automaticamente"
      tamanho="grande"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            onClick={async () => {
              const ok = await confirmar({
                titulo: 'Substituir os tempos atuais?',
                texto:
                  'Os tempos atuais serão substituídos. As indisponibilidades já marcadas passam para os novos tempos pela mesma ordem (1.º tempo para o 1.º tempo, etc.). O horário gerado será limpo.',
                botao: 'Substituir',
                perigo: true,
              });
              if (!ok) return;
              atualizar((d) => {
                const antigos = [...d.config.tempos].sort((a, b) => paraMinutos(a.inicio) - paraMinutos(b.inicio));
                remapearGrelhas(d, new Map(antigos.slice(0, previsao.length).map((t, i) => [t.id, previsao[i].id])));
                d.config.tempos = previsao;
                d.horario.colocacoes = [];
                d.horario.resumo = null;
              });
              notificar(`${previsao.length} tempos criados.`);
              aoFechar();
            }}
          >
            Criar {previsao.length} tempos
          </Botao>
        </>
      }
    >
      <div class="grelha-campos">
        <Campo rotulo="Início do 1.º tempo">
          <Hora valor={inicio} aoMudar={setInicio} />
        </Campo>
        <Campo rotulo="Duração de cada tempo (min)">
          <Numero valor={duracao} aoMudar={setDuracao} min={10} max={180} />
        </Campo>
        <Campo rotulo="Tempos de manhã">
          <Numero valor={manha} aoMudar={setManha} min={0} max={12} />
        </Campo>
        <Campo rotulo="Início dos tempos da tarde">
          <Hora valor={inicioTarde} aoMudar={setInicioTarde} />
        </Campo>
        <Campo rotulo="Tempos de tarde">
          <Numero valor={tarde} aoMudar={setTarde} min={0} max={12} />
        </Campo>
      </div>
      <Campo rotulo="Intervalos depois de cada tempo (minutos, por ordem)" ajuda="Ex.: 0, 15, 0, 10 → sem intervalo depois do 1.º tempo, 15 min depois do 2.º, etc." classe="mt">
        <Texto valor={intervalos} aoMudar={setIntervalos} />
      </Campo>
      <h3 class="mt">Pré-visualização</h3>
      <div class="linha" style={{ gap: '6px' }}>
        {previsao.map((t, i) => (
          <span key={i} class="etiqueta azul">
            {i + 1}.º {t.inicio}–{t.fim}
          </span>
        ))}
      </div>
    </Modal>
  );
}

export function PaginaEscola() {
  const p = useProjeto();
  const cfg = p.config;
  const [gerar, setGerar] = useState(false);
  const tempos = cfg.tempos;
  const tiposSala = tiposDeSala(p);

  const mudarTempo = (id: string, campo: 'inicio' | 'fim', valor: string) =>
    atualizar((d) => {
      const t = d.config.tempos.find((x) => x.id === id);
      if (t) t[campo] = valor;
      d.config.tempos = ordenar(d.config.tempos);
    });

  const adicionarTempo = () =>
    atualizar((d) => {
      const lista = ordenar(d.config.tempos);
      const ultimo = lista[lista.length - 1];
      const dur = ultimo ? Math.max(10, paraMinutos(ultimo.fim) - paraMinutos(ultimo.inicio)) : 50;
      const ini = ultimo ? paraMinutos(ultimo.fim) : 8 * 60 + 15;
      d.config.tempos.push({ id: novoId('t'), inicio: deMinutos(ini), fim: deMinutos(ini + dur) });
    });

  const removerTempo = async (id: string, n: number) => {
    const usados = p.horario.colocacoes.filter((c) => c.tempoId === id).length;
    if (usados) {
      const ok = await confirmar({
        titulo: `Remover o ${n}.º tempo?`,
        texto: `Há ${usados} aula(s) colocadas neste tempo no horário atual. Essas aulas ficarão por colocar.`,
        botao: 'Remover',
        perigo: true,
      });
      if (!ok) return;
    }
    atualizar((d) => {
      d.config.tempos = d.config.tempos.filter((t) => t.id !== id);
      d.horario.colocacoes = d.horario.colocacoes.filter((c) => c.tempoId !== id);
    });
  };

  return (
    <div class="pagina">
      <CabecalhoPagina
        passo="Passo 1"
        titulo="Escola e horário"
        descricao="Dados gerais da escola e a estrutura do dia: em que dias há aulas, a que horas começa e acaba cada tempo e quando é o almoço."
        acoes={
          <Botao variante="primario" icone="seta" onClick={() => irPara('disciplinas')}>
            Seguinte: Disciplinas
          </Botao>
        }
      />

      <div class="coluna">
        <div class="cartao cartao-corpo">
          <h2>Identificação</h2>
          <div class="grelha-campos">
            <Campo rotulo="Nome da escola">
              <Texto valor={p.escola} placeholder="Ex.: Escola Básica D. Dinis" aoMudar={(v) => atualizar((d) => void (d.escola = v), { agrupar: 'escola' })} />
            </Campo>
            <Campo rotulo="Agrupamento (opcional)">
              <Texto valor={p.agrupamento} placeholder="Ex.: Agrupamento de Escolas de …" aoMudar={(v) => atualizar((d) => void (d.agrupamento = v), { agrupar: 'agrup' })} />
            </Campo>
            <Campo rotulo="Ano letivo">
              <Texto valor={p.anoLetivo} placeholder="2026/2027" aoMudar={(v) => atualizar((d) => void (d.anoLetivo = v), { agrupar: 'ano' })} />
            </Campo>
          </div>
        </div>

        <div class="cartao cartao-corpo">
          <h2>Dias de aulas</h2>
          <div class="linha" style={{ gap: '18px' }}>
            {NOMES_DIAS.map((nome, d) => (
              <Caixa
                key={d}
                marcado={cfg.dias.includes(d)}
                aoMudar={(v) =>
                  atualizar((x) => {
                    x.config.dias = v ? [...new Set([...x.config.dias, d])].sort() : x.config.dias.filter((y) => y !== d);
                    if (!v) x.horario.colocacoes = x.horario.colocacoes.filter((c) => c.dia !== d);
                  })
                }
              >
                {nome}
              </Caixa>
            ))}
          </div>
        </div>

        <div class="cartao cartao-corpo">
          <div class="linha mb">
            <h2 class="flex-1" style={{ margin: 0 }}>
              Tempos letivos
            </h2>
            <Botao icone="varinha" onClick={() => setGerar(true)}>
              Criar tempos automaticamente
            </Botao>
            <Botao icone="mais" onClick={adicionarTempo}>
              Adicionar tempo
            </Botao>
          </div>
          {tempos.length === 0 ? (
            <Nota tipo="aviso">Ainda não há tempos. Use «Criar tempos automaticamente» para começar rapidamente.</Nota>
          ) : (
            <div class="tabela-envolvente">
              <table class="tabela" style={{ maxWidth: '720px' }}>
                <thead>
                  <tr>
                    <th>Tempo</th>
                    <th>Início</th>
                    <th>Fim</th>
                    <th>Duração</th>
                    <th>Intervalo a seguir</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tempos.map((t, i) => {
                    const ini = paraMinutos(t.inicio);
                    const fim = paraMinutos(t.fim);
                    const dur = fim - ini;
                    const seguinte = tempos[i + 1];
                    const intervalo = seguinte ? paraMinutos(seguinte.inicio) - fim : null;
                    const invalido = !(dur > 0) || (i > 0 && ini < paraMinutos(tempos[i - 1].fim));
                    return (
                      <tr key={t.id}>
                        <td>
                          <strong>{i + 1}.º</strong>
                        </td>
                        <td>
                          <Hora valor={t.inicio} invalido={invalido} aoMudar={(v) => mudarTempo(t.id, 'inicio', v)} />
                        </td>
                        <td>
                          <Hora valor={t.fim} invalido={invalido} aoMudar={(v) => mudarTempo(t.id, 'fim', v)} />
                        </td>
                        <td class="secundario">{dur > 0 ? `${dur} min` : <span class="etiqueta vermelha">inválido</span>}</td>
                        <td class="secundario">
                          {intervalo === null ? '—' : intervalo < 0 ? <span class="etiqueta vermelha">sobreposto</span> : intervalo === 0 ? 'sem intervalo' : `${intervalo} min`}
                        </td>
                        <td class="acoes-linha">
                          <Botao variante="fantasma" pequeno icone="lixo" title="Remover tempo" onClick={() => removerTempo(t.id, i + 1)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div class="cartao cartao-corpo">
          <h2>Almoço, tarde e blocos</h2>
          <div class="grelha-campos">
            <Campo rotulo="Período de almoço — início" ajuda="Deve existir pelo menos um tempo livre neste período.">
              <Hora valor={cfg.almocoInicio} aoMudar={(v) => atualizar((d) => void (d.config.almocoInicio = v))} />
            </Campo>
            <Campo rotulo="Período de almoço — fim">
              <Hora valor={cfg.almocoFim} aoMudar={(v) => atualizar((d) => void (d.config.almocoFim = v))} />
            </Campo>
            <Campo rotulo="A tarde começa às" ajuda="Tempos que começam a esta hora ou depois são «de tarde».">
              <Hora valor={cfg.inicioTarde} aoMudar={(v) => atualizar((d) => void (d.config.inicioTarde = v))} />
            </Campo>
            <Campo rotulo="Blocos podem atravessar intervalos até (min)" ajuda="Ex.: com 20, uma aula de 2 tempos pode incluir um intervalo de 15 min.">
              <Numero valor={cfg.intervaloMaxBloco} min={0} max={240} aoMudar={(v) => atualizar((d) => void (d.config.intervaloMaxBloco = v ?? 0))} />
            </Campo>
          </div>
        </div>

        <div class="cartao cartao-corpo">
          <h2>Tempos bloqueados para toda a escola</h2>
          <p class="texto-secundario" style={{ marginTop: 0 }}>
            Marque os tempos em que não pode haver aulas para ninguém — por exemplo, a tarde reservada a reuniões.
          </p>
          <GrelhaDisponibilidade
            dias={cfg.dias}
            tempos={cfg.tempos}
            valor={p.bloqueios}
            textoIndisponivel="Bloqueado"
            textoEvitar="Evitar aulas"
            aoMudar={(g) => atualizar((d) => void (d.bloqueios = g))}
          />
        </div>

        <div class="cartao cartao-corpo">
          <h2>Salas de aula</h2>
          <Caixa marcado={cfg.atribuirSalasNormais} aoMudar={(v) => atualizar((d) => void (d.config.atribuirSalasNormais = v))}>
            Atribuir automaticamente uma sala às aulas que não precisam de sala especial e cuja turma não tem sala habitual
          </Caixa>
          {cfg.atribuirSalasNormais && (
            <Campo rotulo="Tipo de sala a usar" classe="mt" estilo={{ maxWidth: '320px' }}>
              <select class="entrada" value={cfg.tipoSalaNormal} onChange={(e) => atualizar((d) => void (d.config.tipoSalaNormal = (e.target as HTMLSelectElement).value))}>
                {tiposSala.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Campo>
          )}
        </div>
      </div>
      {gerar && <GerarTemposModal aoFechar={() => setGerar(false)} />}
    </div>
  );
}
