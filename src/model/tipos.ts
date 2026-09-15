// Modelo de dados do Gerador de Horários.
// Tudo o que o utilizador introduz fica num único objeto `Projeto`,
// que é guardado automaticamente e pode ser gravado num ficheiro .horario.

export type ID = string;

/** Estado de um tempo numa grelha de disponibilidade. Ausente = disponível. */
export type EstadoTempo = 'indisponivel' | 'evitar';

/** Grelha de disponibilidade. Chave: `${dia}|${tempoId}` (dia: 0 = Segunda … 5 = Sábado). */
export type Grelha = Record<string, EstadoTempo>;

export interface Tempo {
  id: ID;
  inicio: string; // "08:15"
  fim: string; // "09:05"
}

export interface Disciplina {
  id: ID;
  nome: string;
  sigla: string;
  cor: string; // #rrggbb
  /** Tipo de sala exigido ('' = sem exigência). */
  tipoSala: string;
  /** Máximo de aulas desta disciplina por dia na mesma turma. */
  maxPorDia: number;
  indisp: Grelha;
}

export interface Professor {
  id: ID;
  nome: string;
  sigla: string;
  grupo: string; // grupo de recrutamento (opcional), ex.: "300"
  email: string;
  /** Máximo de tempos por dia (vazio = usar o valor geral). */
  maxTemposDia: number | null;
  /** Máximo de tempos seguidos (vazio = usar o valor geral). */
  maxConsecutivos: number | null;
  indisp: Grelha;
  notas: string;
}

export interface Turma {
  id: ID;
  nome: string; // "7.º A"
  ano: string; // "7"
  dtId: ID | null; // diretor(a) de turma
  salaId: ID | null; // sala habitual
  maxTemposDia: number | null;
  indisp: Grelha;
  notas: string;
}

export interface Sala {
  id: ID;
  nome: string;
  tipo: string;
  /** Número de turmas que podem ter aula em simultâneo neste espaço (ex.: pavilhão = 3). */
  capacidade: number;
  indisp: Grelha;
}

export type ModoSala = 'auto' | 'fixa' | 'nenhuma';

export interface Aula {
  id: ID;
  disciplinaId: ID;
  professorIds: ID[];
  turmaIds: ID[];
  /** '' = turma completa; caso contrário, nome do turno/grupo (ex.: "Turno 1"). */
  turno: string;
  /** Duração de cada aula semanal em tempos. Ex.: [2, 1] = um bloco de 2 tempos + 1 tempo. */
  distribuicao: number[];
  modoSala: ModoSala;
  salaId: ID | null;
  /** Aulas com o mesmo nome de grupo decorrem sempre à mesma hora. */
  simultaneo: string;
  notas: string;
}

/** 0 = desligada, 1 = pouco importante, 2 = importante, 3 = muito importante */
export type Nivel = 0 | 1 | 2 | 3;

export interface Regras {
  furosTurmas: Nivel;
  furosProfessores: Nivel;
  mesmaDisciplinaMesmoDia: Nivel;
  almocoTurmas: Nivel;
  almocoProfessores: Nivel;
  preferencias: Nivel;
  tardesTurmas: Nivel;
  consecutivosProfessores: Nivel;
  diasProfessores: Nivel;
  turnosIsolados: Nivel;
  /** Máximo de tempos por dia de uma turma (regra obrigatória). */
  maxTemposDiaTurma: number;
  /** Máximo de tempos por dia de um docente (regra obrigatória). */
  maxTemposDiaProfessor: number;
  /** Máximo de tempos seguidos de um docente antes de ser penalizado. */
  maxConsecutivosProfessor: number;
}

export interface Configuracao {
  /** Dias com aulas (0 = Segunda … 5 = Sábado). */
  dias: number[];
  tempos: Tempo[];
  /** Janela onde deve existir pelo menos um tempo livre para almoço. */
  almocoInicio: string;
  almocoFim: string;
  /** Tempos que começam a partir desta hora contam como "tarde". */
  inicioTarde: string;
  /** Um bloco de vários tempos pode atravessar intervalos até este número de minutos. */
  intervaloMaxBloco: number;
  /** Atribuir automaticamente salas do tipo "normal" a aulas sem sala. */
  atribuirSalasNormais: boolean;
  tipoSalaNormal: string;
}

export interface Colocacao {
  aulaId: ID;
  /** Índice da aula dentro da distribuição (0 = primeira aula da semana). */
  indice: number;
  dia: number;
  tempoId: ID;
  salaId: ID | null;
  fixa: boolean;
}

export interface ResumoGeracao {
  data: string;
  segundos: number;
  totalAulas: number;
  colocadas: number;
}

export interface Horario {
  colocacoes: Colocacao[];
  resumo: ResumoGeracao | null;
}

export interface Projeto {
  formato: 'gerador-de-horarios';
  versao: number;
  escola: string;
  agrupamento: string;
  anoLetivo: string;
  config: Configuracao;
  regras: Regras;
  bloqueios: Grelha;
  disciplinas: Disciplina[];
  professores: Professor[];
  turmas: Turma[];
  salas: Sala[];
  aulas: Aula[];
  horario: Horario;
  atualizadoEm: string;
}

/** Ficha de disponibilidade preenchida por um docente e enviada ao responsável pelos horários. */
export interface FichaDocente {
  formato: 'gerador-de-horarios-ficha';
  versao: number;
  nome: string;
  sigla: string;
  email: string;
  escola: string;
  dias: number[];
  tempos: Tempo[];
  indisp: Grelha;
  notas: string;
  criadaEm: string;
}

export const NOMES_DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const NOMES_DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const chaveGrelha = (dia: number, tempoId: ID) => `${dia}|${tempoId}`;
