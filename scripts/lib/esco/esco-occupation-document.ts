/**
 * ADR-132 / ADR-798 §20.4 #3 — **ΤΟ ΕΓΓΡΑΦΟ ΕΠΑΓΓΕΛΜΑΤΟΣ**, και η **άρνηση να
 * επινοήσουμε κωδικό**.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 ΤΙ ΑΝΤΙΚΑΘΙΣΤΑ — Η ΕΠΙΝΟΗΜΕΝΗ ΤΑΥΤΟΤΗΤΑ `'0000'`
 *
 *     function extractIscoCode(code: string | undefined): string {
 *       if (!code) return '0000';               // ← ΕΠΙΝΟΗΣΗ
 *       return code.split('.')[0] || '0000';
 *     }
 *
 * Το `'0000'` **δεν σημαίνει «άγνωστο»**. Στο ISCO-08 η **μείζων ομάδα 0** είναι
 * οι **Ένοπλες Δυνάμεις** — τα `0110` *(αξιωματικοί)*, `0210` *(υπαξιωματικοί)*,
 * `0310` *(λοιπά μέλη)* είναι **υπαρκτές μονάδες**. Και επειδή το `'0000'` περνά
 * το σχήμα `^\d{1,4}$`, ο επιλυτής το κατέτασσε `undeclared` *(«σιωπή εκ
 * σχεδιασμού»)* αντί για `malformed` *(«σφάλμα»)*: **σεντινέλα που ξεπλένει
 * σφάλμα σε νόμιμη κατάσταση**. Χειρότερα, η γρ. 227 έκανε
 * `iscoCode.substring(0,3)` ⇒ `iscoGroup === '000'` ⇒ κάθε επάγγελμα χωρίς
 * κωδικό αρχειοθετούνταν σε ομάδα που ο άνθρωπος διαβάζει ως **στρατιωτική**.
 *
 * 🔑 **Δεν είναι κενό που φαίνεται· είναι λάθος κατάταξη που δείχνει σωστή.**
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΟΧΙ ΔΥΟ — ΚΑΙ Η ΑΠΟΦΑΣΗ ΓΙΑ ΤΗΝ ΚΑΘΕΜΙΑ
 *
 * | Η πηγή είπε | Γράφουμε | Τι λέει ο `resolveIscoPrefix` στον καταναλωτή |
 * |---|---|---|
 * | έγκυρο `2142.1.9` | `iscoCode:'2142'` · `iscoGroup:'214'` | `declared` / `undeclared` — **αλήθεια** |
 * | **τίποτα** | `iscoCode:''` · `iscoGroup:''` | `absent` — **σιωπή, και ειλικρινής** |
 * | **σκουπίδι** *(π.χ. `X.1`)* | `iscoCode:'X.1'` **αυτούσιο** · `iscoGroup:''` | `malformed` — **σφάλμα, και ΟΡΑΤΟ** |
 *
 * ⚠️ Το δύσμορφο **δεν ξεπλένεται σε `''`**: αν το ξεπλέναμε, η αλλαγή σχήματος
 * του ESCO θα ταξίδευε ως «σιωπή» και **κανείς δεν θα το μάθαινε ποτέ**. Το
 * κρατάμε αυτούσιο ώστε ο επιλυτής να το ονομάσει σφάλμα, και ο εισαγωγέας το
 * **μετρά και το ανακοινώνει** *(γίνεται `warning` ⇒ banner `⚠️`, όχι `✅`)*.
 * Ότι ένας κωδικός που δεν λύνεται **δεν σπάει τίποτα** είναι ήδη αγκυρωμένο
 * *(ADR-798 §18.5)*.
 *
 * ⚠️ Το `iscoGroup` του δύσμορφου είναι `''`, **όχι** πρόθεμα του σκουπιδιού:
 * ομάδα υπάρχει μόνο αν υπάρχει έγκυρος κωδικός.
 *
 * @module scripts/lib/esco/esco-occupation-document
 */

import { classifyIscoCode, iscoMinorGroupOf } from '../../../src/config/isco-prefix';
import type { EscoOccupationDocument } from '../../../src/types/contacts/esco-types';
import type { EscoSearchResult } from './esco-api';
import {
  escoDocumentBase,
  createLabelTally,
  labelTallyNotes,
  type LabelTally,
} from './esco-document-base';
import type { EscoTransformResult } from './esco-import-runner';

/** Πόσα δείγματα δύσμορφων κωδικών τυπώνονται. Αρκετά για διάγνωση, όχι τοίχος. */
const MALFORMED_SAMPLE_LIMIT = 5;

/**
 * Το **πρώτο τμήμα** του κωδικού ESCO *(«2142.1.9» → «2142»)*.
 *
 * ⚠️ Επιστρέφει `undefined` **μόνο** για γνήσια απουσία. Αν υπάρχει κωδικός αλλά
 * το πρώτο τμήμα είναι κενό *(π.χ. `".1.9"`)*, επιστρέφεται ο **ωμός** κωδικός
 * ώστε να ταξινομηθεί `malformed` — και όχι `absent`, που θα ήταν ψέμα.
 */
export function iscoSegmentOf(code: string | undefined): string | undefined {
  const raw = code?.trim() ?? '';
  if (raw.length === 0) return undefined;
  const segment = raw.split('.')[0];
  return segment.length > 0 ? segment : raw;
}

interface IscoTally {
  declared: number;
  absent: number;
  malformed: number;
  readonly malformedSamples: string[];
}

/** Η ταξινόμηση **ενός** κωδικού, με ενημέρωση της λογιστικής. */
function classifyOccupationCode(
  code: string | undefined,
  tally: IscoTally,
): { iscoCode: string; iscoGroup: string } {
  const verdict = classifyIscoCode(iscoSegmentOf(code));

  if (verdict.kind === 'valid') {
    tally.declared += 1;
    return { iscoCode: verdict.code, iscoGroup: iscoMinorGroupOf(verdict.code) };
  }
  if (verdict.kind === 'absent') {
    tally.absent += 1;
    return { iscoCode: '', iscoGroup: '' };
  }
  tally.malformed += 1;
  if (tally.malformedSamples.length < MALFORMED_SAMPLE_LIMIT) {
    tally.malformedSamples.push(verdict.value);
  }
  return { iscoCode: verdict.value, iscoGroup: '' };
}

/**
 * Μετασχηματίζει έννοιες ESCO σε έγγραφα Firestore, **με κλειστή λογιστική**.
 *
 * ⚠️ Έννοια **χωρίς καμία** ετικέτα παραλείπεται — δεν θα ήταν αναζητήσιμη σε
 * καμία γλώσσα. Η παράλειψη **μετριέται** *(ο δρομέας την τυπώνει)*, ποτέ δεν
 * εξαφανίζεται.
 */
export function transformOccupations(
  concepts: readonly EscoSearchResult[],
): EscoTransformResult<EscoOccupationDocument> {
  const documents: EscoOccupationDocument[] = [];
  const isco: IscoTally = { declared: 0, absent: 0, malformed: 0, malformedSamples: [] };
  const labels: LabelTally = createLabelTally();

  for (const concept of concepts) {
    const base = escoDocumentBase(concept, labels);
    if (base === null) continue;
    documents.push({ ...base, ...classifyOccupationCode(concept.code, isco) });
  }

  return {
    documents,
    notes: [...iscoNotes(isco), ...labelTallyNotes(labels)],
    warnings: iscoWarnings(isco),
  };
}

/** Οι γραμμές λογιστικής ISCO — **πάντα** και οι τρεις καταστάσεις, ακόμη κι αν 0. */
function iscoNotes(tally: IscoTally): string[] {
  return [
    `ISCO: ${tally.declared} με κωδικό · ${tally.absent} χωρίς κωδικό · ${tally.malformed} δύσμορφα`,
  ];
}

/** Δύσμορφος κωδικός = **αλλαγή σχήματος στην πηγή**. Απαιτεί άνθρωπο. */
function iscoWarnings(tally: IscoTally): string[] {
  if (tally.malformed === 0) return [];
  return [
    `${tally.malformed} επαγγέλματα με ΔΥΣΜΟΡΦΟ κωδικό ISCO ` +
      `(δείγμα: ${tally.malformedSamples.join(', ')}) — πιθανή αλλαγή σχήματος του ESCO`,
  ];
}
