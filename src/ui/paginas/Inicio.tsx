import { Botao, CabecalhoPagina, Nota } from '../comum';
import { Icone } from '../icones';
import { irPara } from '../navegacao';
import { useProjeto } from '../../estado/store';
import { abrirExemplo, abrirProjeto, guardarProjeto, novoHorario } from '../acoesFicheiro';
import { ITENS_PREPARACAO, ITENS_RESULTADO } from '../App';
import { somaTempos } from '../../model/util';
import { emDesktop } from '../../estado/persistencia';

const DESCRICOES: Record<string, string> = {
  escola: 'Nome da escola, dias de aulas, tempos letivos, intervalos e almoço.',
  disciplinas: 'As disciplinas lecionadas, com cores e o tipo de sala de que precisam.',
  salas: 'Salas, laboratórios, pavilhão… e quantas turmas cabem em simultâneo.',
  professores: 'Os docentes e as suas indisponibilidades pessoais.',
  turmas: 'As turmas, diretores de turma e salas habituais.',
  aulas: 'A distribuição de serviço: quem dá o quê, a que turma e quantos tempos.',
  regras: 'O que é mais importante: evitar furos, garantir almoço, etc.',
  gerar: 'Verificar os dados e criar o horário automaticamente.',
  horarios: 'Consultar, ajustar à mão, imprimir e exportar para Excel.',
};

export function PaginaInicio() {
  const p = useProjeto();
  const vazio = p.turmas.length === 0 && p.professores.length === 0 && p.aulas.length === 0;
  const totalTempos = p.aulas.reduce((a, x) => a + somaTempos(x.distribuicao), 0);

  return (
    <div class="pagina">
      {vazio ? (
        <div class="boas-vindas">
          <div style={{ flex: 1, minWidth: '280px' }}>
            <h1>Bem-vindo ao Gerador de Horários</h1>
            <p>
              Crie os horários das turmas e dos docentes da sua escola de forma automática. Indique as disciplinas, os docentes, as turmas e as
              indisponibilidades de cada um — a aplicação trata do resto, sem sobreposições e com o mínimo de furos.
            </p>
            <div class="acoes">
              <Botao grande classe="claro" icone="mais" onClick={novoHorario}>
                Começar um horário novo
              </Botao>
              <Botao grande classe="transparente" icone="estrela" onClick={abrirExemplo}>
                Experimentar com uma escola de exemplo
              </Botao>
              <Botao grande classe="transparente" icone="abrir" onClick={abrirProjeto}>
                Abrir um ficheiro guardado
              </Botao>
            </div>
          </div>
          <Icone nome="calendario" tamanho={120} classe="" />
        </div>
      ) : (
        <CabecalhoPagina
          titulo={p.escola || 'Horário sem nome'}
          descricao={`Ano letivo ${p.anoLetivo} · ${p.turmas.length} turmas · ${p.professores.length} docentes · ${p.aulas.length} aulas (${totalTempos} tempos semanais)`}
          acoes={
            <>
              <Botao icone="guardar" onClick={guardarProjeto}>
                Guardar cópia em ficheiro
              </Botao>
              <Botao variante="primario" icone="raio" onClick={() => irPara('gerar')}>
                Gerar horário
              </Botao>
            </>
          }
        />
      )}

      <h2 style={{ fontSize: '18px', margin: '8px 0 12px' }}>Como fazer, passo a passo</h2>
      <div class="passos">
        {[...ITENS_PREPARACAO, ...ITENS_RESULTADO].map((it) => {
          const feito = it.feito?.(p);
          return (
            <button key={it.pagina} class="cartao passo-cartao" onClick={() => irPara(it.pagina)}>
              <span class={`num ${feito ? 'feito' : ''}`}>{feito ? <Icone nome="visto" tamanho={16} /> : it.passo}</span>
              <span>
                <h3>{it.texto}</h3>
                <p>{DESCRICOES[it.pagina]}</p>
              </span>
            </button>
          );
        })}
      </div>

      <div class="grelha-campos mt" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
        <div class="cartao cartao-corpo">
          <h2>
            <Icone nome="ficha" /> Recolher as indisponibilidades dos docentes
          </h2>
          <p class="texto-secundario" style={{ marginTop: 0 }}>
            Cada docente pode preencher a sua própria ficha de disponibilidade nesta aplicação e enviá-la por e-mail. Depois, basta importar as fichas na
            página «Docentes».
          </p>
          <Botao icone="ficha" onClick={() => irPara('ficha')}>
            Abrir a ficha para docentes
          </Botao>
        </div>
        <div class="cartao cartao-corpo">
          <h2>
            <Icone nome="guardar" /> O seu trabalho está seguro
          </h2>
          <p class="texto-secundario" style={{ marginTop: 0 }}>
            Tudo o que faz é guardado automaticamente neste computador. Para ter uma cópia de segurança, ou para continuar noutro computador, use o botão
            «Guardar» no topo — é criado um ficheiro que pode abrir mais tarde com «Abrir».
          </p>
          {!vazio && (
            <Nota tipo="info">
              Dica: guarde uma cópia em ficheiro sempre que terminar uma sessão de trabalho importante.
            </Nota>
          )}
        </div>
        {!emDesktop() && __REPOSITORIO__ && (
          <div class="cartao cartao-corpo">
            <h2>
              <Icone nome="descarregar" /> Instalar no computador
            </h2>
            <p class="texto-secundario" style={{ marginTop: 0 }}>
              Prefere uma aplicação com ícone no ambiente de trabalho? Instale o Gerador de Horários no seu computador. Funciona da mesma forma, sem
              precisar do navegador.
            </p>
            <div class="acoes">
              <a class="botao primario" href={`https://github.com/${__REPOSITORIO__}/releases/latest/download/Gerador-de-Horarios-win-x64.exe`}>
                <Icone nome="descarregar" tamanho={17} /> Para Windows
              </a>
              <a class="botao" href={`https://github.com/${__REPOSITORIO__}/releases/latest/download/Gerador-de-Horarios-mac-universal.dmg`}>
                <Icone nome="descarregar" tamanho={17} /> Para Mac
              </a>
            </div>
            <p class="pequeno-texto texto-secundario">
              O trabalho feito aqui no navegador não passa sozinho para a aplicação: carregue em «Guardar» aqui e depois em «Abrir» na aplicação.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
