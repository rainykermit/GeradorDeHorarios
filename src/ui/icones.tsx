// Ícones SVG simples (traço), para não depender de recursos externos.

const CAMINHOS: Record<string, string> = {
  inicio: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  escola: 'M3 21h18M5 21V10l7-5 7 5v11M9 21v-5h6v5M12 10.5h.01',
  livro: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7',
  porta: 'M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M15 12h.01',
  pessoa: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  grupo: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 13.5a7 7 0 0 1 4 6.5',
  lista: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  regras: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  raio: 'M13 2L4 14h7l-1 8 9-12h-7z',
  calendario: 'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8 2v4M16 2v4',
  ajuda: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  mais: 'M12 5v14M5 12h14',
  lixo: 'M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4h6v3',
  lapis: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  cadeado: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  cadeadoAberto: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.5-2',
  guardar: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7',
  abrir: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  descarregar: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  carregar: 'M12 15V3M7 8l5-5 5 5M4 21h16',
  imprimir: 'M6 9V3h12v6M6 18H4v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7h-2M7 14h10v7H7z',
  folha: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M8 13l4 5M12 13l-4 5',
  anular: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  refazer: 'M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3',
  aviso: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  erro: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM15 9l-6 6M9 9l6 6',
  ok: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 12l3 3 5-6',
  visto: 'M5 12l5 5L20 7',
  fechar: 'M6 6l12 12M18 6L6 18',
  pesquisa: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
  copiar: 'M9 9h11v11H9zM5 15H4V4h11v1',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7h.01',
  play: 'M7 4l13 8-13 8z',
  stop: 'M6 6h12v12H6z',
  seta: 'M9 6l6 6-6 6',
  setaEsq: 'M15 6l-6 6 6 6',
  baixo: 'M6 9l6 6 6-6',
  colar: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M9 12h6M9 16h4',
  varinha: 'M4 20L14 10M16 4v3M20 8h-3M18.5 5.5l-2 2M11 3v2M21 13h-2',
  mover: 'M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4',
  olho: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ficha: 'M6 3h9l4 4v14H6zM9 12h6M9 16h6M9 8h3',
  estrela: 'M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z',
  sair: 'M15 4h4v16h-4M10 17l-5-5 5-5M5 12h11',
};

export function Icone({ nome, tamanho = 18, classe = '' }: { nome: keyof typeof CAMINHOS | string; tamanho?: number; classe?: string }) {
  return (
    <svg
      class={`icone ${classe}`}
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={CAMINHOS[nome] ?? CAMINHOS.info} />
    </svg>
  );
}
