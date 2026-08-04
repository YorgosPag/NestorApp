/**
 * @fileoverview Λ2 — το κελί «ΘΕΣΗ» → διοικητικά πεδία του έργου (ADR-745 Φ3β, §7).
 *
 * Το κελί είναι **μία** πρόταση κειμένου με πολλές έννοιες μέσα:
 *
 * > `ΔΗΜΟΣ ΚΟΡΔΕΛΙΟΥ ΕΥΟΣΜΟΥ - Δ.Ε. ΕΥΟΣΜΟΥ - ΠΕΡΙΟΧΗ ΕΠΕΚΤΑΣΗΣ ΕΥΟΣΜΟΥ Π.Ε. 39 - Ο.Τ. Γ 753 -
 * >  ΟΙΚ.: 01β - Οδός Προέκταση Σμύρνης, Δημ. Κολοκυθά, Ξενοκράτη & Αναγεννήσεως`
 *
 * Ο τεμαχισμός **δεν** γίνεται στους παύλες: ο διαχωριστής είναι σύμβαση του συντάκτη και το
 * `Π.Ε. 39` κάθεται **μέσα** στο ίδιο τμήμα με την περιοχή. Γίνεται στις **σημαδούρες**: κάθε
 * αναγνωρισμένη ετικέτα ανοίγει τμήμα που κλείνει στην επόμενη. Ίδιος μηχανισμός λέξη-προς-λέξη
 * με τον Λ1 (`containsWordSequence`), οπότε οι δύο αναγνώσεις **δεν μπορούν να αποκλίνουν**.
 *
 * Οι σημαδούρες είναι **δεδομένα αναγνώρισης**, όχι κείμενο διεπαφής — δεν περνούν από `t()`
 * (§8 κανόνας 7): αν μεταφράζονταν, το ίδιο αρχείο θα διαβαζόταν αλλιώς σε αγγλικό περιβάλλον.
 *
 * @module lib/title-block/resolve-location
 */

import { matchesWordSequenceAt, normalizeForLabelMatch, splitIntoWords } from '@/utils/greek-text';
import type { BindingProposal, BindingTarget } from '@/types/title-block-binding';
import type { TitleBlockField } from '@/types/title-block-reading';

/** Πού προσγειώνεται μια αναγνωρισμένη ενότητα — ή `null` όταν συνειδητά **δεν** προσγειώνεται. */
type LocationSlot = 'municipality' | 'neighborhood' | 'buildingBlock' | null;

interface LocationMarker {
  /** Οι λέξεις της σημαδούρας, σε μορφή σύγκρισης. */
  readonly phrase: readonly string[];
  readonly slot: LocationSlot;
  /** Μένει η σημαδούρα μέσα στην τιμή; (`Ο.Τ. Γ 753` ναι· `ΔΗΜΟΣ Χ` όχι — το πεδίο λέγεται ήδη έτσι.) */
  readonly keepMarker: boolean;
}

const marker = (text: string, slot: LocationSlot, keepMarker = false): LocationMarker => ({
  phrase: splitIntoWords(text).map((w) => w.normalized),
  slot,
  keepMarker,
});

/**
 * Ο κατάλογος αναγνώρισης.
 *
 * 🔴 **Το `Π.Ε.` αναγνωρίζεται αλλά ΔΕΝ προσγειώνεται, και αυτό είναι απόφαση — όχι παράλειψη.**
 * Το ADR-745 §7 το αντιστοιχίζει σε `ProjectAddress.regionalUnit` (**Περιφερειακή** Ενότητα).
 * Σε τοπογραφικό διάγραμμα όμως το `Π.Ε. 39` είναι **Πολεοδομική** Ενότητα — ένας αριθμημένος
 * τομέας σχεδίου πόλης. Οι Περιφερειακές Ενότητες έχουν **ονόματα** («Θεσσαλονίκης»), ποτέ
 * αριθμούς. Γράφοντας «39» στο `regionalUnit` θα βάζαμε στη βάση **ψέμα με σωστή μορφή**, που
 * είναι χειρότερο από κενό (§8 κανόνας 1). Εμφανίζεται στον άνθρωπο ως αναγνωρισμένο-αλλά-άδετο.
 */
const LOCATION_MARKERS: readonly LocationMarker[] = [
  marker('ΔΗΜΟΣ', 'municipality'),
  marker('ΠΕΡΙΟΧΗ', 'neighborhood', true),
  marker('Ο.Τ.', 'buildingBlock', true),
  // ── Αναγνωρισμένες αλλά ΑΔΕΤΕΣ ενότητες ────────────────────────────────────────────────
  // 🔑 Δεν είναι «για πληρότητα»: **κάθε σημαδούρα τερματίζει την προηγούμενη**. Χωρίς αυτές
  // τις τέσσερις, το `Ο.Τ.` ρουφούσε ολόκληρη την υπόλοιπη πρόταση («Ο.Τ. Γ 753 - ΟΙΚ.: 01β -
  // Οδός Προέκταση Σμύρνης, …») και θα γραφόταν **αυτό** στο `Project.buildingBlock`. Ακριβώς
  // το σχήμα του §6.3 του ADR: η παράλειψη ενός κλειδιού δεν αφήνει πεδίο κενό — **μολύνει το
  // διπλανό**, και το αποτέλεσμα διαβάζεται απόλυτα εύλογα.
  marker('Δ.Ε.', null, true), // Δημοτική Ενότητα — δεν υπάρχει πεδίο υποδοχής
  marker('Π.Ε.', null, true), // βλ. σχόλιο παραπάνω: πολεοδομική, όχι περιφερειακή
  marker('ΟΙΚ.', null, true), // αριθμός οικοπέδου — ανήκει στο ακίνητο, όχι στη διεύθυνση
  marker('Οδός', null, true), // πρόσωπα οικοπέδου → `PlotFrontage[]`, δουλειά της Φ4
];

export interface LocationResolveContext {
  readonly projectId: string;
  readonly titleBlockIndex: number;
}

interface LocationSegment {
  readonly slot: LocationSlot;
  readonly value: string;
}

/** Τα τμήματα που αναγνωρίζει το κελί, με τη σειρά που εμφανίζονται. */
export function splitLocationValue(text: string): LocationSegment[] {
  const words = splitIntoWords(text);
  const hits: { at: number; marker: LocationMarker }[] = [];

  for (let i = 0; i < words.length; i += 1) {
    // Ο πρώτος κατάλογος που ταιριάζει κερδίζει τη θέση· δύο σημαδούρες δεν ξεκινούν στην ίδια
    // λέξη, οπότε δεν χρειάζεται προτεραιότητα μήκους (σε αντίθεση με τις ετικέτες του Λ1).
    const found = LOCATION_MARKERS.find((m) => matchesWordSequenceAt(words, i, m.phrase));
    if (found) hits.push({ at: i, marker: found });
  }

  const segments: LocationSegment[] = [];
  hits.forEach((hit, k) => {
    const from = hit.at + (hit.marker.keepMarker ? 0 : hit.marker.phrase.length);
    const until = k + 1 < hits.length ? hits[k + 1].at : words.length;
    if (from >= until) return;
    const value = text.slice(words[from].start, words[until - 1].end).trim();
    // Ένα σκέτο διαχωριστικό ανάμεσα σε δύο σημαδούρες δεν είναι τιμή.
    if (normalizeForLabelMatch(value).length === 0) return;
    segments.push({ slot: hit.marker.slot, value });
  });

  return segments;
}

function targetFor(
  segment: LocationSegment,
  context: LocationResolveContext,
): BindingTarget | null {
  if (segment.slot === null) return null;
  if (segment.slot === 'buildingBlock') {
    return { kind: 'project-field', projectId: context.projectId, field: 'buildingBlock', value: segment.value };
  }
  return {
    kind: 'project-address',
    projectId: context.projectId,
    field: segment.slot,
    value: segment.value,
  };
}

/**
 * Μία πρόταση **ανά αναγνωρισμένη ενότητα** — όχι μία για ολόκληρο το κελί.
 *
 * Ο άνθρωπος μπορεί να δεχτεί τον δήμο και να απορρίψει την περιοχή· ένα ενιαίο «ναι/όχι» θα τον
 * ανάγκαζε να διαλέξει ανάμεσα σε σωστό και λάθος δεδομένο.
 */
export function resolveLocationProposals(
  field: TitleBlockField,
  context: LocationResolveContext,
): BindingProposal[] {
  return splitLocationValue(field.rawValue).map((segment) => {
    const base = {
      fieldKey: field.key,
      titleBlockIndex: context.titleBlockIndex,
      sourceHandle: field.sourceHandle,
      labelHandle: field.labelHandle,
      at: field.at,
      snapshotValue: segment.value,
    } as const;

    const target = targetFor(segment, context);
    if (!target) return { ...base, candidates: [], blockedBy: 'unsupported-field' as const };

    return {
      ...base,
      candidates: [{ target, label: segment.value, evidence: [] }],
    };
  });
}
