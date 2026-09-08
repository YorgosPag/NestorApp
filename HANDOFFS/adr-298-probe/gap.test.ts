import { FIRESTORE_RULES_COVERAGE } from 'C:/Nestor_Pagonis/tests/firestore-rules/_registry/coverage-manifest';
import { ALL_PERSONAS } from 'C:/Nestor_Pagonis/tests/firestore-rules/_registry/personas';
import { ALL_OPERATIONS } from 'C:/Nestor_Pagonis/tests/firestore-rules/_registry/operations';

it('reports gaps', () => {
  const lines: string[] = [];
  let totalCells = 0, totalReason = 0, totalPossible = 0;
  const byPersona: Record<string, number> = {};
  const byPersonaOp: Record<string, number> = {};
  const reasonCount: Record<string, number> = {};
  for (const e of FIRESTORE_RULES_COVERAGE as any[]) {
    const have = new Set(e.matrix.map((c: any) => `${c.persona}:${c.operation}`));
    for (const c of e.matrix) { totalCells++; if (c.reason) { totalReason++; reasonCount[c.reason] = (reasonCount[c.reason]||0)+1; } }
    const missing: string[] = [];
    for (const p of ALL_PERSONAS) for (const o of ALL_OPERATIONS) {
      totalPossible++;
      if (!have.has(`${p}:${o}`)) { missing.push(`${p}:${o}`); byPersona[p]=(byPersona[p]||0)+1; byPersonaOp[`${p}:${o}`]=(byPersonaOp[`${p}:${o}`]||0)+1; }
    }
    lines.push(`${String(e.matrix.length).padStart(2)}/35 ${e.pattern.padEnd(22)} ${e.collection}`);
  }
  console.log('COLLECTIONS=' + FIRESTORE_RULES_COVERAGE.length);
  console.log('CELLS=' + totalCells + ' POSSIBLE=' + totalPossible + ' MISSING=' + (totalPossible-totalCells));
  console.log('REASON_TAGS=' + totalReason);
  console.log('REASON_BREAKDOWN=' + JSON.stringify(reasonCount, null, 1));
  console.log('MISSING_BY_PERSONA=' + JSON.stringify(byPersona, null, 1));
  console.log('MISSING_BY_PERSONA_OP=' + JSON.stringify(byPersonaOp, null, 1));
  console.log(lines.sort().join('\n'));
});
