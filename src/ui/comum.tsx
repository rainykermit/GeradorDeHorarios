// Componentes de interface reutilizáveis.

import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icone } from './icones';
import type { Nivel } from '../model/tipos';
import { PALETA, normalizar } from '../model/util';

type Variante = 'primario' | 'secundario' | 'perigo' | 'perigo-cheio' | 'fantasma' | 'sucesso';

export function Botao(props: {
  variante?: Variante;
  icone?: string;
  pequeno?: boolean;
  grande?: boolean;
  onClick?: (e: MouseEvent) => void;
  disabled?: boolean;
  title?: string;
  children?: ComponentChildren;
  classe?: string;
  tipo?: 'button' | 'submit';
}) {
  const { variante = 'secundario', icone, pequeno, grande, children, classe = '' } = props;
  const soIcone = !children && icone;
  return (
    <button
      type={props.tipo ?? 'button'}
      class={`botao ${variante} ${pequeno ? 'pequeno' : ''} ${grande ? 'grande' : ''} ${soIcone ? 'so-icone' : ''} ${classe}`}
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      aria-label={soIcone ? props.title : undefined}
    >
      {icone && <Icone nome={icone} tamanho={pequeno ? 15 : grande ? 20 : 17} />}
      {children}
    </button>
  );
}

export function Modal(props: {
  titulo: ComponentChildren;
  aoFechar: () => void;
  children: ComponentChildren;
  rodape?: ComponentChildren;
  tamanho?: 'pequena' | 'media' | 'grande';
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.aoFechar();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [props.aoFechar]);
  return (
    <div
      class="fundo-modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.aoFechar();
      }}
    >
      <div class={`modal ${props.tamanho ?? ''}`} role="dialog" aria-modal="true">
        <div class="modal-cabecalho">
          <h2>{props.titulo}</h2>
          <Botao variante="fantasma" icone="fechar" title="Fechar" onClick={props.aoFechar} />
        </div>
        <div class="modal-corpo">{props.children}</div>
        {props.rodape && <div class="modal-rodape">{props.rodape}</div>}
      </div>
    </div>
  );
}

export function Campo(props: { rotulo: ComponentChildren; ajuda?: ComponentChildren; children: ComponentChildren; classe?: string; estilo?: JSX.CSSProperties }) {
  return (
    <label class={`campo ${props.classe ?? ''}`} style={props.estilo}>
      <span class="rotulo">{props.rotulo}</span>
      {props.children}
      {props.ajuda && <span class="ajuda">{props.ajuda}</span>}
    </label>
  );
}

export function Texto(props: {
  valor: string;
  aoMudar: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  maxLength?: number;
  invalido?: boolean;
  estilo?: JSX.CSSProperties;
  aoSair?: () => void;
  aoEnter?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (props.autoFocus) ref.current?.focus();
  }, []);
  return (
    <input
      ref={ref}
      class={`entrada ${props.invalido ? 'invalida' : ''}`}
      type="text"
      value={props.valor}
      placeholder={props.placeholder}
      maxLength={props.maxLength}
      style={props.estilo}
      onInput={(e) => props.aoMudar((e.target as HTMLInputElement).value)}
      onBlur={props.aoSair}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && props.aoEnter) props.aoEnter();
      }}
    />
  );
}

export function AreaTexto(props: { valor: string; aoMudar: (v: string) => void; placeholder?: string; linhas?: number }) {
  return (
    <textarea
      class="entrada"
      value={props.valor}
      rows={props.linhas ?? 3}
      placeholder={props.placeholder}
      onInput={(e) => props.aoMudar((e.target as HTMLTextAreaElement).value)}
    />
  );
}

export function Numero(props: {
  valor: number | null;
  aoMudar: (v: number | null) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  estilo?: JSX.CSSProperties;
}) {
  const [texto, setTexto] = useState(props.valor == null ? '' : String(props.valor));
  useEffect(() => {
    const atual = texto.trim() === '' ? null : Number(texto);
    if (atual !== props.valor) setTexto(props.valor == null ? '' : String(props.valor));
  }, [props.valor]);
  return (
    <input
      class="entrada"
      type="number"
      inputMode="numeric"
      value={texto}
      min={props.min}
      max={props.max}
      placeholder={props.placeholder}
      style={props.estilo ?? { maxWidth: '140px' }}
      onInput={(e) => {
        const v = (e.target as HTMLInputElement).value;
        setTexto(v);
        if (v.trim() === '') props.aoMudar(null);
        else {
          let n = Math.floor(Number(v));
          if (Number.isNaN(n)) return;
          if (props.min != null) n = Math.max(props.min, n);
          if (props.max != null) n = Math.min(props.max, n);
          props.aoMudar(n);
        }
      }}
    />
  );
}

export function Hora(props: { valor: string; aoMudar: (v: string) => void; invalido?: boolean }) {
  return (
    <input
      class={`entrada ${props.invalido ? 'invalida' : ''}`}
      type="time"
      value={props.valor}
      style={{ maxWidth: '130px' }}
      onChange={(e) => props.aoMudar((e.target as HTMLInputElement).value)}
    />
  );
}

export interface Opcao {
  valor: string;
  texto: string;
  detalhe?: string;
}

export function Seletor(props: { valor: string; opcoes: Opcao[]; aoMudar: (v: string) => void; vazio?: string; estilo?: JSX.CSSProperties }) {
  return (
    <select class="entrada" value={props.valor} style={props.estilo} onChange={(e) => props.aoMudar((e.target as HTMLSelectElement).value)}>
      {props.vazio !== undefined && <option value="">{props.vazio}</option>}
      {props.opcoes.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.texto}
        </option>
      ))}
    </select>
  );
}

export function Caixa(props: { marcado: boolean; aoMudar: (v: boolean) => void; children: ComponentChildren }) {
  return (
    <label class="caixa-marcar">
      <input type="checkbox" checked={props.marcado} onChange={(e) => props.aoMudar((e.target as HTMLInputElement).checked)} />
      <span>{props.children}</span>
    </label>
  );
}

export function SeletorMultiplo(props: {
  valores: string[];
  opcoes: Opcao[];
  aoMudar: (v: string[]) => void;
  placeholder?: string;
  unico?: boolean;
}) {
  const [pesquisa, setPesquisa] = useState('');
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const porValor = useMemo(() => new Map(props.opcoes.map((o) => [o.valor, o])), [props.opcoes]);
  const filtradas = useMemo(() => {
    const q = normalizar(pesquisa);
    return props.opcoes
      .filter((o) => !props.valores.includes(o.valor))
      .filter((o) => !q || normalizar(o.texto + ' ' + (o.detalhe ?? '')).includes(q))
      .slice(0, 80);
  }, [pesquisa, props.opcoes, props.valores]);

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  const adicionar = (v: string) => {
    props.aoMudar(props.unico ? [v] : [...props.valores, v]);
    setPesquisa('');
    setDestaque(0);
    if (props.unico) setAberto(false);
  };

  return (
    <div class="multi" ref={ref}>
      <div class="multi-caixa" onClick={() => inputRef.current?.focus()}>
        {props.valores.map((v) => (
          <span class="chip" key={v}>
            {porValor.get(v)?.texto ?? '?'}
            <button
              type="button"
              title="Remover"
              onClick={(e) => {
                e.stopPropagation();
                props.aoMudar(props.valores.filter((x) => x !== v));
              }}
            >
              <Icone nome="fechar" tamanho={13} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={pesquisa}
          placeholder={props.valores.length ? '' : props.placeholder ?? 'Escreva para procurar…'}
          onFocus={() => setAberto(true)}
          onInput={(e) => {
            setPesquisa((e.target as HTMLInputElement).value);
            setAberto(true);
            setDestaque(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setDestaque((d) => Math.min(d + 1, filtradas.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setDestaque((d) => Math.max(d - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (filtradas[destaque]) adicionar(filtradas[destaque].valor);
            } else if (e.key === 'Backspace' && !pesquisa && props.valores.length) {
              props.aoMudar(props.valores.slice(0, -1));
            } else if (e.key === 'Escape') setAberto(false);
          }}
        />
      </div>
      {aberto && filtradas.length > 0 && (
        <div class="multi-lista">
          {filtradas.map((o, i) => (
            <div
              key={o.valor}
              class={`multi-opcao ${i === destaque ? 'destacada' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                adicionar(o.valor);
              }}
              onMouseEnter={() => setDestaque(i)}
            >
              <span>{o.texto}</span>
              {o.detalhe && <span class="detalhe">{o.detalhe}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Separadores<T extends string>(props: {
  itens: { id: T; texto: string; contagem?: number; icone?: string }[];
  ativo: T;
  aoMudar: (id: T) => void;
}) {
  return (
    <div class="separadores" role="tablist">
      {props.itens.map((it) => (
        <button key={it.id} role="tab" class={`separador ${it.id === props.ativo ? 'ativo' : ''}`} onClick={() => props.aoMudar(it.id)}>
          {it.icone && <Icone nome={it.icone} tamanho={16} />}
          {it.texto}
          {it.contagem !== undefined && <span class="etiqueta">{it.contagem}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmentado<T extends string | number>(props: { valor: T; opcoes: { valor: T; texto: string }[]; aoMudar: (v: T) => void }) {
  return (
    <div class="segmentado">
      {props.opcoes.map((o) => (
        <button key={String(o.valor)} type="button" class={o.valor === props.valor ? 'ativo' : ''} onClick={() => props.aoMudar(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

export const NIVEIS: { valor: Nivel; texto: string }[] = [
  { valor: 0, texto: 'Desligada' },
  { valor: 1, texto: 'Pouco importante' },
  { valor: 2, texto: 'Importante' },
  { valor: 3, texto: 'Muito importante' },
];

export function Vazio(props: { icone?: string; titulo: string; children?: ComponentChildren }) {
  return (
    <div class="vazio">
      <Icone nome={props.icone ?? 'info'} tamanho={40} />
      <h3>{props.titulo}</h3>
      {props.children}
    </div>
  );
}

export function Nota(props: { tipo?: 'info' | 'aviso' | 'erro' | 'sucesso'; children: ComponentChildren; classe?: string }) {
  const tipo = props.tipo ?? 'info';
  const icone = { info: 'info', aviso: 'aviso', erro: 'erro', sucesso: 'ok' }[tipo];
  return (
    <div class={`nota ${tipo} ${props.classe ?? ''}`}>
      <Icone nome={icone} />
      <div>{props.children}</div>
    </div>
  );
}

export function CabecalhoPagina(props: { passo?: string; titulo: string; descricao?: ComponentChildren; acoes?: ComponentChildren }) {
  return (
    <div class="cabecalho-pagina">
      <div class="textos">
        {props.passo && <div class="passo">{props.passo}</div>}
        <h1>{props.titulo}</h1>
        {props.descricao && <p>{props.descricao}</p>}
      </div>
      {props.acoes && <div class="acoes">{props.acoes}</div>}
    </div>
  );
}

export function Pesquisa(props: { valor: string; aoMudar: (v: string) => void; placeholder?: string }) {
  return (
    <div class="pesquisa">
      <Icone nome="pesquisa" tamanho={16} />
      <input class="entrada" type="search" value={props.valor} placeholder={props.placeholder ?? 'Procurar…'} onInput={(e) => props.aoMudar((e.target as HTMLInputElement).value)} />
    </div>
  );
}

export function SeletorCor(props: { valor: string; aoMudar: (v: string) => void }) {
  return (
    <div class="paleta">
      {PALETA.map((c) => (
        <button key={c} type="button" title={c} class={c.toLowerCase() === props.valor.toLowerCase() ? 'ativo' : ''} style={{ background: c }} onClick={() => props.aoMudar(c)} />
      ))}
      <input type="color" title="Outra cor" value={props.valor} onInput={(e) => props.aoMudar((e.target as HTMLInputElement).value)} />
    </div>
  );
}

// ───────── Notificações e confirmações globais ─────────

interface Notificacao {
  id: number;
  texto: string;
  tipo: 'sucesso' | 'erro' | 'aviso' | 'info';
}

let notificacoes: Notificacao[] = [];
let ouvinteNotif: (() => void) | null = null;
let proxId = 1;

export function notificar(texto: string, tipo: Notificacao['tipo'] = 'sucesso', duracao = 3800) {
  const n = { id: proxId++, texto, tipo };
  notificacoes = [...notificacoes, n];
  ouvinteNotif?.();
  setTimeout(() => {
    notificacoes = notificacoes.filter((x) => x.id !== n.id);
    ouvinteNotif?.();
  }, duracao);
}

interface PedidoConfirmacao {
  titulo: string;
  texto: ComponentChildren;
  botao?: string;
  cancelar?: string;
  perigo?: boolean;
  resolver: (v: boolean) => void;
}

let pedido: PedidoConfirmacao | null = null;
let ouvinteConf: (() => void) | null = null;

export function confirmar(opcoes: Omit<PedidoConfirmacao, 'resolver'>): Promise<boolean> {
  return new Promise((resolver) => {
    pedido?.resolver(false);
    pedido = { ...opcoes, resolver };
    ouvinteConf?.();
  });
}

export function Camadas() {
  const [, forcar] = useState(0);
  useEffect(() => {
    ouvinteNotif = () => forcar((n) => n + 1);
    ouvinteConf = () => forcar((n) => n + 1);
    return () => {
      ouvinteNotif = null;
      ouvinteConf = null;
    };
  }, []);
  const responder = (v: boolean) => {
    const p = pedido;
    pedido = null;
    forcar((n) => n + 1);
    p?.resolver(v);
  };
  return (
    <>
      {pedido && (
        <Modal
          titulo={pedido.titulo}
          tamanho="pequena"
          aoFechar={() => responder(false)}
          rodape={
            <>
              <Botao onClick={() => responder(false)}>{pedido.cancelar ?? 'Cancelar'}</Botao>
              <Botao variante={pedido.perigo ? 'perigo-cheio' : 'primario'} onClick={() => responder(true)}>
                {pedido.botao ?? 'Confirmar'}
              </Botao>
            </>
          }
        >
          <div style={{ fontSize: '15px' }}>{pedido.texto}</div>
        </Modal>
      )}
      <div class="notificacoes" aria-live="polite">
        {notificacoes.map((n) => (
          <div key={n.id} class={`notificacao ${n.tipo}`}>
            <Icone nome={n.tipo === 'erro' ? 'erro' : n.tipo === 'aviso' ? 'aviso' : n.tipo === 'info' ? 'info' : 'ok'} />
            <span>{n.texto}</span>
          </div>
        ))}
      </div>
    </>
  );
}
