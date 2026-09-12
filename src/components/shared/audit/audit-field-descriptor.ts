/**
 * ADR-852 **Φ2** — Η ΕΤΙΚΕΤΑ: **ζωντανή επίλυση**, με **τίμιο** στιγμιότυπο.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΑΠΑΝΤΑ
 *
 *   ✅ *«πώς λέγεται αυτό το πεδίο **στη γλώσσα αυτού που κοιτάζει, τώρα** — και αν
 *       δεν ξέρουμε πια, τι λέμε **χωρίς να το κρύψουμε**;»*
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 **ΤΟ ΔΙΠΛΟ ΚΑΝΑΛΙ, ΚΑΙ ΓΙΑΤΙ ΚΑΜΙΑ ΑΠΟ ΤΙΣ ΔΥΟ ΚΑΘΑΡΕΣ ΛΥΣΕΙΣ ΔΕΝ ΑΡΚΕΙ**
 * *(ADR-852 §3.1 — εδώ ξεπερνάμε τους μεγάλους, και ο λόγος είναι δομικός)*
 *
 * Η **Revit** λύνει ετικέτες **ζωντανά** (`LabelUtils.GetLabelFor`) και έχει δίκιο: το
 * μοντέλο της είναι **ζωντανό**. Το **ArchiCAD** αποθηκεύει **στιγμιότυπο** ονόματος
 * (`AC_Pset_*`) και έχει κι αυτό δίκιο για τον δικό του σκοπό.
 *
 * Το ιστορικό αλλαγών όμως είναι **χρονικό αρχείο**, και εκεί:
 *   · **μόνο ζωντανά** ⇒ μια μετονομασία πεδίου **ξαναγράφει το παρελθόν**·
 *   · **μόνο στιγμιότυπο** ⇒ το ιστορικό **παγώνει σε μία γλώσσα**, και καμία
 *     μελλοντική βελτίωση μετάφρασης δεν το αγγίζει ποτέ.
 *
 * Άρα: **λύνε ζωντανά, και πέσε στο στιγμιότυπο ΜΟΝΟ όταν το μητρώο δεν ξέρει πια το
 * πεδίο — και τότε ΠΕΣ ΤΟ.** Ένα στιγμιότυπο που παρουσιάζεται ως τρέχουσα αλήθεια
 * είναι χειρότερο από ωμό κλειδί: το ωμό κλειδί **φαίνεται** ότι είναι πρόβλημα.
 *
 * ⚠️ **Η ΠΑΓΙΔΑ ΠΟΥ ΚΡΥΒΕΤΑΙ ΕΔΩ** *(και γι' αυτό ο έλεγχος `storedLabel !== field`)*:
 * τα BIM registries γράφουν εδώ και χρόνια `label: 'width'` — **το ίδιο το όνομα του
 * πεδίου ως ετικέτα του** (ADR-852 §1.2). Αυτό **ΔΕΝ** είναι στιγμιότυπο ονόματος·
 * είναι το κενό. Αν το σημαίναμε ως «πεδίο που αποσύρθηκε», θα λέγαμε **ψέματα με
 * πρόσωπο ειλικρίνειας** σε **133 από τα 279** πεδία.
 *
 * @module components/shared/audit/audit-field-descriptor
 * @see docs/centralized-systems/reference/adrs/ADR-852-audit-field-descriptor-vocabulary.md — §3.1
 */

import { getTrackedFieldsForEntityAuditType } from '@/config/audit-tracked-fields';
import type { TrackedFieldDef } from '@/lib/audit/tracked-field-def';

/**
 * Ο περιγραφέας ενός πεδίου, **αν** το μητρώο τον ξέρει.
 *
 * ⚠️ `undefined` είναι **έγκυρη και συχνή** απάντηση: το πεδίο μπορεί να αποσύρθηκε, ή
 * ο τύπος οντότητας να είναι ένα από τα **3 ορφανά registries** που δεν έχουν ακόμη
 * καλώδιο στο `getTrackedFieldsForEntityAuditType` (Φ8). Ο καλών **οφείλει** να το
 * χειριστεί — ποτέ `!`.
 */
export function resolveTrackedFieldDef(
  entityType: string | null,
  field: string,
): TrackedFieldDef | undefined {
  return getTrackedFieldsForEntityAuditType(entityType)?.[field];
}

/** Η ετικέτα ενός πεδίου, **μαζί με το αν είναι τρέχουσα αλήθεια ή στιγμιότυπο**. */
export interface ResolvedFieldLabel {
  /** Το κείμενο που μπαίνει στην οθόνη. */
  readonly text: string;
  /**
   * `true` ⇒ το κείμενο είναι **στιγμιότυπο**: το μητρώο δεν αναγνωρίζει πια αυτό το
   * πεδίο και δείχνουμε το όνομα που **είχε καταγραφεί τότε**. Η οθόνη **οφείλει** να
   * το σημάνει — αλλιώς το διπλό κανάλι γίνεται σιωπηλή μαντεψιά.
   */
  readonly isSnapshot: boolean;
}

/**
 * Το `t` του i18next επιστρέφει **το ίδιο το κλειδί** όταν δεν λύνεται, και μπορεί να
 * επιστρέψει **αντικείμενο** όταν το κλειδί δείχνει σε μη-φύλλο κόμβο. Και τα δύο
 * ελέγχονται εδώ, **μία φορά**, αντί σε κάθε σημείο κλήσης.
 */
type Translate = (key: string) => unknown;

function translated(translate: Translate, key: string): string | undefined {
  const value = translate(key);
  return typeof value === 'string' && value !== '' && value !== key ? value : undefined;
}

export interface ResolveFieldLabelParams {
  readonly entityType: string;
  readonly field: string;
  /** Ο περιγραφέας από το **τρέχον** μητρώο — η ζωντανή πλευρά. */
  readonly def: TrackedFieldDef | undefined;
  /** Η ετικέτα όπως **γράφτηκε τότε** στο Firestore — η χρονική πλευρά. */
  readonly storedLabel: string | undefined;
  readonly translate: Translate;
}

/**
 * Σειρά επίλυσης — **ζωντανά πρώτα, στιγμιότυπο τελευταίο, και δηλωμένο**:
 *
 *  1. `def.labelKey` — η ρητή δήλωση του μητρώου *(ADR-852· γεμίζει στη Φ4)*.
 *  2. `audit.fields.{τύπος}.{πεδίο}` — η **ειδική ανά οντότητα** ετικέτα που ήδη υπάρχει.
 *  3. `audit.fields.{πεδίο}` — η γενική ετικέτα.
 *  4. `storedLabel`, **μόνο** αν διαφέρει από το όνομα του πεδίου ⇒ **στιγμιότυπο**.
 *  5. Το ωμό όνομα του πεδίου — ορατό, όπως σήμερα.
 *
 * 🔑 Τα βήματα 2-3 είναι **ακριβώς** η σημερινή συμπεριφορά, στην ίδια σειρά: κάθε
 * εγγραφή που σήμερα εμφανίζεται σωστά, εμφανίζεται **απαράλλαχτα**. Το βήμα 1
 * προστίθεται **πάνω** και το βήμα 4 αποκτά **σήμανση** — μηδέν παλινδρόμηση εκ
 * κατασκευής.
 */
export function resolveFieldLabel({
  entityType,
  field,
  def,
  storedLabel,
  translate,
}: ResolveFieldLabelParams): ResolvedFieldLabel {
  const live =
    (def?.labelKey ? translated(translate, def.labelKey) : undefined) ??
    translated(translate, `audit.fields.${entityType}.${field}`) ??
    translated(translate, `audit.fields.${field}`);

  if (live !== undefined) return { text: live, isSnapshot: false };

  // Το `label: 'width'` των BIM registries ΔΕΝ είναι στιγμιότυπο — είναι το κενό.
  if (storedLabel !== undefined && storedLabel !== '' && storedLabel !== field) {
    return { text: storedLabel, isSnapshot: true };
  }

  return { text: field, isSnapshot: false };
}
