// Escola de exemplo, com dados realistas, para experimentar a aplicação.

import type { Aula, Professor, Projeto, Sala, Turma } from './tipos';
import { chaveGrelha } from './tipos';
import { DISCIPLINAS_HABITUAIS, PLANOS_CURRICULARES, novaDisciplina, novoProjeto } from './padrao';
import { criarAleatorio } from '../motor/motor';
import { novoId, siglaDeNome } from './util';

const NOMES = [
  'Ana', 'Beatriz', 'Carla', 'Cristina', 'Daniela', 'Elsa', 'Fátima', 'Filipa', 'Helena', 'Inês', 'Isabel',
  'Joana', 'Lurdes', 'Manuela', 'Margarida', 'Marta', 'Patrícia', 'Paula', 'Rita', 'Sandra', 'Sofia', 'Teresa',
  'António', 'Bruno', 'Carlos', 'Diogo', 'Eduardo', 'Fernando', 'Hugo', 'João', 'Jorge', 'José', 'Luís',
  'Manuel', 'Miguel', 'Nuno', 'Paulo', 'Pedro', 'Ricardo', 'Rui', 'Sérgio', 'Tiago', 'Vítor',
];
const APELIDOS = [
  'Almeida', 'Alves', 'Antunes', 'Barbosa', 'Cardoso', 'Carvalho', 'Costa', 'Correia', 'Cunha', 'Dias',
  'Ferreira', 'Fonseca', 'Gomes', 'Gonçalves', 'Henriques', 'Lopes', 'Machado', 'Marques', 'Martins',
  'Mendes', 'Monteiro', 'Moreira', 'Nunes', 'Oliveira', 'Pereira', 'Pinto', 'Ramos', 'Reis', 'Ribeiro',
  'Rocha', 'Rodrigues', 'Santos', 'Silva', 'Sousa', 'Teixeira', 'Vieira',
];

/** Grupos de recrutamento e disciplinas que lecionam (por ciclo). */
const GRUPOS: { grupo: string; ciclo: '2' | '3' | '*'; siglas: string[] }[] = [
  { grupo: '200', ciclo: '2', siglas: ['PORT', 'HGP'] },
  { grupo: '220', ciclo: '2', siglas: ['ING', 'PORT'] },
  { grupo: '230', ciclo: '2', siglas: ['MAT', 'CN'] },
  { grupo: '240', ciclo: '2', siglas: ['EV', 'ET'] },
  { grupo: '250', ciclo: '2', siglas: ['EM'] },
  { grupo: '260', ciclo: '2', siglas: ['EF'] },
  { grupo: '290', ciclo: '*', siglas: ['EMRC'] },
  { grupo: '300', ciclo: '3', siglas: ['PORT'] },
  { grupo: '320', ciclo: '3', siglas: ['FRA'] },
  { grupo: '330', ciclo: '3', siglas: ['ING'] },
  { grupo: '350', ciclo: '3', siglas: ['ESP'] },
  { grupo: '400', ciclo: '3', siglas: ['HIST'] },
  { grupo: '420', ciclo: '3', siglas: ['GEO'] },
  { grupo: '500', ciclo: '3', siglas: ['MAT'] },
  { grupo: '510', ciclo: '3', siglas: ['FQ'] },
  { grupo: '520', ciclo: '3', siglas: ['CN'] },
  { grupo: '550', ciclo: '*', siglas: ['TIC'] },
  { grupo: '600', ciclo: '3', siglas: ['EV'] },
  { grupo: '620', ciclo: '3', siglas: ['EF'] },
];

const CARGA_MAXIMA = 22;

export function criarExemplo(opcoes: { turmasPorAno?: number; semente?: number } = {}): Projeto {
  const turmasPorAno = opcoes.turmasPorAno ?? 4;
  const rnd = criarAleatorio(opcoes.semente ?? 2026);
  const escolher = <T,>(lista: T[]) => lista[Math.floor(rnd() * lista.length)];

  const p = novoProjeto();
  p.escola = 'Escola Básica de Exemplo';
  p.agrupamento = 'Agrupamento de Escolas de Exemplo';
  const tempos = p.config.tempos;
  const dias = p.config.dias;

  // Reuniões à quarta-feira à tarde (a partir das 14:40)
  for (const tp of tempos.slice(7)) p.bloqueios[chaveGrelha(2, tp.id)] = 'indisponivel';

  // Disciplinas
  const siglasUsadas = new Set(['PORT', 'ING', 'FRA', 'ESP', 'HGP', 'HIST', 'GEO', 'CD', 'MAT', 'CN', 'FQ', 'EV', 'ET', 'EM', 'TIC', 'EF', 'EMRC']);
  p.disciplinas = DISCIPLINAS_HABITUAIS.filter((d) => siglasUsadas.has(d.sigla)).map((d) =>
    novaDisciplina({ nome: d.nome, sigla: d.sigla, cor: d.cor, tipoSala: d.tipoSala }),
  );
  const atendimento = novaDisciplina({ nome: 'Atendimento aos Encarregados de Educação', sigla: 'AtEE', cor: '#6b7785' });
  p.disciplinas.push(atendimento);
  const disc = (sigla: string) => p.disciplinas.find((d) => d.sigla === sigla)!;
  // Educação Física: não no tempo logo após o almoço
  for (const d of dias) disc('EF').indisp[chaveGrelha(d, tempos[6].id)] = 'indisponivel';

  // Salas
  const salas: Sala[] = [];
  const addSala = (nome: string, tipo: string, capacidade = 1) => {
    const s: Sala = { id: novoId('s'), nome, tipo, capacidade, indisp: {} };
    salas.push(s);
    return s;
  };
  const salasAula = Array.from({ length: turmasPorAno * 5 }, (_, i) => addSala(`Sala ${i + 1}`, 'Sala de aula'));
  addSala('Laboratório 1', 'Laboratório');
  addSala('Laboratório 2', 'Laboratório');
  addSala('Sala TIC 1', 'Sala de informática');
  addSala('Sala TIC 2', 'Sala de informática');
  addSala('Pavilhão', 'Pavilhão / Ginásio', 3);
  addSala('Sala EV 1', 'Sala de Educação Visual');
  addSala('Sala EV 2', 'Sala de Educação Visual');
  addSala('Oficina ET', 'Oficina de Educação Tecnológica');
  addSala('Sala de Música', 'Sala de Música');
  p.salas = salas;

  // Turmas
  const letras = 'ABCDEFGH';
  const turmas: Turma[] = [];
  for (const ano of ['5', '6', '7', '8', '9']) {
    for (let i = 0; i < turmasPorAno; i++) {
      const t: Turma = {
        id: novoId('tu'),
        nome: `${ano}.º ${letras[i]}`,
        ano,
        dtId: null,
        salaId: salasAula[turmas.length].id,
        maxTemposDia: null,
        indisp: {},
        notas: '',
      };
      if (ano === '5' || ano === '6') for (const d of dias) t.indisp[chaveGrelha(d, tempos[9].id)] = 'indisponivel';
      turmas.push(t);
    }
  }
  p.turmas = turmas;

  // Professores (criados à medida)
  const professores: Professor[] = [];
  const grupoDe = new Map<string, string>();
  const carga = new Map<string, number>();
  const nomesUsados = new Set<string>();
  const novoProfessor = (grupo: string) => {
    let nome = '';
    do nome = `${escolher(NOMES)} ${escolher(APELIDOS)} ${escolher(APELIDOS)}`;
    while (nomesUsados.has(nome));
    nomesUsados.add(nome);
    let sigla = siglaDeNome(nome, 3);
    while (professores.some((x) => x.sigla === sigla)) sigla = sigla.slice(0, 3) + Math.floor(rnd() * 9 + 1);
    const prof: Professor = {
      id: novoId('p'),
      nome,
      sigla,
      grupo,
      email: '',
      maxTemposDia: null,
      maxConsecutivos: null,
      indisp: {},
      notas: '',
    };
    professores.push(prof);
    grupoDe.set(prof.id, grupo);
    carga.set(prof.id, 0);
    return prof;
  };

  const aulas: Aula[] = [];
  const novaAula = (parcial: Partial<Aula> & { disciplinaId: string; distribuicao: number[] }): Aula => {
    const a: Aula = {
      id: novoId('a'),
      professorIds: [],
      turmaIds: [],
      turno: '',
      modoSala: 'auto',
      salaId: null,
      simultaneo: '',
      notas: '',
      ...parcial,
    };
    aulas.push(a);
    for (const pid of a.professorIds) carga.set(pid, (carga.get(pid) ?? 0) + a.distribuicao.reduce((x, y) => x + y, 0));
    return a;
  };

  const docentePara = (sigla: string, ciclo: '2' | '3', tempos: number, preferidos: string[]) => {
    const grupos = GRUPOS.filter((g) => g.siglas.includes(sigla) && (g.ciclo === ciclo || g.ciclo === '*'));
    const candidatos = professores.filter(
      (x) => grupos.some((g) => g.grupo === grupoDe.get(x.id)) && (carga.get(x.id) ?? 0) + tempos <= CARGA_MAXIMA,
    );
    const pref = candidatos.find((x) => preferidos.includes(x.id));
    if (pref) return pref;
    if (candidatos.length) return candidatos.sort((a, b) => (carga.get(b.id) ?? 0) - (carga.get(a.id) ?? 0))[0];
    return novoProfessor(grupos[0].grupo);
  };

  const emrc = new Map<string, string[]>(); // ano → turmas com EMRC

  for (const turma of turmas) {
    const ciclo = turma.ano === '5' || turma.ano === '6' ? '2' : '3';
    const plano = PLANOS_CURRICULARES[turma.ano];
    const doMesmoAno = aulas.filter((a) => turmas.find((t) => t.id === a.turmaIds[0])?.ano === turma.ano);
    const lab9 = turma.ano === '9' && (turma.nome.endsWith('A') || turma.nome.endsWith('B'));
    const le2 = turma.ano === '7' && (turma.nome.endsWith('A') || turma.nome.endsWith('B'));
    for (const item of plano) {
      if (item.sigla === 'CD') continue; // atribuída ao diretor de turma
      if (item.sigla === 'EMRC') {
        if (!emrc.has(turma.ano)) emrc.set(turma.ano, []);
        emrc.get(turma.ano)!.push(turma.id);
        continue;
      }
      if (item.sigla === 'FRA' && le2) continue; // tratado abaixo (Francês/Espanhol)
      let distribuicao = item.distribuicao;
      if (lab9 && (item.sigla === 'CN' || item.sigla === 'FQ')) distribuicao = [2];
      const total = distribuicao.reduce((a, b) => a + b, 0);
      const preferidos = doMesmoAno.filter((a) => disc(item.sigla).id === a.disciplinaId).flatMap((a) => a.professorIds);
      const prof = docentePara(item.sigla, ciclo, total, preferidos);
      novaAula({ disciplinaId: disc(item.sigla).id, turmaIds: [turma.id], professorIds: [prof.id], distribuicao });
    }
    if (lab9) {
      // Desdobramento em laboratório: CN e FQ por turnos, em simultâneo e alternados
      const profCN = aulas.find((a) => a.turmaIds[0] === turma.id && a.disciplinaId === disc('CN').id)!.professorIds[0];
      const profFQ = aulas.find((a) => a.turmaIds[0] === turma.id && a.disciplinaId === disc('FQ').id)!.professorIds[0];
      const g1 = `Laboratórios ${turma.nome} (1)`;
      const g2 = `Laboratórios ${turma.nome} (2)`;
      novaAula({ disciplinaId: disc('CN').id, turmaIds: [turma.id], professorIds: [profCN], turno: 'Turno 1', distribuicao: [1], simultaneo: g1, modoSala: 'fixa', salaId: salas.find((s) => s.nome === 'Laboratório 2')!.id });
      novaAula({ disciplinaId: disc('FQ').id, turmaIds: [turma.id], professorIds: [profFQ], turno: 'Turno 2', distribuicao: [1], simultaneo: g1 });
      novaAula({ disciplinaId: disc('FQ').id, turmaIds: [turma.id], professorIds: [profFQ], turno: 'Turno 1', distribuicao: [1], simultaneo: g2 });
      novaAula({ disciplinaId: disc('CN').id, turmaIds: [turma.id], professorIds: [profCN], turno: 'Turno 2', distribuicao: [1], simultaneo: g2, modoSala: 'fixa', salaId: salas.find((s) => s.nome === 'Laboratório 2')!.id });
    }
  }

  // Língua Estrangeira II no 7.º A e 7.º B: Francês e Espanhol em simultâneo
  const t7 = turmas.filter((t) => t.ano === '7').slice(0, 2);
  if (t7.length === 2) {
    const profFra = docentePara('FRA', '3', 3, []);
    novaAula({ disciplinaId: disc('FRA').id, turmaIds: t7.map((t) => t.id), professorIds: [profFra.id], turno: 'Francês', distribuicao: [1, 1, 1], simultaneo: 'LE II 7.º A/B', modoSala: 'nenhuma' });
    const profEsp = docentePara('ESP', '3', 3, []);
    novaAula({ disciplinaId: disc('ESP').id, turmaIds: t7.map((t) => t.id), professorIds: [profEsp.id], turno: 'Espanhol', distribuicao: [1, 1, 1], simultaneo: 'LE II 7.º A/B', modoSala: 'nenhuma' });
  }

  // EMRC: turmas do mesmo ano juntas, duas a duas
  for (const [ano, ids] of emrc) {
    for (let i = 0; i < ids.length; i += 2) {
      const grupo = ids.slice(i, i + 2);
      const prof = docentePara('EMRC', ano === '5' || ano === '6' ? '2' : '3', 1, professores.filter((x) => x.grupo === '290').map((x) => x.id));
      novaAula({ disciplinaId: disc('EMRC').id, turmaIds: grupo, professorIds: [prof.id], distribuicao: [1], modoSala: grupo.length > 1 ? 'nenhuma' : 'auto' });
    }
  }

  // Diretores de turma: um docente da turma que ainda não seja DT; leciona Cidadania e Desenvolvimento
  const dts = new Set<string>();
  for (const turma of turmas) {
    const candidatos = aulas
      .filter((a) => a.turmaIds.length === 1 && a.turmaIds[0] === turma.id && !a.turno)
      .flatMap((a) => a.professorIds)
      .filter((id) => !dts.has(id) && (carga.get(id) ?? 0) <= CARGA_MAXIMA);
    const dt = candidatos.length ? candidatos.sort((a, b) => (carga.get(a) ?? 0) - (carga.get(b) ?? 0))[0] : null;
    if (!dt) continue;
    dts.add(dt);
    turma.dtId = dt;
    novaAula({ disciplinaId: disc('CD').id, turmaIds: [turma.id], professorIds: [dt], distribuicao: [1] });
    novaAula({ disciplinaId: atendimento.id, professorIds: [dt], distribuicao: [1], modoSala: 'nenhuma' });
  }

  // Indisponibilidades pessoais
  for (const prof of professores) {
    const r = rnd();
    if (r < 0.35) {
      const d = escolher(dias);
      const manha = rnd() < 0.5;
      for (const tp of manha ? tempos.slice(0, 5) : tempos.slice(7)) prof.indisp[chaveGrelha(d, tp.id)] = 'indisponivel';
      prof.notas = manha ? 'Acompanhamento familiar de manhã' : 'Formação contínua à tarde';
    } else if (r < 0.55) {
      for (const d of dias) prof.indisp[chaveGrelha(d, tempos[9].id)] = 'evitar';
    }
  }

  p.professores = professores.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-PT'));
  p.aulas = aulas;
  return p;
}
