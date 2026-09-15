// Grelha para marcar tempos indisponíveis ou a evitar. Clique e arraste para pintar.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { EstadoTempo, Grelha, Tempo } from '../model/tipos';
import { NOMES_DIAS, chaveGrelha } from '../model/tipos';
import { paraMinutos } from '../model/util';

type Ferramenta = EstadoTempo | 'livre';

export function GrelhaDisponibilidade(props: {
  dias: number[];
  tempos: Tempo[];
  valor: Grelha;
  aoMudar: (g: Grelha) => void;
  bloqueios?: Grelha;
  permitirEvitar?: boolean;
  compacta?: boolean;
  textoIndisponivel?: string;
  textoEvitar?: string;
}) {
  const permitirEvitar = props.permitirEvitar ?? true;
  const [ferramenta, setFerramenta] = useState<Ferramenta>('indisponivel');
  const [rascunho, setRascunho] = useState<Grelha | null>(null);
  const pintura = useRef<{ valor: EstadoTempo | null; grelha: Grelha } | null>(null);

  const dias = [...props.dias].sort((a, b) => a - b);
  const tempos = [...props.tempos].sort((a, b) => paraMinutos(a.inicio) - paraMinutos(b.inicio));
  const atual = rascunho ?? props.valor;

  useEffect(() => {
    const terminar = () => {
      if (pintura.current) {
        const g = pintura.current.grelha;
        pintura.current = null;
        setRascunho(null);
        props.aoMudar(g);
      }
    };
    window.addEventListener('pointerup', terminar);
    window.addEventListener('blur', terminar);
    return () => {
      window.removeEventListener('pointerup', terminar);
      window.removeEventListener('blur', terminar);
    };
  }, [props.aoMudar]);

  const bloqueado = (k: string) => props.bloqueios?.[k] === 'indisponivel';

  const aplicar = (k: string) => {
    const p = pintura.current;
    if (!p || bloqueado(k)) return;
    if ((p.grelha[k] ?? null) === p.valor) return;
    const g = { ...p.grelha };
    if (p.valor) g[k] = p.valor;
    else delete g[k];
    p.grelha = g;
    setRascunho(g);
  };

  const iniciar = (k: string) => {
    if (bloqueado(k)) return;
    const alvo: EstadoTempo | null = ferramenta === 'livre' ? null : ferramenta;
    const valor = (props.valor[k] ?? null) === alvo ? null : alvo;
    pintura.current = { valor, grelha: { ...props.valor } };
    aplicar(k);
  };

  const alternarConjunto = (chaves: string[]) => {
    const livres = chaves.filter((k) => !bloqueado(k));
    if (!livres.length) return;
    const alvo: EstadoTempo | null = ferramenta === 'livre' ? null : ferramenta;
    const todos = livres.every((k) => (props.valor[k] ?? null) === alvo);
    const valor = todos ? null : alvo;
    const g = { ...props.valor };
    for (const k of livres) {
      if (valor) g[k] = valor;
      else delete g[k];
    }
    props.aoMudar(g);
  };

  const contagem = { indisponivel: 0, evitar: 0 };
  for (const d of dias)
    for (const t of tempos) {
      const v = atual[chaveGrelha(d, t.id)];
      if (v) contagem[v]++;
    }

  const ferramentas: { id: Ferramenta; texto: string }[] = [
    { id: 'indisponivel', texto: props.textoIndisponivel ?? 'Indisponível' },
    ...(permitirEvitar ? [{ id: 'evitar' as Ferramenta, texto: props.textoEvitar ?? 'Evitar se possível' }] : []),
    { id: 'livre', texto: 'Disponível (apagar)' },
  ];

  if (!tempos.length || !dias.length)
    return <p class="texto-secundario">Defina primeiro os dias e os tempos em «Escola e horário».</p>;

  return (
    <div class={props.compacta ? 'disp-compacta' : ''}>
      <div class="disp-ferramentas">
        <span class="pequeno-texto texto-secundario">Pincel:</span>
        {ferramentas.map((f) => (
          <button key={f.id} type="button" class={`disp-ferramenta ${ferramenta === f.id ? 'ativo' : ''}`} onClick={() => setFerramenta(f.id)}>
            <span class={`disp-amostra ${f.id}`} />
            {f.texto}
          </button>
        ))}
        {(contagem.indisponivel > 0 || contagem.evitar > 0) && (
          <button
            type="button"
            class="botao fantasma pequeno"
            onClick={() => {
              const g = { ...props.valor };
              for (const d of dias) for (const t of tempos) delete g[chaveGrelha(d, t.id)];
              props.aoMudar(g);
            }}
          >
            Limpar tudo
          </button>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table class="disp-tabela">
          <thead>
            <tr>
              <th class="canto" />
              {dias.map((d) => (
                <th key={d} title="Clique para marcar o dia inteiro" onClick={() => alternarConjunto(tempos.map((t) => chaveGrelha(d, t.id)))}>
                  {NOMES_DIAS[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tempos.map((t, i) => (
              <tr key={t.id}>
                <th class="hora" title="Clique para marcar esta linha em todos os dias" onClick={() => alternarConjunto(dias.map((d) => chaveGrelha(d, t.id)))}>
                  {i + 1}.º · {t.inicio}
                </th>
                {dias.map((d) => {
                  const k = chaveGrelha(d, t.id);
                  const b = bloqueado(k);
                  const v = atual[k];
                  return (
                    <td
                      key={k}
                      class={`disp-celula ${b ? 'bloqueada' : v ?? ''}`}
                      title={b ? 'Bloqueado para toda a escola' : v === 'indisponivel' ? 'Indisponível' : v === 'evitar' ? 'Evitar se possível' : 'Disponível'}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        iniciar(k);
                      }}
                      onPointerEnter={() => aplicar(k)}
                    >
                      {b ? '' : v === 'indisponivel' ? '✕' : v === 'evitar' ? '~' : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div class="disp-resumo">
        {contagem.indisponivel === 0 && contagem.evitar === 0
          ? 'Sem restrições: disponível em todos os tempos.'
          : `${contagem.indisponivel} tempo(s) indisponível(eis)${permitirEvitar ? ` · ${contagem.evitar} a evitar` : ''}.`}{' '}
        Dica: clique e arraste para marcar vários tempos; clique no nome do dia ou na hora para marcar a coluna ou a linha.
      </div>
    </div>
  );
}
