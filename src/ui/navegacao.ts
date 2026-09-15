import { useEffect, useState } from 'preact/hooks';
import type { Pagina } from '../model/validacao';

export interface Rota {
  pagina: Pagina | 'ficha';
  id?: string;
}

const PAGINAS = new Set(['inicio', 'escola', 'disciplinas', 'salas', 'professores', 'turmas', 'aulas', 'regras', 'gerar', 'horarios', 'ajuda', 'ficha']);

export function lerRota(): Rota {
  const partes = decodeURIComponent(location.hash.replace(/^#\/?/, '')).split('/');
  const pagina = PAGINAS.has(partes[0]) ? (partes[0] as Rota['pagina']) : 'inicio';
  return { pagina, id: partes[1] || undefined };
}

export function irPara(pagina: Rota['pagina'], id?: string) {
  const hash = `#/${pagina}${id ? '/' + encodeURIComponent(id) : ''}`;
  if (location.hash !== hash) location.hash = hash;
}

export function useRota(): Rota {
  const [rota, setRota] = useState(lerRota);
  useEffect(() => {
    const f = () => setRota(lerRota());
    window.addEventListener('hashchange', f);
    // Uma mudança de endereço entre o primeiro desenho e este momento não seria vista.
    f();
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return rota;
}
