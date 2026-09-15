import { useEffect } from 'preact/hooks';
import { Icone } from './icones';
import { Botao, Camadas, notificar } from './comum';
import { irPara, useRota } from './navegacao';
import { anular, gravarAgora, podeAnular, podeRefazer, refazer, useGravacao, useProjeto } from '../estado/store';
import { abrirConteudoExterno, abrirExemplo, abrirProjeto, guardarProjeto, novoHorario } from './acoesFicheiro';
import { useGeracao } from '../estado/geracao';
import type { Projeto } from '../model/tipos';
import type { Pagina } from '../model/validacao';
import { PaginaInicio } from './paginas/Inicio';
import { PaginaEscola } from './paginas/Escola';
import { PaginaDisciplinas } from './paginas/Disciplinas';
import { PaginaSalas } from './paginas/Salas';
import { PaginaProfessores } from './paginas/Professores';
import { PaginaTurmas } from './paginas/Turmas';
import { PaginaAulas } from './paginas/Aulas';
import { PaginaRegras } from './paginas/Regras';
import { PaginaGerar } from './paginas/Gerar';
import { PaginaHorarios } from './paginas/Horarios';
import { PaginaAjuda } from './paginas/Ajuda';
import { FichaDocente } from './paginas/FichaDocente';

interface ItemNav {
  pagina: Pagina;
  texto: string;
  icone: string;
  passo?: number;
  contagem?: (p: Projeto) => number | undefined;
  feito?: (p: Projeto) => boolean;
}

export const ITENS_PREPARACAO: ItemNav[] = [
  { pagina: 'escola', texto: 'Escola e horário', icone: 'escola', passo: 1, feito: (p) => !!p.escola && p.config.tempos.length > 0 && p.config.dias.length > 0 },
  { pagina: 'disciplinas', texto: 'Disciplinas', icone: 'livro', passo: 2, contagem: (p) => p.disciplinas.length, feito: (p) => p.disciplinas.length > 0 },
  { pagina: 'salas', texto: 'Salas', icone: 'porta', passo: 3, contagem: (p) => p.salas.length, feito: (p) => p.salas.length > 0 },
  { pagina: 'professores', texto: 'Docentes', icone: 'pessoa', passo: 4, contagem: (p) => p.professores.length, feito: (p) => p.professores.length > 0 },
  { pagina: 'turmas', texto: 'Turmas', icone: 'grupo', passo: 5, contagem: (p) => p.turmas.length, feito: (p) => p.turmas.length > 0 },
  {
    pagina: 'aulas',
    texto: 'Aulas',
    icone: 'lista',
    passo: 6,
    contagem: (p) => p.aulas.length,
    feito: (p) => p.aulas.length > 0 && p.aulas.every((a) => a.professorIds.length > 0),
  },
  { pagina: 'regras', texto: 'Regras', icone: 'regras', passo: 7 },
];

export const ITENS_RESULTADO: ItemNav[] = [
  { pagina: 'gerar', texto: 'Gerar horário', icone: 'raio', passo: 8, feito: (p) => p.horario.colocacoes.length > 0 },
  { pagina: 'horarios', texto: 'Ver e editar horários', icone: 'calendario', passo: 9 },
];

function Navegacao({ ativa, projeto }: { ativa: string; projeto: Projeto }) {
  const item = (it: ItemNav) => {
    const feito = it.feito?.(projeto);
    const n = it.contagem?.(projeto);
    return (
      <a key={it.pagina} href={`#/${it.pagina}`} class={`item-nav ${ativa === it.pagina ? 'ativo' : ''}`} title={it.texto}>
        {it.passo ? <span class={`num ${feito ? 'feito' : ''}`}>{feito ? <Icone nome="visto" tamanho={13} /> : it.passo}</span> : <Icone nome={it.icone} />}
        <span class="rotulo">{it.texto}</span>
        {n !== undefined && n > 0 && <span class="contagem">{n}</span>}
      </a>
    );
  };
  return (
    <aside class="lateral">
      <a class="marca" href="#/inicio" style={{ textDecoration: 'none' }}>
        <span class="marca-logo">
          <Icone nome="calendario" tamanho={20} />
        </span>
        <span>Gerador de Horários</span>
      </a>
      <nav>
        <a href="#/inicio" class={`item-nav ${ativa === 'inicio' ? 'ativo' : ''}`} title="Início">
          <Icone nome="inicio" />
          <span class="rotulo">Início</span>
        </a>
        <div class="secao">Preparação</div>
        {ITENS_PREPARACAO.map(item)}
        <div class="secao">Resultado</div>
        {ITENS_RESULTADO.map(item)}
        <div class="secao">Apoio</div>
        <a href="#/ajuda" class={`item-nav ${ativa === 'ajuda' ? 'ativo' : ''}`} title="Ajuda">
          <Icone nome="ajuda" />
          <span class="rotulo">Ajuda</span>
        </a>
      </nav>
      <div class="rodape-lateral">
        Versão {__VERSAO__}
        <br />
        Feito por{' '}
        <a href="https://github.com/rainykermit" target="_blank" rel="noopener noreferrer">
          rainykermit
        </a>
      </div>
    </aside>
  );
}

function EstadoGravacao() {
  const g = useGravacao();
  const hora = g.quando ? g.quando.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : null;
  const texto =
    g.estado === 'pendente' ? 'A guardar…' : g.estado === 'erro' ? 'Erro ao guardar automaticamente' : hora ? `Guardado automaticamente às ${hora}` : 'Guardado automaticamente';
  return (
    <span class="estado-gravacao" title="O seu trabalho é guardado automaticamente neste computador. Use «Guardar» para criar uma cópia num ficheiro.">
      <span class={`ponto ${g.estado}`} />
      {texto}
    </span>
  );
}

export function App() {
  const rota = useRota();
  const projeto = useProjeto();
  const geracao = useGeracao();

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      // Na aplicação de computador estes atalhos pertencem ao menu da janela;
      // tratá-los também aqui podia executá-los duas vezes (ex.: duas janelas de «Guardar» no Windows).
      if (window.gdhDesktop) return;
      const alvo = e.target as HTMLElement;
      const aEscrever = alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable);
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault();
        guardarProjeto();
      } else if (k === 'o') {
        e.preventDefault();
        abrirProjeto();
      } else if (!aEscrever && k === 'z' && !e.shiftKey) {
        e.preventDefault();
        anular();
      } else if (!aEscrever && ((k === 'z' && e.shiftKey) || k === 'y')) {
        e.preventDefault();
        refazer();
      }
    };
    window.addEventListener('keydown', tecla);
    const aEscrever = () => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const desktop = window.gdhDesktop;
    desktop?.aoMenu?.((acao) => {
      if (acao === 'novo') novoHorario();
      else if (acao === 'abrir') abrirProjeto();
      else if (acao === 'guardar') guardarProjeto();
      else if (acao === 'exemplo') abrirExemplo();
      else if (acao === 'anular') aEscrever() ? document.execCommand('undo') : anular();
      else if (acao === 'refazer') aEscrever() ? document.execCommand('redo') : refazer();
      else if (acao === 'ajuda') irPara('ajuda');
    });
    desktop?.aoFechar?.(gravarAgora);
    desktop?.aoAbrirFicheiro?.((f) => abrirConteudoExterno(f.nome, f.conteudo));
    const aoSair = () => {
      gravarAgora();
    };
    // Largar um ficheiro na janela abre-o, em vez de o navegador substituir a aplicação pelo seu conteúdo.
    const arrastarSobre = (ev: DragEvent) => {
      if (ev.dataTransfer?.types.includes('Files')) ev.preventDefault();
    };
    const largarFicheiro = async (ev: DragEvent) => {
      const f = ev.dataTransfer?.files?.[0];
      if (!f) return;
      ev.preventDefault();
      if (!/\.(horario|ficha|json)$/i.test(f.name)) {
        notificar('Só é possível abrir ficheiros de horário (.horario) ou fichas de disponibilidade (.ficha).', 'aviso', 6000);
        return;
      }
      abrirConteudoExterno(f.name, await f.text());
    };
    window.addEventListener('pagehide', aoSair);
    window.addEventListener('dragover', arrastarSobre);
    window.addEventListener('drop', largarFicheiro);
    return () => {
      window.removeEventListener('keydown', tecla);
      window.removeEventListener('pagehide', aoSair);
      window.removeEventListener('dragover', arrastarSobre);
      window.removeEventListener('drop', largarFicheiro);
    };
  }, []);

  useEffect(() => {
    document.querySelector('.conteudo')?.scrollTo(0, 0);
  }, [rota.pagina]);

  if (rota.pagina === 'ficha') {
    return (
      <>
        <FichaDocente />
        <Camadas />
      </>
    );
  }

  const paginas: Record<string, () => preact.JSX.Element> = {
    inicio: PaginaInicio,
    escola: PaginaEscola,
    disciplinas: PaginaDisciplinas,
    salas: PaginaSalas,
    professores: PaginaProfessores,
    turmas: PaginaTurmas,
    aulas: PaginaAulas,
    regras: PaginaRegras,
    gerar: PaginaGerar,
    horarios: PaginaHorarios,
    ajuda: PaginaAjuda,
  };
  const Conteudo = paginas[rota.pagina] ?? PaginaInicio;

  return (
    <div class="app">
      <Navegacao ativa={rota.pagina} projeto={projeto} />
      <div class="principal">
        <header class="topo">
          <div class="titulo-projeto">
            <strong>{projeto.escola || 'Novo horário'}</strong>
            <span>
              {projeto.agrupamento ? `${projeto.agrupamento} · ` : ''}Ano letivo {projeto.anoLetivo}
            </span>
          </div>
          {geracao.ativo && rota.pagina !== 'gerar' && (
            <a href="#/gerar" class="etiqueta azul" style={{ textDecoration: 'none', padding: '4px 10px' }} title="Ver o progresso">
              <Icone nome="raio" tamanho={13} /> A gerar horário… {Math.round((geracao.progresso?.fracao ?? 0) * 100)}%
            </a>
          )}
          <EstadoGravacao />
          <div class="acoes">
            <Botao variante="fantasma" icone="anular" title="Anular (Ctrl+Z)" disabled={!podeAnular()} onClick={anular} />
            <Botao variante="fantasma" icone="refazer" title="Refazer (Ctrl+Shift+Z)" disabled={!podeRefazer()} onClick={refazer} />
            <Botao icone="mais" onClick={novoHorario} title="Começar um horário novo">
              Novo
            </Botao>
            <Botao icone="abrir" onClick={abrirProjeto} title="Abrir um horário guardado num ficheiro (Ctrl+O)">
              Abrir
            </Botao>
            <Botao variante="primario" icone="guardar" onClick={guardarProjeto} title="Guardar uma cópia num ficheiro (Ctrl+S)">
              Guardar
            </Botao>
          </div>
        </header>
        <main class="conteudo">
          <Conteudo key={rota.pagina} />
        </main>
      </div>
      <Camadas />
    </div>
  );
}
