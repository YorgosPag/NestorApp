/**
 * Firestore Rules Test Coverage — ΤΟ ΑΝΑΛΛΟΙΩΤΟ ΤΗΣ ΠΛΗΡΟΥΣ ΜΗΤΡΑΣ
 *
 * «**Καμία μήτρα δεν είναι μερική ΣΙΩΠΗΛΑ.**»
 *
 * Κάθε συλλογή δηλώνει **και τα 35 κελιά** (7 πρόσωπα × 5 πράξεις) — είτε ως
 * `CoverageCell` που **εκτελείται** στον emulator, είτε ως `Exemption` που
 * φέρει **λόγο, ιδιοκτήτη και ημερομηνία επανεξέτασης**. Τρίτη επιλογή δεν
 * υπάρχει: η `defineMatrix()` **πετάει** σε χρόνο φόρτωσης του module.
 *
 * ---------------------------------------------------------------------------
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ *(ADR-298 §8 Α21.16 — μετρημένο 2026-09-08)*
 * ---------------------------------------------------------------------------
 *
 * 🔴 Σε **127** συλλογές δηλώνονταν **3.110 από 4.445** κελιά ⇒ **1.335 (30%)
 *    δεν υπήρχαν — και κανείς δεν μπορούσε να τα δει.** Ο `external_user`
 *    ήταν αδήλωτος σε **40 από τους 40** μη πλήρεις builders και ο
 *    `cross_tenant_user` σε **36**. Δηλαδή **δύο πρόσωπα = 82% του κενού**.
 *
 * 🔴 Το κόστος του δεν ήταν θεωρητικό: η τεκμηρίωση της `tenantDirectMatrix()`
 *    έγραφε *«external_user denied entirely»* και ήταν **ψευδής από την πρώτη
 *    μέρα** — ο `external_user` είχε `read + list + create` σε **60 από 60**
 *    κελιά. Ο ισχυρισμός επέζησε **επειδή κανένα κελί δεν τον ρώτησε ΠΟΤΕ**.
 *
 * ⇒ Το κενό **δεν ήταν έλλειψη δουλειάς — ήταν έλλειψη αναλλοίωτου.** Μια
 *   εκστρατεία χειροκίνητων κελιών σε 107 συλλογές θα ξαναπαρήγαγε την ίδια
 *   ανομοιομορφία που τη γέννησε, επειδή τίποτα δεν θα εμπόδιζε την **επόμενη**
 *   μερική μήτρα.
 *
 * ---------------------------------------------------------------------------
 * ΓΙΑΤΙ Ο ΚΑΤΑΣΚΕΥΑΣΤΗΣ ΚΑΙ ΟΧΙ Ο ΜΕΤΑΓΛΩΤΤΙΣΤΗΣ — **ΕΠΑΛΗΘΕΥΜΕΝΟ, ΟΧΙ ΥΠΟΘΕΣΗ**
 * ---------------------------------------------------------------------------
 *
 * Η κομψή εκδοχή θα ήταν τυπική ολότητα: `Record<Persona, Record<Operation, …>>`
 * ⇒ κελί που λείπει = **σφάλμα μεταγλώττισης**. **Μετρήθηκε ότι δεν θα έτρεχε
 * ποτέ**: το root `tsconfig.json` έχει
 *
 *     include: [".next/types/**", "next-env.d.ts", "src/ ** /*.d.ts",
 *               "src/app/ ** /*.ts(x)", "src/middleware.ts", …]
 *
 * — **το `tests/` ΔΕΝ είναι εκεί**. Ούτε το `npm run typecheck` ούτε το
 * pre-commit hook ανοίγουν ποτέ αυτόν τον φάκελο, και το `@swc/jest` πετάει
 * τους τύπους **χωρίς έλεγχο**. Ένας τυπικός φρουρός εδώ θα ήταν φρουρός που
 * **δεν εκτελείται** — ακριβώς η κλάση σφάλματος που αυτό το αρχείο υπάρχει για
 * να κλείσει *(ίδιο σχήμα με το `rulesRange`, ADR-298 Α21.14)*.
 *
 * 🏆 Ο κατασκευαστής είναι **αυστηρότερος**: πετάει σε χρόνο **φόρτωσης**, άρα
 *    το μαθαίνουν ταυτόχρονα και οι **127 σουίτες**, και το probe, και η πύλη
 *    CHECK 3.16 — χωρίς κανένα νέο εργαλείο και χωρίς νέο tsconfig.
 *
 * ---------------------------------------------------------------------------
 * Η ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ (έρευνα 2026-09-08)
 * ---------------------------------------------------------------------------
 *
 *  - **AWS Zelkova / IAM Access Analyzer**: το εργαλείο **δεν αλλάζει την
 *    πολιτική**. Παράγει *finding* και η απόφαση μένει **ανθρώπινη**. Γι' αυτό
 *    εδώ ο `external_user` γίνεται **δηλωμένη εξαίρεση**, όχι μαντεμένο κελί:
 *    *«other techniques guess and check; Zelkova knows»* — και όταν δεν ξέρεις,
 *    **το γράφεις**, δεν το μαντεύεις.
 *  - **DMN decision tables** (Calvanese et al., BPM'16): η ανίχνευση *missing
 *    rules* είναι λειτουργία **του ίδιου του editor**, όχι test — δηλαδή το
 *    κενό οφείλει να είναι αδύνατο να γραφτεί, όχι να ανιχνεύεται εκ των υστέρων.
 *  - **Διαχείριση εξαιρέσεων** (ομόφωνο σε GCP SCC / policy-exception πρακτική):
 *    μια εξαίρεση χωρίς **ιδιοκτήτη και ημερομηνία επανεξέτασης** γίνεται
 *    *exception sprawl* — «προσωρινό» που δεν λήγει ποτέ. Γι' αυτό τα πεδία
 *    `owner` / `since` / `review` είναι **υποχρεωτικά**, όχι διακοσμητικά.
 *
 * ⚠️ **ΜΗΝ κάνεις τη ληγμένη επανεξέταση ⛔ blocking.** Θα σταματούσε δουλειά
 *    σε commit που **δεν άγγιξε τίποτα σχετικό**, μόνο και μόνο επειδή πέρασε
 *    μια ημερομηνία (κλασικό «time bomb»). Το πρότυπο του Chromium για τα
 *    `expires_after` των histograms είναι **προειδοποίηση + ορατότητα**· το ίδιο
 *    κάνει εδώ το CHECK 3.16.
 *
 * @see ADR-298 §8 — Α21.15 / Α21.16
 * @see scripts/check-firestore-rules-test-coverage.js — Validation G
 * @module tests/firestore-rules/_registry/coverage-completeness
 * @since 2026-09-08 (ADR-298 Α21.16)
 */

import type { CoverageCell } from './coverage-manifest';
import type { Operation } from './operations';
import { ALL_OPERATIONS } from './operations';
import type { Persona } from './personas';
import { ALL_PERSONAS } from './personas';

// ---------------------------------------------------------------------------
// Τύποι
// ---------------------------------------------------------------------------

/**
 * Τεκμηρίωση μιας εξαίρεσης — **όλα τα πεδία υποχρεωτικά**.
 *
 * Ένα κελί μπαίνει εδώ όταν η **πρόθεσή** του είναι ανοιχτό ερώτημα, όχι όταν
 * είναι δύσκολο να γραφτεί. Κελί με **λάθος** πρόθεση *μοιάζει* επικυρωμένο και
 * είναι χειρότερο από κελί που λείπει — αυτή η διάκριση είναι ολόκληρος ο λόγος
 * που το `Exemption` δεν είναι απλώς `boolean`.
 */
export interface ExemptionMeta {
  /** Γιατί η πρόθεση είναι ανοιχτή. ΟΧΙ «TODO» — τι πρέπει να αποφασιστεί. */
  readonly why: string;
  /** Ποιος αποφασίζει. Μια εξαίρεση χωρίς ιδιοκτήτη δεν κλείνει ποτέ. */
  readonly owner: string;
  /** Πότε δηλώθηκε (ISO `YYYY-MM-DD`). */
  readonly since: string;
  /** Πότε ξαναρωτιέται (ISO `YYYY-MM-DD`). Μετά από αυτή τη μέρα η πύλη το λέει. */
  readonly review: string;
}

/** Ένα (πρόσωπο × πράξη) κελί που **δηλώθηκε ως ανοιχτό**, με λόγο. */
export interface Exemption extends ExemptionMeta {
  readonly persona: Persona;
  readonly operation: Operation;
}

/**
 * Ό,τι παράγει η `defineMatrix()`: η **εκτελέσιμη** μήτρα και οι **δηλωμένες**
 * εξαιρέσεις. Το άθροισμα των δύο είναι **πάντα** 35 — αλλιώς δεν κατασκευάζεται.
 *
 * ⚠️ Δύο **παραγόμενες προβολές, ΜΙΑ αυθεντία** (μάθημα ADR-749: τέσσερις
 * υλοποιήσεις έδιναν τρεις αριθμούς για το ίδιο δέντρο). Το `matrix` είναι ό,τι
 * **τρέχει** στον emulator· το `exemptions` είναι ό,τι **ομολογείται**.
 */
export interface CoverageDefinition {
  /**
   * Το όνομα του builder που παρήγαγε αυτόν τον ορισμό.
   *
   * 🔑 **Η μονάδα του ratchet, και δεν είναι το `pattern`** — αυτό μετρήθηκε:
   * ένα `RulesPattern` φιλοξενεί **πολλούς** builders (το `tenant_direct` έχει
   * `tenantDirectMatrix`, `crmDirectMatrix`, `attendanceEventMatrix`,
   * `contactRelationshipsMatrix`…) με **διαφορετικά** κενά. Ομαδοποίηση ανά
   * `pattern` έδινε **65** συλλογές «με απόκλιση» — θόρυβος που θα έκρυβε την
   * πραγματική απόκλιση. Ανά builder, το κενό είναι **ομοιόμορφο**: όλες οι
   * συλλογές του ίδιου builder έχουν **ακριβώς** τις ίδιες εξαιρέσεις.
   */
  readonly matrixId: string;
  readonly matrix: readonly CoverageCell[];
  readonly exemptions: readonly Exemption[];
}

const CELL_TOTAL = ALL_PERSONAS.length * ALL_OPERATIONS.length;

/**
 * Ελάχιστο μήκος αιτιολόγησης.
 *
 * Ο αριθμός **δεν είναι αυθαίρετος**: είναι το ίδιο κατώφλι που επιβάλλει ήδη
 * το `.gate-inventory.json` για τον λόγο μιας CI-only πύλης. Ένα «TODO» ή ένα
 * «ανοιχτό» περνάει από ανθρώπινο review και **δεν λέει τίποτα**· 40 χαρακτήρες
 * αναγκάζουν πρόταση.
 */
const MIN_WHY_LENGTH = 40;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Κατασκευαστές
// ---------------------------------------------------------------------------

const keyOf = (persona: Persona, operation: Operation): string =>
  `${persona}:${operation}`;

/**
 * Δηλώνει ένα ορθογώνιο (πρόσωπα × πράξεις) ως **ανοιχτή απόφαση**, με λόγο.
 *
 * Γράφεται ως ορθογώνιο και όχι κελί-κελί επίτηδες: το μετρημένο σχήμα του
 * κενού είναι **ένα ολόκληρο πρόσωπο σε όλες τις πράξεις**, όχι σκόρπια κελιά.
 * Μια δήλωση ⇒ ένας λόγος ⇒ **ένα** σημείο αλλαγής όταν παρθεί η απόφαση.
 */
export function exempt(
  personas: readonly Persona[],
  operations: readonly Operation[],
  meta: ExemptionMeta,
): readonly Exemption[] {
  return personas.flatMap((persona) =>
    operations.map((operation) => ({ persona, operation, ...meta })),
  );
}

/**
 * ΤΟ ΑΝΑΛΛΟΙΩΤΟ. Κατασκευάζει μήτρα **μόνο** αν καλύπτονται και τα 35 κελιά.
 *
 * @param name    Όνομα προτύπου — μπαίνει στο μήνυμα σφάλματος, ώστε η αποτυχία
 *                να λέει **ποιον** builder να ανοίξεις.
 * @param declared Τα κελιά που θα **εκτελεστούν** στον emulator.
 * @param exemptions Τα κελιά που **ομολογούνται ως ανοιχτά**, με λόγο.
 *
 * @throws Αν λείπει κελί, αν δηλωθεί δύο φορές, αν ένα κελί είναι ταυτόχρονα
 *         δηλωμένο και εξαιρεμένο, ή αν μια εξαίρεση δεν φέρει πλήρη λόγο.
 */
export function defineMatrix(
  name: string,
  declared: readonly CoverageCell[],
  exemptions: readonly Exemption[] = [],
): CoverageDefinition {
  const seen = new Map<string, 'declared' | 'exempt'>();

  for (const c of declared) {
    const k = keyOf(c.persona, c.operation);
    if (seen.has(k)) {
      throw new Error(
        `[coverage-completeness] ${name}: το κελί ${k} δηλώνεται ΔΥΟ ΦΟΡΕΣ. ` +
          'Δύο δηλώσεις για το ίδιο κελί σημαίνει ότι μία από τις δύο δεν ' +
          'εκφράζει την πρόθεση κανενός — σβήσε αυτή που περισσεύει.',
      );
    }
    seen.set(k, 'declared');
  }

  for (const e of exemptions) {
    const k = keyOf(e.persona, e.operation);
    const prior = seen.get(k);
    if (prior === 'declared') {
      throw new Error(
        `[coverage-completeness] ${name}: το κελί ${k} είναι ταυτόχρονα ` +
          'ΔΗΛΩΜΕΝΟ και ΕΞΑΙΡΕΜΕΝΟ. Ή ξέρεις την πρόθεση (κράτα το κελί) ή ' +
          'δεν την ξέρεις (κράτα την εξαίρεση) — όχι και τα δύο.',
      );
    }
    if (prior === 'exempt') {
      throw new Error(
        `[coverage-completeness] ${name}: το κελί ${k} εξαιρείται ΔΥΟ ΦΟΡΕΣ, ` +
          'πιθανώς με διαφορετικό λόγο. Ο ένας από τους δύο θα διαβαστεί ποτέ.',
      );
    }
    assertExemptionIsAnswerable(name, e);
    seen.set(k, 'exempt');
  }

  if (seen.size !== CELL_TOTAL) {
    const missing: string[] = [];
    for (const persona of ALL_PERSONAS) {
      for (const operation of ALL_OPERATIONS) {
        const k = keyOf(persona, operation);
        if (!seen.has(k)) missing.push(k);
      }
    }
    throw new Error(
      `[coverage-completeness] ${name}: ΜΕΡΙΚΗ ΜΗΤΡΑ — ` +
        `${seen.size}/${CELL_TOTAL} κελιά. Λείπουν ${missing.length}: ` +
        `${missing.join(', ')}.\n` +
        'Κάθε κελί δηλώνεται είτε ως cell(...) που ΕΚΤΕΛΕΙΤΑΙ, είτε ως ' +
        'exempt([...], [...], { why, owner, since, review }) που ΟΜΟΛΟΓΕΙΤΑΙ. ' +
        'Σιωπή δεν είναι επιλογή — αυτή ακριβώς η σιωπή έκρυβε 1.335 κελιά.',
    );
  }

  return { matrixId: name, matrix: declared, exemptions };
}

/**
 * Επιβάλλει ότι μια εξαίρεση είναι **απαντήσιμη**: έχει λόγο που λέει κάτι,
 * πρόσωπο που αποφασίζει, και μέρα που ξαναρωτιέται.
 */
function assertExemptionIsAnswerable(name: string, e: Exemption): void {
  const where = `${name}: εξαίρεση ${keyOf(e.persona, e.operation)}`;

  if (e.why.trim().length < MIN_WHY_LENGTH) {
    throw new Error(
      `[coverage-completeness] ${where}: το \`why\` έχει ` +
        `${e.why.trim().length} χαρακτήρες (ελάχιστο ${MIN_WHY_LENGTH}). ` +
        'Γράψε ΤΙ πρέπει να αποφασιστεί, όχι ότι εκκρεμεί.',
    );
  }
  if (e.owner.trim().length === 0) {
    throw new Error(
      `[coverage-completeness] ${where}: λείπει \`owner\`. ` +
        'Εξαίρεση χωρίς ιδιοκτήτη δεν κλείνει ποτέ.',
    );
  }
  for (const [field, value] of [
    ['since', e.since],
    ['review', e.review],
  ] as const) {
    if (!ISO_DATE.test(value)) {
      throw new Error(
        `[coverage-completeness] ${where}: το \`${field}\` («${value}») δεν ` +
          'είναι ISO ημερομηνία `YYYY-MM-DD`.',
      );
    }
  }
  if (e.review <= e.since) {
    throw new Error(
      `[coverage-completeness] ${where}: \`review\` (${e.review}) δεν είναι ` +
        `μετά το \`since\` (${e.since}). Εξαίρεση που «λήγει» πριν δηλωθεί ` +
        'δεν θα ξαναρωτηθεί ποτέ.',
    );
  }
}

/**
 * Νέος ορισμός με συγκεκριμένα κελιά αντικατεστημένα.
 *
 * Διάδοχος του `overrideCells` για ορισμούς: μια συλλογή που **ξέρει** την
 * πρόθεση ενός κελιού που το πρότυπό της αφήνει ανοιχτό, το δηλώνει εδώ — και
 * η εξαίρεση **φεύγει αυτόματα**, χωρίς να χρειάζεται να τη θυμηθεί κανείς.
 * Αυτή η αυτόματη αφαίρεση είναι ο λόγος που το ratchet μπορεί να πέσει.
 */
export function overrideDefinition(
  base: CoverageDefinition,
  overrides: readonly CoverageCell[],
  /**
   * Νέο `matrixId` όταν ο ορισμός γίνεται **δικό του πρότυπο** (π.χ.
   * `crmDirectMatrix` πάνω στο `tenantDirectMatrix`). Παραλείπεται όταν η
   * υπέρβαση είναι **απόκλιση μιας συλλογής** — τότε πρέπει να κληρονομηθεί το
   * id του προτύπου, ώστε η απόκλιση να **φαίνεται** ως απόκλιση.
   */
  as?: string,
): CoverageDefinition {
  const overridden = new Set(overrides.map((c) => keyOf(c.persona, c.operation)));
  return {
    matrixId: as ?? base.matrixId,
    matrix: [
      ...base.matrix.filter((c) => !overridden.has(keyOf(c.persona, c.operation))),
      ...overrides,
    ],
    exemptions: base.exemptions.filter(
      (e) => !overridden.has(keyOf(e.persona, e.operation)),
    ),
  };
}
