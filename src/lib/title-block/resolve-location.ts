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
import type {
  BindableAddressField,
  BindableProjectField,
  BindingBlockReason,
  BindingProposal,
  BindingTarget,
} from '@/types/title-block-binding';
import type { TitleBlockField } from '@/types/title-block-reading';
import { splitFrontageStreets } from './frontage-streets';

/**
 * Πού καταλήγει μια αναγνωρισμένη ενότητα — **τέσσερις** εκβάσεις, όχι δύο (ADR-759 §2.2).
 *
 * 🔑 Η ένωση αντικατέστησε ένα `slot: … | null`, όπου το `null` σήμαινε «δεν προσγειώνεται» για
 * **τέσσερις εντελώς διαφορετικούς λόγους**. Αυτό ήταν ολόκληρο το κεντρικό εύρημα του ADR: μία
 * τιμή, τέσσερις αιτίες, ένα μήνυμα στον χρήστη.
 */
type LocationSlot =
  /** Εμπλουτίζει την **κύρια** διεύθυνση του έργου (ADR-167/332) — ποτέ δεν φτιάχνει νέα. */
  | { readonly to: 'address'; readonly field: BindableAddressField }
  /** Βαθμωτό πεδίο του ίδιου του έργου (Ο.Τ., αριθμός οικοπέδου). */
  | { readonly to: 'project'; readonly field: BindableProjectField }
  /** Αναγνωρίστηκε, δεν γράφεται — με **ρητή, διακριτή** αιτία. */
  | { readonly to: 'blocked'; readonly reason: BindingBlockReason }
  /** Λίστα οδών: **μία πρόταση ανά πρόσωπο οικοπέδου**, όχι μία για όλες. */
  | { readonly to: 'frontages' };

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
 * 🔴 **Το `Π.Ε.` αναγνωρίζεται αλλά ΔΕΝ γράφεται — και ο λόγος ΑΛΛΑΞΕ στη Φ3, χωρίς να αλλάξει
 * η συμπεριφορά.** Το ADR-745 §7 και η προηγούμενη γραφή αυτού του σχολίου το αιτιολογούσαν ως
 * «**Πολεοδομική** Ενότητα, όχι Περιφερειακή». Η §2β.3 του ADR-759 **μέτρησε το αρχείο** και το
 * διέψευσε: το ίδιο έγγραφο γράφει *«στην 39 Π.Ε., των **Πολεοδομικών Ενοτήτων 16 και 17**»* —
 * δηλαδή οι πολεοδομικές ενότητες δηλώνονται ρητά ως 16 και 17, άρα το 39 δεν είναι καμία από
 * αυτές. Είναι **Πράξη Εφαρμογής 39** (γραμμένο τρεις φορές ολογράφως στο σώμα), και το πεδίο
 * υποδοχής **υπάρχει ήδη** από τη Φ2: `SurveyRecord.implementationAct.number`.
 *
 * ⇒ Άρα δεν είναι `unsupported-field` («κανείς δεν το ζητά») **ούτε** `resolver-gap` («λείπει
 * κώδικας»): είναι **`ambiguous-abbreviation`** — τρεις σημασίες του ίδιου ακρωνυμίου στο ίδιο
 * σχέδιο, και η μορφή **δεν** αποφασίζει. Το λύνει το συμφραζόμενο (Φ4/Φ5), όχι ο resolver.
 * Ο κανόνας που προκύπτει είναι κλάσης, όχι δείγματος: *όταν ένα ακρωνύμιο έχει >1 σημασία στο
 * ίδιο έγγραφο, καμία απόφαση δεν βγαίνει από τη μορφή.*
 */
const LOCATION_MARKERS: readonly LocationMarker[] = [
  marker('ΔΗΜΟΣ', { to: 'address', field: 'municipality' }),
  marker('ΠΕΡΙΟΧΗ', { to: 'address', field: 'neighborhood' }, true),
  marker('Ο.Τ.', { to: 'project', field: 'buildingBlock' }, true),
  // ── Φ3: οι τρεις που απέκτησαν πεδίο, και η μία που δεν πρόκειται ──────────────────────
  // 🔑 Ο κατάλογος ΔΕΝ μίκρυνε, και δεν έπρεπε: **κάθε σημαδούρα τερματίζει την προηγούμενη**.
  // Χωρίς αυτές τις τέσσερις, το `Ο.Τ.` ρουφούσε ολόκληρη την υπόλοιπη πρόταση («Ο.Τ. Γ 753 -
  // ΟΙΚ.: 01β - Οδός Προέκταση Σμύρνης, …») και θα γραφόταν **αυτό** στο `Project.buildingBlock`.
  // Το §6.3 του ADR-745: η παράλειψη ενός κλειδιού δεν αφήνει πεδίο κενό — **μολύνει το διπλανό**,
  // και το αποτέλεσμα διαβάζεται απόλυτα εύλογα.

  // Δημοτική Ενότητα → η κύρια διεύθυνση. **Κρατά** τη σημαδούρα, όπως το αδελφό της
  // `regionalUnit` που το ίδιο το `ProjectAddress` τεκμηριώνει ως «Π.Ε. Θεσσαλονίκης» — και όπως
  // το γράφει ήδη το domain επαφών («Δ.Ε. Θεσσαλονίκης»). Ένα λεξιλόγιο, μία μορφή.
  marker('Δ.Ε.', { to: 'address', field: 'municipalUnit' }, true),
  // Πράξη Εφαρμογής μεταμφιεσμένη σε ακρωνύμιο — βλ. το μπλοκ παραπάνω.
  marker('Π.Ε.', { to: 'blocked', reason: 'ambiguous-abbreviation' }, true),
  // Αριθμός οικοπέδου → `Project.plotNumber`. **ΔΕΝ** κρατά τη σημαδούρα, σε αντίθεση με το
  // Ο.Τ. από πάνω, και η ασυμμετρία είναι μετρημένη: ο καταναλωτής
  // (`lib/obligations/content.ts:25`) τυπώνει **δική του** ετικέτα «Αριθμός Οικοπέδου:», οπότε
  // το «ΟΙΚ.:» θα εμφανιζόταν δύο φορές. Το «Ο.Τ. Γ 753» αντίθετα τυπώνεται αυτούσιο.
  marker('ΟΙΚ.', { to: 'project', field: 'plotNumber' }, false),
  // Πρόσωπα οικοπέδου → `PlotFrontage[]`: το πεδίο **υπάρχει** (ADR-186 Φ2.5), λείπει η σύνδεση.
  marker('Οδός', { to: 'frontages' }, false),
];

export interface LocationResolveContext {
  readonly projectId: string;
  readonly titleBlockIndex: number;
  /**
   * Έχει το έργο **κύρια** διεύθυνση να εμπλουτιστεί;
   *
   * `undefined` = **δεν το ξέρουμε ακόμη** (η ανάγνωση έργου δεν ολοκληρώθηκε ή απέτυχε), και
   * τότε **δεν** μπλοκάρουμε: ο φύλακας τη στιγμή του κλικ (`apply-project-value.ts`) παραμένει
   * και είναι η αυθεντία. Ένα `boolean` με προεπιλογή `false` θα μετέτρεπε μια αποτυχία δικτύου
   * σε «το έργο δεν έχει διεύθυνση» — λάθος συμπέρασμα με σωστή μορφή.
   */
  readonly hasPrimaryAddress?: boolean;
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

/** Ο σκελετός μιας πρότασης — ό,τι δεν εξαρτάται από την έκβαση της ενότητας. */
type ProposalBase = Omit<BindingProposal, 'candidates' | 'blockedBy'>;

const baseFor = (
  field: TitleBlockField,
  context: LocationResolveContext,
  snapshotValue: string,
): ProposalBase => ({
  fieldKey: field.key,
  titleBlockIndex: context.titleBlockIndex,
  sourceHandle: field.sourceHandle,
  labelHandle: field.labelHandle,
  at: field.at,
  snapshotValue,
});

const blocked = (base: ProposalBase, reason: BindingBlockReason): BindingProposal => ({
  ...base,
  candidates: [],
  blockedBy: reason,
});

const proposing = (base: ProposalBase, target: BindingTarget, label: string): BindingProposal => ({
  ...base,
  // Κενή μαρτυρία **επίτηδες**: δεν τίθεται ερώτημα ταυτότητας — ο δήμος δεν «ταιριάζει» με
  // κάποια οντότητα, είναι τιμή που διαβάστηκε και ζητά έγκριση για να γραφτεί.
  candidates: [{ target, label, evidence: [] }],
});

/**
 * Οι προτάσεις **μιας** αναγνωρισμένης ενότητας — συνήθως μία, για τις οδούς όσες και τα πρόσωπα.
 */
function proposalsForSegment(
  segment: LocationSegment,
  field: TitleBlockField,
  context: LocationResolveContext,
): BindingProposal[] {
  const { slot, value } = segment;

  if (slot.to === 'blocked') return [blocked(baseFor(field, context, value), slot.reason)];

  if (slot.to === 'frontages') {
    // 🔴 **Μία γραμμή ανά οδό, ΟΧΙ μία για όλες.** Το ADR-745 §7 μέτρησε **4 πρόσωπα** και το
    // `frontagesCount` του ADR-186 τα περιμένει ένα-ένα. Μια ενιαία γραμμή «4 οδοί» θα έκρυβε
    // ακριβώς την πληροφορία που κάνει το χρέος μετρήσιμο: **πόσα** πρόσωπα δεν συνδέονται.
    return splitFrontageStreets(value).map((street) =>
      blocked(baseFor(field, context, street), 'resolver-gap'),
    );
  }

  const base = baseFor(field, context, value);

  if (slot.to === 'project') {
    return [
      proposing(
        base,
        { kind: 'project-field', projectId: context.projectId, field: slot.field, value },
        value,
      ),
    ];
  }

  // 🔴 **Ο έλεγχος κύριας διεύθυνσης ΠΡΙΝ το κλικ, όχι μετά.** Ο φύλακας υπήρχε ήδη στο
  // `apply-project-value.ts:65` και επέστρεφε `NO_PRIMARY_ADDRESS` **αφού** ο άνθρωπος πατούσε
  // Έγκριση — ενώ η απάντηση ήταν γνωστή από την ώρα που άνοιξε η παλέτα. Η κατάσταση
  // `no-primary-address` υπήρχε στον τύπο, στο `BLOCKED_LABEL` και σε el+en, και **κανείς δεν
  // την παρήγαγε ποτέ** (ADR-759 §4.4). Εδώ αποκτά τον παραγωγό της.
  if (context.hasPrimaryAddress === false) return [blocked(base, 'no-primary-address')];

  return [
    proposing(
      base,
      { kind: 'project-address', projectId: context.projectId, field: slot.field, value },
      value,
    ),
  ];
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
  return splitLocationValue(field.rawValue).flatMap((segment) =>
    proposalsForSegment(segment, field, context),
  );
}
