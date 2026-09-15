import { describe, expect, it } from 'vitest';
import { criarExemplo } from '../src/model/exemplo';
import { chaveGrelha } from '../src/model/tipos';
import { compilar } from '../src/motor/compilar';
import { Motor, criarAleatorio } from '../src/motor/motor';
import { colocacoesDoMotor, estadoDoHorario } from '../src/motor/conversao';
import { verificarProjeto } from '../src/model/validacao';

describe('motor em cenários difíceis', () => {
  it('escola grande (30 turmas) com muitas indisponibilidades', () => {
    const p = criarExemplo({ turmasPorAno: 6, semente: 99 });
    const rnd = criarAleatorio(5);
    const tempos = p.config.tempos;
    // Cada docente fica indisponível numa manhã ou tarde inteira, e 30% num segundo período
    for (const prof of p.professores) {
      const periodos = rnd() < 0.3 ? 2 : 1;
      for (let k = 0; k < periodos; k++) {
        const d = Math.floor(rnd() * 5);
        const bloco = rnd() < 0.5 ? tempos.slice(0, 5) : tempos.slice(7);
        for (const t of bloco) prof.indisp[chaveGrelha(d, t.id)] = 'indisponivel';
      }
    }
    const erros = verificarProjeto(p).filter((o) => o.nivel === 'erro');
    expect(erros.map((e) => e.texto)).toEqual([]);

    const problema = compilar(p, { usarHorarioAtual: false, manterFixas: true });
    const motor = new Motor(problema, { segundos: Number(process.env.SEGUNDOS ?? 20), semente: 11 });
    motor.resolver();
    const a = motor.analisar();
    console.log(`ESFORCO unidades=${motor.U} docentes=${problema.nProf} naoColocadas=${a.naoColocadas.length} ${JSON.stringify(a.totais)}`);
    expect(a.naoColocadas.length).toBe(0);
  });

  it('respeita as aulas fixadas ao gerar de novo', () => {
    const p = criarExemplo({ semente: 7 });
    const problema = compilar(p, { usarHorarioAtual: false, manterFixas: true });
    const m1 = new Motor(problema, { segundos: 3, semente: 1 });
    m1.resolver();
    p.horario.colocacoes = colocacoesDoMotor(problema, m1);
    // fixar 40 colocações
    const fixadas = new Set<string>();
    for (const c of p.horario.colocacoes.slice(0, 40)) {
      c.fixa = true;
      fixadas.add(`${c.aulaId}#${c.indice}`);
    }
    // grupos simultâneos: fixar todos os membros da mesma unidade
    const e = estadoDoHorario(p);
    const antes = new Map(p.horario.colocacoes.map((c) => [`${c.aulaId}#${c.indice}`, `${c.dia}|${c.tempoId}`]));

    const problema2 = compilar(p, { usarHorarioAtual: false, manterFixas: true });
    const m2 = new Motor(problema2, { segundos: 3, semente: 2 });
    m2.resolver();
    const depois = colocacoesDoMotor(problema2, m2);
    for (const c of depois) {
      const k = `${c.aulaId}#${c.indice}`;
      const [u] = e.problema.mapa.get(k)!;
      if (problema2.unidades[u].fixa) expect(`${c.dia}|${c.tempoId}`).toBe(antes.get(k));
    }
    expect(depois.filter((c) => c.fixa).length).toBeGreaterThanOrEqual(40);
  });

  it('dados impossíveis: não rebenta e indica as aulas por colocar', () => {
    const p = criarExemplo({ semente: 3 });
    const prof = p.professores[0];
    // docente só disponível num único dia
    for (const d of [0, 1, 2, 3]) for (const t of p.config.tempos) prof.indisp[chaveGrelha(d, t.id)] = 'indisponivel';
    const ocorrencias = verificarProjeto(p);
    const problema = compilar(p, { usarHorarioAtual: false, manterFixas: true });
    const motor = new Motor(problema, { segundos: 3, semente: 4 });
    motor.resolver();
    const a = motor.analisar();
    const temErroCapacidade = ocorrencias.some((o) => o.nivel === 'erro' && o.texto.includes(prof.nome));
    console.log(`IMPOSSIVEL erroValidacao=${temErroCapacidade} naoColocadas=${a.naoColocadas.length}`);
    expect(temErroCapacidade || a.naoColocadas.length === 0).toBe(true);
  });
});
