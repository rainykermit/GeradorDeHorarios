import type { Aula, Disciplina, Professor, Projeto, Regras, Sala, Turma } from '../model/tipos';
import { VERSAO_FORMATO, configPadrao, novoProjeto, regrasPadrao } from '../model/padrao';
import { novoId } from '../model/util';

export class ErroFicheiro extends Error {}

const texto = (v: unknown, padrao = '') => (typeof v === 'string' ? v : padrao);
const numero = (v: unknown, padrao: number) => (typeof v === 'number' && Number.isFinite(v) ? v : padrao);
const numOuNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
const lista = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const grelha = (v: unknown) => {
  const res: Record<string, 'indisponivel' | 'evitar'> = {};
  if (v && typeof v === 'object')
    for (const [k, e] of Object.entries(v)) if (e === 'indisponivel' || e === 'evitar') res[k] = e;
  return res;
};

/** Valida e completa um projeto lido de um ficheiro ou do armazenamento local. */
export function normalizarProjeto(bruto: unknown): Projeto {
  if (!bruto || typeof bruto !== 'object') throw new ErroFicheiro('O ficheiro não contém um horário válido.');
  const o = bruto as Record<string, any>;
  if (o.formato !== 'gerador-de-horarios')
    throw new ErroFicheiro('Este ficheiro não foi criado pelo Gerador de Horários.');
  if (numero(o.versao, 1) > VERSAO_FORMATO)
    throw new ErroFicheiro('Este ficheiro foi criado por uma versão mais recente da aplicação. Atualize a aplicação para o abrir.');

  const base = novoProjeto();
  const cfg = { ...configPadrao(), ...(o.config ?? {}) };
  cfg.dias = lista(cfg.dias).filter((d) => Number.isInteger(d) && d >= 0 && d <= 5);
  cfg.tempos = lista(cfg.tempos)
    .filter((t) => t && typeof t.inicio === 'string' && typeof t.fim === 'string')
    .map((t) => ({ id: texto(t.id) || novoId('t'), inicio: t.inicio, fim: t.fim }));
  const cfgPadrao = configPadrao();
  cfg.almocoInicio = texto(cfg.almocoInicio, cfgPadrao.almocoInicio);
  cfg.almocoFim = texto(cfg.almocoFim, cfgPadrao.almocoFim);
  cfg.inicioTarde = texto(cfg.inicioTarde, cfgPadrao.inicioTarde);
  cfg.intervaloMaxBloco = Math.max(0, numero(cfg.intervaloMaxBloco, cfgPadrao.intervaloMaxBloco));
  cfg.atribuirSalasNormais = cfg.atribuirSalasNormais === true;
  cfg.tipoSalaNormal = texto(cfg.tipoSalaNormal, cfgPadrao.tipoSalaNormal);

  // Regras: valores fora do intervalo (ficheiro danificado ou editado à mão) voltam aos valores de origem.
  const regras: Regras = regrasPadrao();
  const regrasFicheiro = (o.regras && typeof o.regras === 'object' ? o.regras : {}) as Record<string, unknown>;
  for (const k of Object.keys(regras) as (keyof Regras)[]) {
    const v = regrasFicheiro[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    (regras as unknown as Record<string, number>)[k] = k.startsWith('max') ? Math.max(0, Math.floor(v)) : Math.min(3, Math.max(0, Math.round(v)));
  }

  const disciplinas: Disciplina[] = lista(o.disciplinas).map((d) => ({
    id: texto(d.id) || novoId('d'),
    nome: texto(d.nome),
    sigla: texto(d.sigla),
    cor: texto(d.cor, '#5a6fd6'),
    tipoSala: texto(d.tipoSala),
    maxPorDia: Math.max(1, numero(d.maxPorDia, 1)),
    indisp: grelha(d.indisp),
  }));
  const professores: Professor[] = lista(o.professores).map((p) => ({
    id: texto(p.id) || novoId('p'),
    nome: texto(p.nome),
    sigla: texto(p.sigla),
    grupo: texto(p.grupo),
    email: texto(p.email),
    maxTemposDia: numOuNull(p.maxTemposDia),
    maxConsecutivos: numOuNull(p.maxConsecutivos),
    indisp: grelha(p.indisp),
    notas: texto(p.notas),
  }));
  const turmas: Turma[] = lista(o.turmas).map((t) => ({
    id: texto(t.id) || novoId('tu'),
    nome: texto(t.nome),
    ano: texto(t.ano),
    dtId: texto(t.dtId) || null,
    salaId: texto(t.salaId) || null,
    maxTemposDia: numOuNull(t.maxTemposDia),
    indisp: grelha(t.indisp),
    notas: texto(t.notas),
  }));
  const salas: Sala[] = lista(o.salas).map((s) => ({
    id: texto(s.id) || novoId('s'),
    nome: texto(s.nome),
    tipo: texto(s.tipo),
    capacidade: Math.max(1, numero(s.capacidade, 1)),
    indisp: grelha(s.indisp),
  }));
  const aulas: Aula[] = lista(o.aulas).map((a) => ({
    id: texto(a.id) || novoId('a'),
    disciplinaId: texto(a.disciplinaId),
    professorIds: lista(a.professorIds).filter((x) => typeof x === 'string'),
    turmaIds: lista(a.turmaIds).filter((x) => typeof x === 'string'),
    turno: texto(a.turno),
    distribuicao: lista(a.distribuicao).filter((n) => Number.isInteger(n) && n > 0),
    modoSala: a.modoSala === 'fixa' || a.modoSala === 'nenhuma' ? a.modoSala : 'auto',
    salaId: texto(a.salaId) || null,
    simultaneo: texto(a.simultaneo),
    notas: texto(a.notas),
  }));

  const horario = o.horario && typeof o.horario === 'object' ? o.horario : {};
  return {
    ...base,
    escola: texto(o.escola),
    agrupamento: texto(o.agrupamento),
    anoLetivo: texto(o.anoLetivo, base.anoLetivo),
    config: cfg,
    regras,
    bloqueios: grelha(o.bloqueios),
    disciplinas,
    professores,
    turmas,
    salas,
    aulas,
    horario: {
      colocacoes: lista(horario.colocacoes)
        .filter((c) => c && typeof c.aulaId === 'string' && typeof c.tempoId === 'string')
        .map((c) => ({
          aulaId: c.aulaId,
          indice: numero(c.indice, 0),
          dia: numero(c.dia, 0),
          tempoId: c.tempoId,
          salaId: texto(c.salaId) || null,
          fixa: !!c.fixa,
        })),
      resumo: horario.resumo ?? null,
    },
    atualizadoEm: texto(o.atualizadoEm, base.atualizadoEm),
  };
}
