import { render } from 'preact';
import './styles.css';
import { App } from './ui/App';
import { carregarLocal } from './estado/persistencia';
import { normalizarProjeto } from './estado/migracao';
import { substituirProjeto } from './estado/store';

declare global {
  const __VERSAO__: string;
  const __REPOSITORIO__: string;
}

async function arrancar() {
  try {
    const bruto = await carregarLocal();
    if (bruto) substituirProjeto(normalizarProjeto(bruto), { gravar: false });
  } catch (e) {
    console.error('Não foi possível recuperar o trabalho guardado:', e);
  }
  render(<App />, document.getElementById('app')!);
}

arrancar();
