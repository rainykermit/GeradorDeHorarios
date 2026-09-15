// Importar listas copiadas do Excel (ou de outra folha de cálculo) e coladas na aplicação.

import { useMemo, useState } from 'preact/hooks';
import { Botao, Caixa, Modal, Nota, notificar } from './comum';
import { atualizar, useProjeto } from '../estado/store';
import type { Aula, Disciplina, Professor, Projeto, Sala, Turma } from '../model/tipos';
import { DISCIPLINAS_HABITUAIS, novaDisciplina } from '../model/padrao';
import { novaAula } from '../model/operacoes';
import { PALETA, lerDistribuicao, novoId, normalizar, siglaDeNome } from '../model/util';

export type TipoImportacao = 'professores' | 'turmas' | 'salas' | 'disciplinas' | 'aulas';

const COLUNAS: Record<TipoImportacao, { titulo: string; colunas: string[]; exemplo: string }> = {
  professores: { titulo: 'docentes', colunas: ['Nome', 'Sigla (opcional)', 'Grupo de recrutamento (opcional)', 'E-mail (opcional)'], exemplo: 'Ana Maria Silva\tAMS\t300\tana.silva@escola.pt' },
  turmas: { titulo: 'turmas', colunas: ['Nome', 'Ano (opcional)', 'Diretor(a) de turma (opcional)', 'Sala habitual (opcional)'], exemplo: '7.º A\t7\tAna Maria Silva\tSala 12' },
  salas: { titulo: 'salas', colunas: ['Nome', 'Tipo (opcional)', 'Turmas em simultâneo (opcional)'], exemplo: 'Laboratório 1\tLaboratório\t1' },
  disciplinas: { titulo: 'disciplinas', colunas: ['Nome', 'Sigla (opcional)', 'Tipo de sala (opcional)'], exemplo: 'Físico-Química\tFQ\tLaboratório' },
  aulas: {
    titulo: 'aulas (distribuição de serviço)',
    colunas: ['Turma(s)', 'Disciplina', 'Docente(s)', 'Tempos por semana (ex.: 4 ou 2+1)', 'Turno (opcional)'],
    exemplo: '7.º A\tMatemática\tAna Maria Silva\t4',
  },
};

const PALAVRAS_TITULO = ['nome', 'turma', 'turmas', 'disciplina', 'docente', 'professor', 'sala', 'sigla', 'tipo', 'ano'];

function lerTabela(texto: string): string[][] {
  const linhas = texto.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (!linhas.length) return [];
  const sep = linhas.some((l) => l.includes('\t')) ? '\t' : linhas.some((l) => l.includes(';')) ? ';' : ',';
  return linhas.map((l) => l.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, '$1')));
}

const separarLista = (txt: string) =>
  (txt || '')
    .split(/\s*[\/,;+&]\s*|\s+e\s+/)
    .map((x) => x.trim())
    .filter(Boolean);

interface Linha {
  celulas: string[];
  estado: 'novo' | 'existe' | 'erro';
  mensagem: string;
}

function procurar<T extends { nome: string; sigla?: string }>(lista: T[], texto: string): T | undefined {
  const n = normalizar(texto);
  if (!n) return undefined;
  return lista.find((x) => normalizar(x.nome) === n) ?? lista.find((x) => x.sigla && normalizar(x.sigla) === n);
}

function analisar(tipo: TipoImportacao, linhas: string[][], p: Projeto, criar: boolean): Linha[] {
  return linhas.map((c) => {
    const nome = c[0] ?? '';
    switch (tipo) {
      case 'professores':
        if (!nome) return { celulas: c, estado: 'erro', mensagem: 'Sem nome' };
        return procurar(p.professores, nome) ? { celulas: c, estado: 'existe', mensagem: 'Já existe (ignorado)' } : { celulas: c, estado: 'novo', mensagem: 'Novo docente' };
      case 'turmas':
        if (!nome) return { celulas: c, estado: 'erro', mensagem: 'Sem nome' };
        return p.turmas.some((t) => normalizar(t.nome) === normalizar(nome)) ? { celulas: c, estado: 'existe', mensagem: 'Já existe (ignorada)' } : { celulas: c, estado: 'novo', mensagem: 'Nova turma' };
      case 'salas':
        if (!nome) return { celulas: c, estado: 'erro', mensagem: 'Sem nome' };
        return p.salas.some((s) => normalizar(s.nome) === normalizar(nome)) ? { celulas: c, estado: 'existe', mensagem: 'Já existe (ignorada)' } : { celulas: c, estado: 'novo', mensagem: 'Nova sala' };
      case 'disciplinas':
        if (!nome) return { celulas: c, estado: 'erro', mensagem: 'Sem nome' };
        return procurar(p.disciplinas, nome) ? { celulas: c, estado: 'existe', mensagem: 'Já existe (ignorada)' } : { celulas: c, estado: 'novo', mensagem: 'Nova disciplina' };
      case 'aulas': {
        const [turmasTxt, discTxt, profsTxt, temposTxt] = c;
        if (!discTxt) return { celulas: c, estado: 'erro', mensagem: 'Falta a disciplina' };
        const dist = distribuicaoImportada(temposTxt ?? '');
        if (!dist) return { celulas: c, estado: 'erro', mensagem: 'Tempos inválidos' };
        const faltam: string[] = [];
        if (!procurar(p.disciplinas, discTxt)) faltam.push(`disciplina «${discTxt}»`);
        for (const t of separarLista(turmasTxt)) if (!p.turmas.some((x) => normalizar(x.nome) === normalizar(t))) faltam.push(`turma «${t}»`);
        for (const d of separarLista(profsTxt)) if (!procurar(p.professores, d)) faltam.push(`docente «${d}»`);
        if (faltam.length && !criar) return { celulas: c, estado: 'erro', mensagem: `Não encontrado: ${faltam.join(', ')}` };
        return { celulas: c, estado: 'novo', mensagem: faltam.length ? `Nova aula (cria ${faltam.join(', ')})` : 'Nova aula' };
      }
    }
  });
}

/** "4" → [1,1,1,1]; "2+1" → [2,1]. */
export function distribuicaoImportada(txt: string): number[] | null {
  const t = (txt || '').trim();
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    return n >= 1 && n <= 20 ? Array(n).fill(1) : null;
  }
  return lerDistribuicao(t);
}

export function ImportarColar({ tipo, aoFechar }: { tipo: TipoImportacao; aoFechar: () => void }) {
  const p = useProjeto();
  const [texto, setTexto] = useState('');
  const [criar, setCriar] = useState(true);
  const def = COLUNAS[tipo];

  const tabela = useMemo(() => {
    const t = lerTabela(texto);
    if (t.length && PALAVRAS_TITULO.includes(normalizar(t[0][0]).replace(/\(.*\)/, '').trim())) return t.slice(1);
    return t;
  }, [texto]);
  const linhas = useMemo(() => analisar(tipo, tabela, p, criar), [tabela, p, criar, tipo]);
  const novas = linhas.filter((l) => l.estado === 'novo');

  const importar = () => {
    atualizar((d) => {
      const coresUsadas = d.disciplinas.length;
      const obterDisciplina = (txt: string): Disciplina => {
        let disc = procurar(d.disciplinas, txt);
        if (!disc) {
          const hab = DISCIPLINAS_HABITUAIS.find((h) => normalizar(h.nome) === normalizar(txt) || normalizar(h.sigla) === normalizar(txt));
          disc = novaDisciplina(
            hab
              ? { nome: hab.nome, sigla: hab.sigla, cor: hab.cor, tipoSala: hab.tipoSala }
              : { nome: txt, sigla: siglaDeNome(txt), cor: PALETA[(coresUsadas + d.disciplinas.length) % PALETA.length] },
          );
          d.disciplinas.push(disc);
        }
        return disc;
      };
      const obterProfessor = (txt: string): Professor => {
        let prof = procurar(d.professores, txt);
        if (!prof) {
          prof = { id: novoId('p'), nome: txt, sigla: siglaDeNome(txt), grupo: '', email: '', maxTemposDia: null, maxConsecutivos: null, indisp: {}, notas: '' };
          d.professores.push(prof);
        }
        return prof;
      };
      const obterTurma = (txt: string): Turma => {
        let turma = d.turmas.find((x) => normalizar(x.nome) === normalizar(txt));
        if (!turma) {
          const ano = /(\d+)/.exec(txt)?.[1] ?? '';
          turma = { id: novoId('tu'), nome: txt, ano, dtId: null, salaId: null, maxTemposDia: null, indisp: {}, notas: '' };
          d.turmas.push(turma);
        }
        return turma;
      };

      for (const l of linhas) {
        if (l.estado !== 'novo') continue;
        const c = l.celulas;
        if (tipo === 'professores') {
          d.professores.push({ id: novoId('p'), nome: c[0], sigla: c[1] || siglaDeNome(c[0]), grupo: c[2] ?? '', email: c[3] ?? '', maxTemposDia: null, maxConsecutivos: null, indisp: {}, notas: '' });
        } else if (tipo === 'salas') {
          const s: Sala = { id: novoId('s'), nome: c[0], tipo: c[1] || 'Sala de aula', capacidade: Math.max(1, Number(c[2]) || 1), indisp: {} };
          d.salas.push(s);
        } else if (tipo === 'disciplinas') {
          const hab = DISCIPLINAS_HABITUAIS.find((h) => normalizar(h.nome) === normalizar(c[0]));
          d.disciplinas.push(
            novaDisciplina({
              nome: c[0],
              sigla: c[1] || hab?.sigla || siglaDeNome(c[0]),
              tipoSala: c[2] ?? hab?.tipoSala ?? '',
              cor: hab?.cor ?? PALETA[d.disciplinas.length % PALETA.length],
            }),
          );
        } else if (tipo === 'turmas') {
          const turma = obterTurma(c[0]);
          if (c[1]) turma.ano = c[1].replace(/\D/g, '') || c[1];
          if (c[2]) turma.dtId = obterProfessor(c[2]).id;
          if (c[3]) {
            let sala = d.salas.find((s) => normalizar(s.nome) === normalizar(c[3]));
            if (!sala) {
              sala = { id: novoId('s'), nome: c[3], tipo: 'Sala de aula', capacidade: 1, indisp: {} };
              d.salas.push(sala);
            }
            turma.salaId = sala.id;
          }
        } else if (tipo === 'aulas') {
          const disc = obterDisciplina(c[1]);
          const aula: Aula = novaAula({
            disciplinaId: disc.id,
            turmaIds: separarLista(c[0]).map((t) => obterTurma(t).id),
            professorIds: separarLista(c[2]).map((x) => obterProfessor(x).id),
            distribuicao: distribuicaoImportada(c[3])!,
            turno: c[4] ?? '',
          });
          d.aulas.push(aula);
        }
      }
    });
    notificar(`${novas.length} ${def.titulo} importados.`);
    aoFechar();
  };

  return (
    <Modal
      titulo={`Colar ${def.titulo} a partir do Excel`}
      tamanho="grande"
      aoFechar={aoFechar}
      rodape={
        <>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" disabled={novas.length === 0} onClick={importar}>
            Importar {novas.length}
          </Botao>
        </>
      }
    >
      <Nota tipo="info">
        No Excel, selecione as linhas com as colunas pela ordem abaixo, copie (<span class="kbd">Ctrl</span>+<span class="kbd">C</span>) e cole aqui (
        <span class="kbd">Ctrl</span>+<span class="kbd">V</span>).
        <div style={{ marginTop: '6px' }}>
          <strong>Colunas:</strong> {def.colunas.map((col, i) => `${i + 1}) ${col}`).join('   ')}
        </div>
      </Nota>
      <textarea
        class="entrada mt"
        rows={7}
        style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '13px' }}
        placeholder={`Cole aqui. Exemplo:\n${def.exemplo.replace(/\t/g, '    ')}`}
        value={texto}
        onInput={(e) => setTexto((e.target as HTMLTextAreaElement).value)}
      />
      {tipo === 'aulas' && (
        <div class="mt">
          <Caixa marcado={criar} aoMudar={setCriar}>
            Criar automaticamente as turmas, disciplinas e docentes que ainda não existam
          </Caixa>
        </div>
      )}
      {linhas.length > 0 && (
        <div class="tabela-envolvente mt" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--borda)', borderRadius: '8px' }}>
          <table class="tabela">
            <thead>
              <tr>
                {def.colunas.map((c) => (
                  <th key={c}>{c.replace(/ \(.*\)/, '')}</th>
                ))}
                <th>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i}>
                  {def.colunas.map((_, j) => (
                    <td key={j}>{l.celulas[j] ?? ''}</td>
                  ))}
                  <td>
                    <span class={`etiqueta ${l.estado === 'novo' ? 'verde' : l.estado === 'erro' ? 'vermelha' : ''}`}>{l.mensagem}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
