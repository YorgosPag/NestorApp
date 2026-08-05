/**
 * ΖΩΝΤΑΝΗ ΕΠΑΛΗΘΕΥΣΗ — **βγαίνουν ΚΑΙ ΟΙ ΔΥΟ μελετητές;** (ADR-745 §3 βήμα 3)
 *
 * Το handoff το έθεσε ως όρο επιτυχίας με έμφαση: *«ΚΑΙ ΟΙ ΔΥΟ — αν εμφανιστεί ένας, το
 * ελάττωμα (α) ζει»*. Ένα κελί «ΜΕΛΕΤΗΤΗΣ» φέρει **δύο πρόσωπα**, και όλη η αρχιτεκτονική
 * του κλειδιού (slot αντί για κελί) υπάρχει γι' αυτό ακριβώς.
 *
 * Τρέχει **τον αναγνώστη (Λ1) και τον επιλυτή (Λ2) της παραγωγής, αυτούσιους**, πάνω στο
 * μετρημένο περιεχόμενο του πραγματικού «G753_ergasia F.dxf» (941.160 bytes, AC1032,
 * layer «PINAKAKI 500»).
 *
 * ⚠️ **Τι ΔΕΝ καλύπτει, δηλωμένο:** η αποκωδικοποίηση των bytes του DXF σε οντότητες γίνεται
 * **ανάντη** (worker του εισαγωγέα) και δεν εκτελείται εδώ — η είσοδος είναι το fixture, που
 * είναι **εξαγωγή** εκείνου του αρχείου κελί προς κελί. Επίσης δεν αποδεικνύει **τίποτα για
 * τα εικονοστοιχεία**: ότι η παλέτα ζωγραφίζει σωστά, ότι το κουμπί είναι εκεί που πρέπει.
 * Αποδεικνύει ότι **τα δεδομένα που θα ζωγραφιστούν είναι τα σωστά** — που είναι το σημείο
 * όπου ζούσε το ελάττωμα.
 *
 * Εκτέλεση: `npx tsx scripts/verify-titleblock-designers.ts`
 *
 * @module scripts/verify-titleblock-designers
 */

import { readTitleBlocks } from '@/subapps/dxf-viewer/text-engine/title-block/reading/title-block-reading';
import { G753_TITLEBLOCK_ROWS } from '@/subapps/dxf-viewer/text-engine/title-block/reading/__tests__/fixtures/g753-titleblock.fixture';
import { resolveTitleBlockProposals } from '@/lib/title-block/title-block-proposals';
import type { ContactSnapshotEntry } from '@/lib/title-block/resolve-people';
import type { TitleBlockSourceCell } from '@/types/title-block-reading';

const LAYER = 'PINAKAKI 500';
const PROJECT_ID = 'proj_demo_emulator';
const LEVEL_ID = 'level_demo';

/**
 * Οι δύο μηχανικοί, όπως θα υπήρχαν στις επαφές του μισθωτή.
 *
 * Τα ονόματα είναι **αυτούσια από το αρχείο** — μαζί με την κάθετο του «ΚΩΝ/ΝΟΣ», που είναι
 * ο λόγος ύπαρξης του `encodeKeySegment`.
 */
const CONTACTS: ContactSnapshotEntry[] = [
  { id: 'cont_mavromichalis', displayName: 'ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ', phones: [], emails: [] },
  { id: 'cont_nikolaou', displayName: 'ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ', phones: [], emails: [] },
];

const cells: TitleBlockSourceCell[] = G753_TITLEBLOCK_ROWS.map((r) => ({
  handle: r.handle,
  x: r.x,
  y: r.y,
  height: r.height,
  raw: r.raw,
}));

console.log('══════════════════════════════════════════════════════════════');
console.log('ΖΩΝΤΑΝΗ ΕΠΑΛΗΘΕΥΣΗ — ΟΙ ΜΕΛΕΤΗΤΕΣ (ADR-745 §3 βήμα 3)');
console.log('══════════════════════════════════════════════════════════════');
console.log(`📄 layer «${LAYER}» · ${cells.length} κελιά από το πραγματικό αρχείο\n`);

const readings = readTitleBlocks(LAYER, cells);
console.log(`📐 Πινακίδες που εντοπίστηκαν: ${readings.length}`);
readings.forEach((r, i) => {
  console.log(`   #${i}: ${r.fields.length} πεδία · ${r.people.length} πρόσωπα · ${r.unparsed.length} αδιάβαστα`);
});
console.log('');

const proposals = resolveTitleBlockProposals(readings, {
  projectId: PROJECT_ID,
  levelId: LEVEL_ID,
  contacts: CONTACTS,
});

const designers = proposals.filter((p) => p.fieldKey === 'designers');

console.log('👥 ΠΡΟΤΑΣΕΙΣ ΜΕΛΕΤΗΤΩΝ');
for (const p of designers) {
  const best = p.candidates[0];
  const role = best && best.target.kind === 'contact' ? best.target.role : '—';
  console.log(`   · «${p.personName ?? '(χωρίς όνομα)'}»`);
  console.log(`     πινακίδα #${p.titleBlockIndex} · κελί ${p.sourceHandle} · σημείο (${p.at.x}, ${p.at.y})`);
  console.log(`     υποψήφιοι: ${p.candidates.length}${p.blockedBy ? ` · φραγμένο: ${p.blockedBy}` : ''}`);
  if (best) console.log(`     → ${best.label} · ρόλος «${role}» · μαρτυρία: ${best.evidence.map((e) => `${e.kind}=${e.value}`).join(', ') || '(καμία)'}`);
}
console.log('');

const results: Array<[string, boolean, string]> = [];
const check = (label: string, ok: boolean, detail: string) => {
  results.push([label, ok, detail]);
  console.log(`${ok ? '   ✅' : '   ❌'} ${label}\n      ${detail}`);
};

const names = designers.map((p) => p.personName ?? '');
const roles = designers
  .map((p) => (p.candidates[0]?.target.kind === 'contact' ? p.candidates[0].target.role : null))
  .filter(Boolean);

check(
  '🔴 ΚΑΙ ΟΙ ΔΥΟ μελετητές παράγονται από ΕΝΑ κελί',
  designers.length === 2,
  `προτάσεις μελετητών: ${designers.length} · ονόματα: ${names.join(' | ') || '(κανένα)'}`,
);
check(
  'Οι δύο προτάσεις μοιράζονται το ΙΔΙΟ κελί (γι᾿ αυτό το supersede είναι ανά slot)',
  designers.length === 2 && designers[0].sourceHandle === designers[1].sourceHandle,
  `κελιά: ${designers.map((p) => p.sourceHandle).join(' , ')}`,
);
check(
  'Κάθε μελετητής βρήκε τον άνθρωπό του στις επαφές',
  designers.length === 2 && designers.every((p) => p.candidates.length >= 1),
  `υποψήφιοι ανά πρόταση: ${designers.map((p) => p.candidates.length).join(' , ')}`,
);
check(
  'Οι ρόλοι είναι ΔΙΑΦΟΡΕΤΙΚΟΙ (τοπογράφος ≠ πολιτικός μηχανικός)',
  roles.length === 2 && roles[0] !== roles[1],
  `ρόλοι: ${roles.join(' , ') || '(κανένας)'}`,
);
check(
  'Εντοπίστηκαν ΔΥΟ πινακίδες στο layer (§2.3 Παγίδα Δ)',
  readings.length === 2,
  `πινακίδες: ${readings.length}`,
);

console.log('\n══════════════════════════════════════════════════════════════');
const failed = results.filter(([, ok]) => !ok);
console.log(failed.length === 0
  ? `✅ ΟΛΑ ΠΕΡΑΣΑΝ — ${results.length}/${results.length}`
  : `❌ ΑΠΕΤΥΧΑΝ ${failed.length}/${results.length}: ${failed.map(([l]) => l).join(' · ')}`);
console.log('══════════════════════════════════════════════════════════════');
process.exit(failed.length === 0 ? 0 : 1);
