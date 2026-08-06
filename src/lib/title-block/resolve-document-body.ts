/**
 * @fileoverview Λ2 — τα **έγγραφα του σχεδίου** → προτάσεις σύνδεσης (ADR-759 §4.6, Άξονας Α).
 *
 * Ο τρίτος καλών της ίδιας μηχανής: `proposalBase` για τον σκελετό, `buildSurveyProposal` για
 * τον προορισμό στο τοπογραφικό, `parseSurveyValue` για την τιμή. **Καμία νέα διαδρομή προς τη
 * βάση** — ό,τι γράφεται, γράφεται από τον υπάρχοντα writer, μετά από κλικ ανθρώπου.
 *
 * ## 🔴 Η συγχώνευση μαρτύρων — και γιατί δεν είναι «αφαίρεση διπλότυπων»
 *
 * Το ίδιο φύλλο δηλώνει το εμβαδόν του οικοπέδου **τρεις φορές**, σε τρία αυτοτελή έγγραφα, με
 * τρεις διαφορετικές γραφές του ίδιου αριθμού (`1.364,05` · `1364,05` · `1.364,05`). Τρεις
 * πανομοιότυπες γραμμές στην παλέτα είναι θόρυβος· **μία** γραμμή που λέει «το λένε 3 έγγραφα»
 * είναι πληροφορία που κανένα εμπορικό CAD δεν δίνει.
 *
 * ⚠️ **Η συγχώνευση γίνεται στην ΑΝΑΛΥΜΕΝΗ τιμή, όχι στο κείμενο.** Τα τρία κείμενα διαφέρουν
 * ως χαρακτήρες και ταυτίζονται ως αριθμοί — σύγκριση κειμένου θα έβγαζε τρεις «διαφωνούντες»
 * μάρτυρες που στην πραγματικότητα συμφωνούν απόλυτα.
 *
 * ⚠️ **Μάρτυρες που ΔΙΑΦΩΝΟΥΝ δεν συγχωνεύονται ποτέ**: παράγονται χωριστές γραμμές και
 * διαλέγει ο άνθρωπος. Η αυτόματη επιλογή νικητή ανάμεσα σε δύο διαφορετικές τιμές είναι
 * ακριβώς το «ψέμα με σωστή μορφή» του §2β.5.
 *
 * @module lib/title-block/resolve-document-body
 */

import { parseSurveyValue, type BindableSurveyField } from '@/config/survey-bindable-fields';
import type {
  DocumentBodyField,
  DocumentBodyFieldKey,
  DocumentBodyReading,
} from '@/types/document-body-reading';
import type {
  BindableAddressField,
  BindingProposal,
  BindingSourceKind,
  BindingTarget,
} from '@/types/title-block-binding';
import { proposalBase, type ProposalBase } from './proposal-base';
import { buildSurveyProposal, type SurveySnapshot } from './resolve-survey-record';

/**
 * 🔴 **Ο μοναδικός παραγωγός του `'document-body'`** (ADR-759 §4.6).
 *
 * Το λεξιλόγιο `BINDING_SOURCE_KINDS` προστέθηκε στη Φ3γ **προκαταβολικά** και έμεινε με μηδέν
 * παραγωγούς — δηλωμένη κατάσταση που κανείς δεν παράγει, δηλαδή ακριβώς το ελάττωμα που κυνηγά
 * όλη η αλυσίδα ADR-745/759 (§4.4.1). Εδώ κλείνει, **μία φορά**: τρεις χωριστές αναγραφές θα
 * ήταν τρία σημεία που μπορούν να αποκλίνουν, και η πύλη θα έμενε πράσινη με τα δύο από τα τρία.
 */
const BODY_SOURCE: BindingSourceKind = 'document-body';

/** Πού προσγειώνεται ό,τι λέει το σώμα. */
type BodyDestination =
  | { readonly to: 'survey'; readonly field: BindableSurveyField }
  | { readonly to: 'address'; readonly field: BindableAddressField };

/**
 * «Τι διάβασα» → «πού πάει».
 *
 * 🔑 **Ήταν ρητός χάρτης 27 γραμμών, και ήταν boilerplate**: το λεξιλόγιο ανάγνωσης
 * **παράγεται** από το `BINDABLE_SURVEY_FIELDS` (δες `types/document-body-reading.ts`), άρα
 * κάθε κλειδί εκτός του `regionalUnit` **είναι** πεδίο τοπογραφικού εξ ορισμού.
 *
 * ⚠️ Ο έλεγχος δεν χαλάρωσε: αν αύριο προστεθεί δεύτερο κλειδί εκτός τοπογραφικού, ο τύπος
 * του `key` στον κλάδο `else` **παύει να είναι** `BindableSurveyField` και ο μεταγλωττιστής
 * απαιτεί απόφαση — ακριβώς ό,τι έκανε ο ρητός `Record<…>`, χωρίς 27 γραμμές αντιγραφής.
 *
 * Το `regionalUnit` δεν πάει στο τοπογραφικό: η Περιφερειακή Ενότητα είναι ιδιότητα της
 * **διεύθυνσης του έργου** (ADR-745 §7) και το `ProjectAddress` τη γράφει «Π.Ε. Θεσσαλονίκης».
 */
function destinationOf(key: DocumentBodyFieldKey): BodyDestination {
  return key === 'regionalUnit' ? { to: 'address', field: key } : { to: 'survey', field: key };
}

export interface DocumentBodyResolveContext {
  /** Απόν όταν το σχέδιο δεν είναι δεμένο σε έργο — όλα τότε **δηλώνονται** κλειστά. */
  readonly projectId?: string;
  /** Δες {@link LocationResolveContext.hasPrimaryAddress}: `undefined` = άγνωστο ⇒ δεν μπλοκάρουμε. */
  readonly hasPrimaryAddress?: boolean;
  readonly survey?: SurveySnapshot;
}

// ── Μάρτυρες ──────────────────────────────────────────────────────────────────

interface Witness {
  readonly field: DocumentBodyField;
  readonly reading: DocumentBodyReading;
}

/**
 * Η **ταυτότητα της δήλωσης**: πού πάει και τι λέει, αφού αναλυθεί.
 *
 * Το `JSON.stringify` πάνω σε αναλυμένη τιμή είναι σταθερό: η `SurveyParsedValue` έχει δύο
 * κλειδιά με δηλωμένη σειρά και τιμές που είναι πρωτογενείς ή πίνακας συμβολοσειρών.
 */
function statementKey(key: DocumentBodyFieldKey, rawValue: string): string {
  const destination = destinationOf(key);
  if (destination.to === 'address') return `address:${destination.field}:${rawValue.trim()}`;
  const parsed = parseSurveyValue(destination.field, rawValue);
  return `survey:${destination.field}:${JSON.stringify(parsed)}`;
}

/**
 * Ομαδοποιεί ό,τι λέει **το ίδιο πράγμα**, κρατώντας τον πρώτο μάρτυρα και το πλήθος.
 *
 * Ο «πρώτος» ορίζεται από τη σειρά των εγγράφων, που είναι ντετερμινιστική (σειρά προφίλ,
 * μετά θέση) — άρα δύο ανοίγματα του ίδιου σχεδίου δείχνουν την ίδια γραμμή.
 */
function mergeWitnesses(
  readings: readonly DocumentBodyReading[],
): { readonly witness: Witness; readonly corroboration: number }[] {
  const groups = new Map<string, { witness: Witness; corroboration: number }>();

  for (const reading of readings) {
    for (const field of reading.fields) {
      const key = statementKey(field.key, field.rawValue);
      const existing = groups.get(key);
      if (existing) {
        groups.set(key, { ...existing, corroboration: existing.corroboration + 1 });
        continue;
      }
      groups.set(key, { witness: { field, reading }, corroboration: 1 });
    }
  }

  return [...groups.values()];
}

// ── Προτάσεις ─────────────────────────────────────────────────────────────────

/**
 * Ο σκελετός μιας πρότασης του σώματος.
 *
 * 🔑 **Η ετικέτα και η τιμή είναι το ίδιο MTEXT** — σε αντίθεση με την πινακίδα, όπου είναι
 * δύο κελιά. Άρα `sourceHandle === labelHandle`, και το overlay της Φ4 θα φωτίσει ολόκληρο
 * το έγγραφο· αυτό είναι σωστό: η τιμή **δεν έχει** δικό της πλαίσιο μέσα στην πρόζα.
 *
 * Ο δείκτης πινακίδας είναι `0` γιατί δεν υπάρχει πινακίδα — και **δεν** μπαίνει στο κλειδί
 * έγκρισης, που χτίζεται από τη **γεωμετρία** (`lib/title-block-binding-id`).
 */
function baseFor(witness: Witness): ProposalBase & { readonly layerName: string } {
  return {
    ...proposalBase(
      {
        key: witness.field.key,
        rawValue: witness.field.rawValue,
        sourceHandle: witness.reading.handle,
        labelHandle: witness.reading.handle,
        at: witness.reading.at,
      },
      0,
    ),
    // Τα έγγραφα ζουν σε **δύο** layers στο ίδιο φύλλο· η πρόταση κουβαλά το δικό της.
    layerName: witness.reading.layerName,
  };
}

function addressProposal(
  base: ProposalBase,
  field: BindableAddressField,
  value: string,
  context: DocumentBodyResolveContext,
  corroboration: number,
): BindingProposal {
  const shell = { ...base, sourceKind: BODY_SOURCE, corroboration };
  if (!context.projectId) return { ...shell, candidates: [], blockedBy: 'no-project' };
  // Ο ίδιος φύλακας με το `resolve-location`: εμπλουτίζουμε **υπάρχουσα** κύρια διεύθυνση,
  // δεν εφευρίσκουμε νέα — και η απάντηση είναι γνωστή **πριν** το κλικ.
  if (context.hasPrimaryAddress === false) {
    return { ...shell, candidates: [], blockedBy: 'no-primary-address' };
  }

  const target: BindingTarget = {
    kind: 'project-address',
    projectId: context.projectId,
    field,
    value,
  };
  // Κενή μαρτυρία επίτηδες: δεν τίθεται ερώτημα ταυτότητας — είναι τιμή που διαβάστηκε.
  return { ...shell, candidates: [{ target, label: value, evidence: [] }] };
}

function proposalFor(
  witness: Witness,
  corroboration: number,
  context: DocumentBodyResolveContext,
): BindingProposal {
  const base = baseFor(witness);
  const destination = destinationOf(witness.field.key);

  if (destination.to === 'address') {
    return addressProposal(base, destination.field, witness.field.rawValue, context, corroboration);
  }

  if (!context.projectId) {
    return {
      ...base,
      sourceKind: BODY_SOURCE,
      corroboration,
      candidates: [],
      blockedBy: 'no-project',
    };
  }

  return buildSurveyProposal(base, {
    projectId: context.projectId,
    field: destination.field,
    rawText: witness.field.rawValue,
    snapshot: context.survey,
    sourceKind: BODY_SOURCE,
    corroboration,
  });
}

/**
 * Όλες οι προτάσεις που γεννούν τα έγγραφα ενός σχεδίου.
 *
 * **Καμία δεν εξαφανίζεται**: κλειστός προορισμός ⇒ μπλοκαρισμένη γραμμή με δηλωμένη αιτία.
 * Γραμμή που λείπει είναι σιωπηλή απώλεια (ADR-745 §8 κανόνας 3).
 */
export function resolveDocumentBodyProposals(
  readings: readonly DocumentBodyReading[],
  context: DocumentBodyResolveContext,
): BindingProposal[] {
  return mergeWitnesses(readings).map((group) =>
    proposalFor(group.witness, group.corroboration, context),
  );
}
