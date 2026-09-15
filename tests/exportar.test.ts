import { describe, expect, it } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { criarExemplo } from '../src/model/exemplo';
import { compilar } from '../src/motor/compilar';
import { Motor } from '../src/motor/motor';
import { colocacoesDoMotor, estadoDoHorario } from '../src/motor/conversao';
import { exportarExcel } from '../src/exportar/xlsx';
import { verificarProjeto } from '../src/model/validacao';
import { normalizarProjeto } from '../src/estado/migracao';

describe('exportação e dados', () => {
  const projeto = criarExemplo();
  const problema = compilar(projeto, { usarHorarioAtual: false, manterFixas: true });
  const motor = new Motor(problema, { segundos: 4, semente: 3 });
  motor.resolver();
  projeto.horario.colocacoes = colocacoesDoMotor(problema, motor);

  it('a escola de exemplo não tem erros de validação', () => {
    const erros = verificarProjeto(projeto).filter((o) => o.nivel === 'erro');
    expect(erros).toEqual([]);
  });

  it('reconstrói o estado a partir do horário guardado sem conflitos', () => {
    const e = estadoDoHorario(projeto);
    expect(e.invalidas).toEqual([]);
    expect(e.motor.analisar().naoColocadas.length).toBe(motor.analisar().naoColocadas.length);
  });

  it('guardar e abrir mantém o projeto igual', () => {
    const copia = normalizarProjeto(JSON.parse(JSON.stringify(projeto)));
    expect(copia).toEqual(projeto);
  });

  it('gera um ficheiro xlsx válido', () => {
    const dados = exportarExcel(projeto, { geralTurmas: true, geralProfs: true, turmas: true, profs: true, salas: true, distribuicao: true });
    expect(dados[0]).toBe(0x50);
    expect(dados[1]).toBe(0x4b);
    const dir = process.env.SAIDA_TESTES;
    if (dir) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(`${dir}/exemplo.xlsx`, dados);
    }
  });

  it('a edição manual consegue avaliar destinos e trocas', () => {
    const e = estadoDoHorario(projeto);
    let trocas = 0;
    let livres = 0;
    for (let u = 0; u < 40; u++) {
      const r = e.motor.avaliarDestinos(u);
      for (let s = 0; s < r.estados.length; s++) {
        if (r.estados[s] === 3) {
          trocas++;
          expect(e.motor.salasParaTroca(u, r.trocas[s])).not.toBeNull();
        }
        if (r.estados[s] === 1) {
          livres++;
          expect(e.motor.salasParaMover(u, s)).not.toBeNull();
        }
      }
    }
    // o estado não pode ter sido alterado pelas avaliações
    expect(Array.from(e.motor.pos)).toEqual(Array.from(estadoDoHorario(projeto).motor.pos));
    expect(trocas + livres).toBeGreaterThan(0);
  });
});
