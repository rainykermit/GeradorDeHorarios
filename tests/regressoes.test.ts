// Testes para erros encontrados na revisão do código (não devem voltar a acontecer).

import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import type { Projeto } from '../src/model/tipos';
import { novoProjeto } from '../src/model/padrao';
import { novaAula, remapearGrelhas } from '../src/model/operacoes';
import { separarLista } from '../src/ui/ImportarColar';
import { normalizarProjeto } from '../src/estado/migracao';
import { chaveColocacao, compilar } from '../src/motor/compilar';
import { estadoDoHorario } from '../src/motor/conversao';
import { exportarExcel } from '../src/exportar/xlsx';

function projetoPequeno(): Projeto {
  const p = novoProjeto();
  p.escola = 'Escola de Teste';
  p.config.dias = [0];
  p.config.tempos = [
    { id: 't1', inicio: '08:00', fim: '08:50' },
    { id: 't2', inicio: '08:50', fim: '09:40' },
    { id: 't3', inicio: '09:50', fim: '10:40' },
    { id: 't4', inicio: '10:40', fim: '11:30' },
  ];
  p.disciplinas = [{ id: 'd1', nome: 'Matemática', sigla: 'MAT', cor: '#1f5fbf', tipoSala: '', maxPorDia: 1, indisp: {} }];
  p.turmas = ['A', 'B'].map((l) => ({ id: 'tu' + l, nome: `7.º ${l}`, ano: '7', dtId: null, salaId: null, maxTemposDia: null, indisp: {}, notas: '' }));
  p.professores = ['p1', 'p2'].map((id) => ({
    id,
    nome: `Docente ${id}`,
    sigla: id.toUpperCase(),
    grupo: '',
    email: '',
    maxTemposDia: null,
    maxConsecutivos: null,
    indisp: {},
    notas: '',
  }));
  p.salas = [{ id: 's1', nome: 'Sala 1', tipo: 'Sala de aula', capacidade: 1, indisp: {} }];
  p.aulas = [
    novaAula({ id: 'aX', disciplinaId: 'd1', turmaIds: ['tuA', 'tuB'], professorIds: ['p1'], distribuicao: [1, 1] }),
    novaAula({ id: 'aY', disciplinaId: 'd1', turmaIds: ['tuA'], professorIds: ['p2'], distribuicao: [1], modoSala: 'nenhuma' }),
  ];
  p.horario.colocacoes = [
    { aulaId: 'aX', indice: 0, dia: 0, tempoId: 't1', salaId: null, fixa: false },
    { aulaId: 'aX', indice: 1, dia: 0, tempoId: 't2', salaId: null, fixa: false },
    { aulaId: 'aY', indice: 0, dia: 0, tempoId: 't3', salaId: 's1', fixa: false },
  ];
  return p;
}

describe('regressões', () => {
  it('duplicar uma aula dá-lhe um identificador novo', () => {
    const original = novaAula({ disciplinaId: 'd1' });
    const copia = novaAula({ ...original, id: '' });
    expect(copia.id).toBeTruthy();
    expect(copia.id).not.toBe(original.id);
  });

  it('colar do Excel não parte nomes com «e»', () => {
    expect(separarLista('Ana Sousa e Silva')).toEqual(['Ana Sousa e Silva']);
    expect(separarLista('7.º A / 7.º B, 7.º C')).toEqual(['7.º A', '7.º B', '7.º C']);
  });

  it('ficheiros com regras inválidas não estragam o motor', () => {
    const bruto = JSON.parse(JSON.stringify(projetoPequeno()));
    bruto.regras.furosTurmas = 9;
    bruto.regras.furosProfessores = 'muito';
    bruto.regras.maxTemposDiaTurma = -3;
    bruto.config.intervaloMaxBloco = 'x';
    const p = normalizarProjeto(bruto);
    expect(p.regras.furosTurmas).toBe(3);
    expect(p.regras.furosProfessores).toBe(2);
    expect(p.regras.maxTemposDiaTurma).toBe(0);
    expect(p.config.intervaloMaxBloco).toBe(20);
    for (const v of Object.values(compilar(p, { usarHorarioAtual: false, manterFixas: true }).pesos)) expect(Number.isFinite(v)).toBe(true);
  });

  it('«mesma disciplina no mesmo dia» é contada na turma certa', () => {
    const e = estadoDoHorario(projetoPequeno());
    expect(e.invalidas).toEqual([]);
    const a = e.motor.analisar();
    // 7.º A tem 3 aulas de MAT no dia (excesso 2); 7.º B tem 2 (excesso 1)
    expect(a.turmas[0].mesmoDia).toBe(2);
    expect(a.turmas[1].mesmoDia).toBe(1);
  });

  it('uma sala escolhida à mão mantém-se ao reabrir o horário', () => {
    const e = estadoDoHorario(projetoPequeno());
    const [u] = e.problema.mapa.get(chaveColocacao('aY', 0))!;
    expect(e.motor.salasDe(u)[0]).toBe(0);
  });

  it('o Excel não une células isoladas (evita o pedido de reparação)', () => {
    const p = projetoPequeno();
    p.config.tempos = [p.config.tempos[0]];
    p.aulas = [p.aulas[0]];
    p.horario.colocacoes = [p.horario.colocacoes[0]];
    const xml = new TextDecoder().decode(exportarExcel(p, { geralTurmas: true, geralProfs: true, turmas: true, profs: true, salas: true, distribuicao: true }));
    const unioes = [...xml.matchAll(/<mergeCell ref="([A-Z]+\d+):([A-Z]+\d+)"\/>/g)];
    for (const m of unioes) expect(m[1]).not.toBe(m[2]);
    expect(xml).not.toContain('name="Sala Sala 1"');
  });

  it('ao recriar os tempos, as indisponibilidades passam para os novos tempos', () => {
    const p = projetoPequeno();
    p.professores[0].indisp = { '0|t1': 'indisponivel', '0|t4': 'evitar' };
    p.bloqueios = { '0|t2': 'indisponivel' };
    const novo = produce(p, (d) =>
      remapearGrelhas(
        d,
        new Map([
          ['t1', 'n1'],
          ['t2', 'n2'],
        ]),
      ),
    );
    expect(novo.professores[0].indisp).toEqual({ '0|n1': 'indisponivel' });
    expect(novo.bloqueios).toEqual({ '0|n2': 'indisponivel' });
  });
});
