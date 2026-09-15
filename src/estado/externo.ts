// Ficheiros abertos a partir de fora da aplicação (ex.: duplo clique num ficheiro .ficha),
// à espera de serem tratados pela página certa.

let fichasPorImportar: { nome: string; conteudo: string }[] = [];
let fichaPorPreencher: string | null = null;

export function guardarFichasPorImportar(f: { nome: string; conteudo: string }) {
  fichasPorImportar.push(f);
}

export function retirarFichasPorImportar() {
  const r = fichasPorImportar;
  fichasPorImportar = [];
  return r;
}

export function guardarFichaPorPreencher(conteudo: string) {
  fichaPorPreencher = conteudo;
}

export function retirarFichaPorPreencher() {
  const r = fichaPorPreencher;
  fichaPorPreencher = null;
  return r;
}
