import type { Configuracao, Disciplina, Projeto, Regras, Tempo } from './tipos';
import { deMinutos, novoId, paraMinutos } from './util';

export const VERSAO_FORMATO = 1;

export const TIPOS_SALA_HABITUAIS = [
  'Sala de aula',
  'Laboratório',
  'Sala de informática',
  'Pavilhão / Ginásio',
  'Sala de Educação Visual',
  'Oficina de Educação Tecnológica',
  'Sala de Música',
  'Biblioteca',
];

export function regrasPadrao(): Regras {
  return {
    furosTurmas: 3,
    furosProfessores: 2,
    mesmaDisciplinaMesmoDia: 3,
    almocoTurmas: 3,
    almocoProfessores: 2,
    preferencias: 2,
    tardesTurmas: 1,
    consecutivosProfessores: 1,
    diasProfessores: 0,
    turnosIsolados: 1,
    maxTemposDiaTurma: 8,
    maxTemposDiaProfessor: 8,
    maxConsecutivosProfessor: 5,
  };
}

/** Grelha típica de uma escola básica 2,3 com tempos de 50 minutos. */
export function temposPadrao(): Tempo[] {
  const horas: [string, string][] = [
    ['08:15', '09:05'],
    ['09:05', '09:55'],
    ['10:10', '11:00'],
    ['11:00', '11:50'],
    ['12:00', '12:50'],
    ['12:50', '13:40'],
    ['13:40', '14:30'],
    ['14:40', '15:30'],
    ['15:30', '16:20'],
    ['16:30', '17:20'],
  ];
  return horas.map(([inicio, fim]) => ({ id: novoId('t'), inicio, fim }));
}

export interface ParametrosTempos {
  inicio: string;
  duracao: number;
  temposManha: number;
  temposTarde: number;
  inicioTarde: string;
  /** Intervalo (minutos) depois de cada tempo, por ordem. Último valor repete-se. */
  intervalos: number[];
}

export function gerarTempos(p: ParametrosTempos): Tempo[] {
  const res: Tempo[] = [];
  let atual = paraMinutos(p.inicio);
  for (let i = 0; i < p.temposManha; i++) {
    res.push({ id: novoId('t'), inicio: deMinutos(atual), fim: deMinutos(atual + p.duracao) });
    atual += p.duracao + (p.intervalos[i] ?? p.intervalos[p.intervalos.length - 1] ?? 0);
  }
  atual = paraMinutos(p.inicioTarde);
  for (let i = 0; i < p.temposTarde; i++) {
    res.push({ id: novoId('t'), inicio: deMinutos(atual), fim: deMinutos(atual + p.duracao) });
    atual += p.duracao + (p.intervalos[p.temposManha + i] ?? p.intervalos[p.intervalos.length - 1] ?? 0);
  }
  return res;
}

export function configPadrao(): Configuracao {
  return {
    dias: [0, 1, 2, 3, 4],
    tempos: temposPadrao(),
    almocoInicio: '12:50',
    almocoFim: '14:30',
    inicioTarde: '13:00',
    intervaloMaxBloco: 20,
    atribuirSalasNormais: false,
    tipoSalaNormal: 'Sala de aula',
  };
}

export function novoProjeto(): Projeto {
  const agora = new Date();
  const ano = agora.getMonth() >= 6 ? agora.getFullYear() : agora.getFullYear() - 1;
  return {
    formato: 'gerador-de-horarios',
    versao: VERSAO_FORMATO,
    escola: '',
    agrupamento: '',
    anoLetivo: `${ano}/${ano + 1}`,
    config: configPadrao(),
    regras: regrasPadrao(),
    bloqueios: {},
    disciplinas: [],
    professores: [],
    turmas: [],
    salas: [],
    aulas: [],
    horario: { colocacoes: [], resumo: null },
    atualizadoEm: agora.toISOString(),
  };
}

export interface DisciplinaHabitual {
  nome: string;
  sigla: string;
  cor: string;
  tipoSala: string;
  ciclos: ('2' | '3')[];
}

export const DISCIPLINAS_HABITUAIS: DisciplinaHabitual[] = [
  { nome: 'Português', sigla: 'PORT', cor: '#d64545', tipoSala: '', ciclos: ['2', '3'] },
  { nome: 'Inglês', sigla: 'ING', cor: '#3f6fd8', tipoSala: '', ciclos: ['2', '3'] },
  { nome: 'Francês', sigla: 'FRA', cor: '#6a5acd', tipoSala: '', ciclos: ['3'] },
  { nome: 'Espanhol', sigla: 'ESP', cor: '#c9832b', tipoSala: '', ciclos: ['3'] },
  { nome: 'História e Geografia de Portugal', sigla: 'HGP', cor: '#a0662f', tipoSala: '', ciclos: ['2'] },
  { nome: 'História', sigla: 'HIST', cor: '#a0662f', tipoSala: '', ciclos: ['3'] },
  { nome: 'Geografia', sigla: 'GEO', cor: '#3c9a5f', tipoSala: '', ciclos: ['3'] },
  { nome: 'Cidadania e Desenvolvimento', sigla: 'CD', cor: '#8a8f98', tipoSala: '', ciclos: ['2', '3'] },
  { nome: 'Matemática', sigla: 'MAT', cor: '#1f5fbf', tipoSala: '', ciclos: ['2', '3'] },
  { nome: 'Ciências Naturais', sigla: 'CN', cor: '#2e9e4f', tipoSala: '', ciclos: ['2', '3'] },
  { nome: 'Físico-Química', sigla: 'FQ', cor: '#0f8f9a', tipoSala: 'Laboratório', ciclos: ['3'] },
  { nome: 'Educação Visual', sigla: 'EV', cor: '#d9488f', tipoSala: 'Sala de Educação Visual', ciclos: ['2', '3'] },
  { nome: 'Educação Tecnológica', sigla: 'ET', cor: '#b5651d', tipoSala: 'Oficina de Educação Tecnológica', ciclos: ['2'] },
  { nome: 'Educação Musical', sigla: 'EM', cor: '#9b59b6', tipoSala: 'Sala de Música', ciclos: ['2'] },
  { nome: 'Tecnologias de Informação e Comunicação', sigla: 'TIC', cor: '#34495e', tipoSala: 'Sala de informática', ciclos: ['2', '3'] },
  { nome: 'Educação Física', sigla: 'EF', cor: '#e67e22', tipoSala: 'Pavilhão / Ginásio', ciclos: ['2', '3'] },
  { nome: 'Educação Moral e Religiosa Católica', sigla: 'EMRC', cor: '#c0a000', tipoSala: '', ciclos: ['2', '3'] },
  { nome: 'Apoio ao Estudo', sigla: 'AE', cor: '#7f8c8d', tipoSala: '', ciclos: ['2'] },
  { nome: 'Oferta Complementar', sigla: 'OC', cor: '#16a085', tipoSala: '', ciclos: ['2', '3'] },
];

export function novaDisciplina(parcial: Partial<Disciplina> = {}): Disciplina {
  return {
    id: novoId('d'),
    nome: '',
    sigla: '',
    cor: '#5a6fd6',
    tipoSala: '',
    maxPorDia: 1,
    indisp: {},
    ...parcial,
  };
}

/** Planos curriculares sugeridos (tempos de 50 min). São apenas um ponto de partida editável. */
export const PLANOS_CURRICULARES: Record<string, { sigla: string; distribuicao: number[] }[]> = {
  '5': [
    { sigla: 'PORT', distribuicao: [1, 1, 1, 1, 1] },
    { sigla: 'ING', distribuicao: [1, 1, 1] },
    { sigla: 'HGP', distribuicao: [1, 1] },
    { sigla: 'CD', distribuicao: [1] },
    { sigla: 'MAT', distribuicao: [1, 1, 1, 1, 1] },
    { sigla: 'CN', distribuicao: [1, 1, 1] },
    { sigla: 'EV', distribuicao: [2] },
    { sigla: 'ET', distribuicao: [2] },
    { sigla: 'EM', distribuicao: [1] },
    { sigla: 'TIC', distribuicao: [1] },
    { sigla: 'EF', distribuicao: [2, 1] },
    { sigla: 'EMRC', distribuicao: [1] },
  ],
  '6': [
    { sigla: 'PORT', distribuicao: [1, 1, 1, 1, 1] },
    { sigla: 'ING', distribuicao: [1, 1, 1] },
    { sigla: 'HGP', distribuicao: [1, 1, 1] },
    { sigla: 'CD', distribuicao: [1] },
    { sigla: 'MAT', distribuicao: [1, 1, 1, 1, 1] },
    { sigla: 'CN', distribuicao: [1, 1] },
    { sigla: 'EV', distribuicao: [2] },
    { sigla: 'ET', distribuicao: [2] },
    { sigla: 'EM', distribuicao: [1] },
    { sigla: 'TIC', distribuicao: [1] },
    { sigla: 'EF', distribuicao: [2, 1] },
    { sigla: 'EMRC', distribuicao: [1] },
  ],
  '7': [
    { sigla: 'PORT', distribuicao: [1, 1, 1, 1] },
    { sigla: 'ING', distribuicao: [1, 1, 1] },
    { sigla: 'FRA', distribuicao: [1, 1, 1] },
    { sigla: 'HIST', distribuicao: [1, 1] },
    { sigla: 'GEO', distribuicao: [1, 1] },
    { sigla: 'CD', distribuicao: [1] },
    { sigla: 'MAT', distribuicao: [1, 1, 1, 1] },
    { sigla: 'CN', distribuicao: [2, 1] },
    { sigla: 'FQ', distribuicao: [2, 1] },
    { sigla: 'EV', distribuicao: [2] },
    { sigla: 'TIC', distribuicao: [1] },
    { sigla: 'EF', distribuicao: [2, 1] },
    { sigla: 'EMRC', distribuicao: [1] },
  ],
  '8': [
    { sigla: 'PORT', distribuicao: [1, 1, 1, 1] },
    { sigla: 'ING', distribuicao: [1, 1, 1] },
    { sigla: 'FRA', distribuicao: [1, 1] },
    { sigla: 'HIST', distribuicao: [1, 1] },
    { sigla: 'GEO', distribuicao: [1, 1] },
    { sigla: 'CD', distribuicao: [1] },
    { sigla: 'MAT', distribuicao: [1, 1, 1, 1] },
    { sigla: 'CN', distribuicao: [2, 1] },
    { sigla: 'FQ', distribuicao: [2, 1] },
    { sigla: 'EV', distribuicao: [2] },
    { sigla: 'TIC', distribuicao: [1] },
    { sigla: 'EF', distribuicao: [2, 1] },
    { sigla: 'EMRC', distribuicao: [1] },
  ],
  '9': [
    { sigla: 'PORT', distribuicao: [1, 1, 1, 1, 1] },
    { sigla: 'ING', distribuicao: [1, 1, 1] },
    { sigla: 'FRA', distribuicao: [1, 1] },
    { sigla: 'HIST', distribuicao: [1, 1, 1] },
    { sigla: 'GEO', distribuicao: [1, 1] },
    { sigla: 'CD', distribuicao: [1] },
    { sigla: 'MAT', distribuicao: [1, 1, 1, 1, 1] },
    { sigla: 'CN', distribuicao: [2, 1] },
    { sigla: 'FQ', distribuicao: [2, 1] },
    { sigla: 'EV', distribuicao: [2] },
    { sigla: 'EF', distribuicao: [2, 1] },
    { sigla: 'EMRC', distribuicao: [1] },
  ],
};
