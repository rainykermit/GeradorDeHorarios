// Ficha de disponibilidade para cada docente preencher e enviar ao responsável pelos horários.

import { useEffect, useState } from 'preact/hooks';
import { AreaTexto, Botao, Campo, Nota, Texto, notificar } from '../comum';
import { GrelhaDisponibilidade } from '../GrelhaDisponibilidade';
import { Icone } from '../icones';
import { irPara } from '../navegacao';
import { obterProjeto } from '../../estado/store';
import type { FichaDocente as Ficha } from '../../model/tipos';
import { fichaModelo, lerFicha } from '../../model/fichas';
import { FILTRO_FICHA, abrirFicheiros, guardarFicheiro } from '../../estado/persistencia';
import { nomeFicheiroSeguro } from '../acoesFicheiro';
import { retirarFichaPorPreencher } from '../../estado/externo';

const CHAVE = 'gerador-de-horarios:ficha';

function fichaInicial(): Ficha {
  const recebida = retirarFichaPorPreencher();
  if (recebida) {
    try {
      return lerFicha(recebida);
    } catch {
      /* ignorar */
    }
  }
  try {
    const txt = localStorage.getItem(CHAVE);
    if (txt) return lerFicha(txt);
  } catch {
    /* ignorar */
  }
  const p = obterProjeto();
  return fichaModelo(p.config.tempos.length ? p : null);
}

export function FichaDocente() {
  const [f, setF] = useState<Ficha>(fichaInicial);
  const mudar = (parcial: Partial<Ficha>) => setF((x) => ({ ...x, ...parcial }));

  useEffect(() => {
    const recebida = () => {
      const txt = retirarFichaPorPreencher();
      if (!txt) return;
      try {
        setF(lerFicha(txt));
        notificar('Ficha aberta. Marque agora as suas indisponibilidades.');
      } catch (e) {
        notificar((e as Error).message, 'erro', 7000);
      }
    };
    window.addEventListener('gdh-ficha-recebida', recebida);
    return () => window.removeEventListener('gdh-ficha-recebida', recebida);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(f));
    } catch {
      /* ignorar */
    }
  }, [f]);

  const abrir = async () => {
    const [ficheiro] = await abrirFicheiros(['.ficha', '.json']);
    if (!ficheiro) return;
    try {
      const lida = lerFicha(ficheiro.conteudo);
      setF({ ...lida, nome: lida.nome || f.nome, email: lida.email || f.email, sigla: lida.sigla || f.sigla });
      notificar('Ficha aberta. Marque agora as suas indisponibilidades.');
    } catch (e) {
      notificar((e as Error).message, 'erro', 7000);
    }
  };

  const guardar = async () => {
    if (!f.nome.trim()) {
      notificar('Escreva o seu nome antes de guardar a ficha.', 'aviso');
      return;
    }
    const ok = await guardarFicheiro(
      nomeFicheiroSeguro(`Disponibilidade - ${f.nome.trim()}.ficha`),
      JSON.stringify({ ...f, criadaEm: new Date().toISOString() }, null, 1),
      'application/json',
      FILTRO_FICHA,
    );
    if (ok) notificar('Ficha guardada. Envie agora o ficheiro por e-mail ao responsável pelos horários.', 'sucesso', 7000);
  };

  return (
    <div class="conteudo" style={{ height: '100%', background: 'var(--fundo)' }}>
      <div class="pagina" style={{ margin: '0 auto', maxWidth: '980px' }}>
        <div class="linha mb">
          <Botao variante="fantasma" icone="setaEsq" onClick={() => irPara('inicio')}>
            Voltar
          </Botao>
        </div>
        <div class="cabecalho-pagina">
          <div class="textos">
            <div class="passo">Para docentes</div>
            <h1>Ficha de disponibilidade</h1>
            <p>Indique os tempos em que não pode ter aulas. No fim, guarde a ficha e envie o ficheiro por e-mail ao responsável pelos horários da escola.</p>
          </div>
          <div class="acoes">
            <Botao icone="abrir" onClick={abrir}>
              Abrir ficha recebida
            </Botao>
          </div>
        </div>

        <div class="coluna">
          <div class="cartao cartao-corpo">
            <h2>
              <span class="etiqueta azul">1</span> Os seus dados
            </h2>
            <div class="grelha-campos">
              <Campo rotulo="Nome completo">
                <Texto valor={f.nome} autoFocus={!f.nome} placeholder="Ex.: Ana Maria Silva" aoMudar={(v) => mudar({ nome: v })} />
              </Campo>
              <Campo rotulo="Sigla (opcional)">
                <Texto valor={f.sigla} maxLength={8} aoMudar={(v) => mudar({ sigla: v.toUpperCase() })} />
              </Campo>
              <Campo rotulo="E-mail (opcional)">
                <Texto valor={f.email} aoMudar={(v) => mudar({ email: v })} />
              </Campo>
              <Campo rotulo="Escola">
                <Texto valor={f.escola} aoMudar={(v) => mudar({ escola: v })} />
              </Campo>
            </div>
          </div>

          <div class="cartao cartao-corpo">
            <h2>
              <span class="etiqueta azul">2</span> Marque a sua disponibilidade
            </h2>
            <p class="texto-secundario" style={{ marginTop: 0 }}>
              <strong>Indisponível</strong> (vermelho): não pode mesmo ter aulas. <strong>Evitar se possível</strong> (amarelo): prefere não ter aulas, mas pode.
            </p>
            <GrelhaDisponibilidade dias={f.dias} tempos={f.tempos} valor={f.indisp} aoMudar={(g) => mudar({ indisp: g })} />
            <Campo rotulo="Observações (opcional)" classe="mt">
              <AreaTexto valor={f.notas} linhas={3} placeholder="Ex.: acompanhamento de familiar às terças de manhã" aoMudar={(v) => mudar({ notas: v })} />
            </Campo>
          </div>

          <div class="cartao cartao-corpo">
            <h2>
              <span class="etiqueta azul">3</span> Guardar e enviar
            </h2>
            <div class="linha">
              <Botao variante="primario" grande icone="guardar" onClick={guardar}>
                Guardar ficha preenchida
              </Botao>
              <span class="texto-secundario">Depois, anexe o ficheiro a um e-mail para o responsável pelos horários.</span>
            </div>
            <Nota tipo="info" classe="mt">
              <Icone nome="info" tamanho={1} /> O que escrever aqui fica guardado neste computador até guardar a ficha. Nada é enviado pela Internet.
            </Nota>
          </div>
        </div>
      </div>
    </div>
  );
}
