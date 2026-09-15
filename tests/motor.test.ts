import { describe, expect, it } from 'vitest';
import { criarExemplo } from '../src/model/exemplo';
import { compilar } from '../src/motor/compilar';
import { Motor } from '../src/motor/motor';

function verificarSemConflitos(motor: Motor) {
  const p = motor.p;
  const prof = new Map<string, number>();
  const turma = new Map<string, number[]>();
  const sala = new Map<string, number>();
  for (let u = 0; u < motor.U; u++) {
    const s = motor.pos[u];
    if (s < 0) continue;
    const un = p.unidades[u];
    expect(un.permitido[s]).toBe(1);
    for (let i = 0; i < un.dur; i++) {
      const slot = s + i;
      expect(Math.floor(slot / p.T)).toBe(Math.floor(s / p.T));
      for (const pr of un.profs) {
        const k = `${pr}:${slot}`;
        expect(prof.has(k), `docente ${p.profIds[pr]} em dobro`).toBe(false);
        prof.set(k, u);
      }
      for (let k = 0; k < un.turmas.length; k++) {
        const key = `${un.turmas[k]}:${slot}`;
        for (const v of turma.get(key) ?? []) {
          const uv = p.unidades[v];
          const kv = uv.turmas.indexOf(un.turmas[k]);
          const conflito = un.inteira[k] || uv.inteira[kv] || (un.mascaras[k] & uv.mascaras[kv]) !== 0;
          expect(conflito, 'turma em dobro').toBe(false);
        }
        turma.set(key, [...(turma.get(key) ?? []), u]);
      }
      const salas = motor.salasDe(u);
      for (const r of salas) {
        if (r < 0) continue;
        const key = `${r}:${slot}`;
        sala.set(key, (sala.get(key) ?? 0) + 1);
        expect(sala.get(key)!).toBeLessThanOrEqual(p.salaCap[r]);
      }
    }
  }
}

describe('motor de horários', () => {
  it('gera um horário completo e sem conflitos para a escola de exemplo', () => {
    const projeto = criarExemplo();
    const problema = compilar(projeto, { usarHorarioAtual: false, manterFixas: true });
    const totalTempos = problema.unidades.reduce((a, u) => a + u.dur, 0);
    const motor = new Motor(problema, { segundos: Number(process.env.SEGUNDOS ?? 15), semente: 7 });
    const t0 = Date.now();
    motor.resolver();
    const analise = motor.analisar();
    console.log(
      `Unidades: ${motor.U}, tempos: ${totalTempos}, docentes: ${problema.nProf}, turmas: ${problema.nTurma}, ` +
        `tempo: ${(Date.now() - t0) / 1000}s`,
    );
    console.log(
      'RESULTADO ' +
        JSON.stringify({ naoColocadas: analise.naoColocadas.length, custo: analise.custo, ...analise.totais, evitar: analise.aulasEmEvitar }),
    );
    verificarSemConflitos(motor);
    expect(analise.naoColocadas.length).toBe(0);
  });
});
