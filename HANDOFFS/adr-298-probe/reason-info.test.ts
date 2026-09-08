import { FIRESTORE_RULES_COVERAGE } from 'C:/Nestor_Pagonis/tests/firestore-rules/_registry/coverage-manifest';

it('is reason independent information?', () => {
  const byPersona: Record<string, Record<string, number>> = {};
  const denyNoReason: Record<string, number> = {};
  let deny = 0;
  for (const e of FIRESTORE_RULES_COVERAGE) {
    for (const c of e.matrix) {
      if (c.outcome !== 'deny') continue;
      deny++;
      if (!c.reason) { denyNoReason[c.persona] = (denyNoReason[c.persona] || 0) + 1; continue; }
      (byPersona[c.persona] ??= {})[c.reason] = ((byPersona[c.persona] ??= {})[c.reason] || 0) + 1;
    }
  }
  console.log('DENY_CELLS=' + deny);
  console.log('DENY_WITHOUT_REASON=' + JSON.stringify(denyNoReason));
  for (const [p, m] of Object.entries(byPersona)) {
    const total = Object.values(m).reduce((a, b) => a + b, 0);
    const top = Object.entries(m).sort((a, b) => b[1] - a[1]);
    console.log(`${p.padEnd(18)} n=${String(total).padStart(4)}  ${top.map(([r, n]) => `${r}:${n}`).join('  ')}`);
  }
});
