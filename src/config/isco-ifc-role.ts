/**
 * ADR-798 Φάση 4 — Η **ΠΡΟΒΟΛΗ** του επαγγέλματος σε `IfcRoleEnum`.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔒 ΤΙ ΚΑΝΕΙ ΚΑΙ ΤΙ ΔΕΝ ΚΑΝΕΙ
 *
 *   ✅ Απαντά *«ποια τιμή του **προτύπου** προβάλλει αυτό το επάγγελμα;»*.
 *   ⛔ **ΠΟΤΕ δεν είναι η μόνη έξοδος**: το επάγγελμα ταξιδεύει σε **ΔΥΟ**
 *      κανάλια, και αυτό εδώ είναι το **λειψό** — με απώλεια, εκ σχεδιασμού
 *      *(ADR-798 §6.2)*. Την **αλήθεια** την κουβαλά το ESCO URI, στο δεύτερο.
 *
 * ⚠️ **ΜΗΝ γράψεις αντίστροφο επιλυτή** (`IfcRoleEnum → ISCO`). Η κατεύθυνση
 * ESCO → ISCO → `IfcRoleEnum` είναι **ολική και με απώλεια**· η αντίστροφη θα
 * ήταν **μαντεψιά με πρόσωπο βεβαιότητας** *(ADR-798 §6.2)*.
 * ═════════════════════════════════════════════════════════════════════════════
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ — **ΜΕΤΡΗΜΕΝΟ ΣΤΗΝ ΠΗΓΗ, 2026-08-24**
 *
 * Διαβάστηκε ο κώδικας εξαγωγής του **Revit** *(`Autodesk/revit-ifc`,
 * `Source/Revit.IFC.Export/Exporter/Exporter.cs`)*:
 *
 *   • γρ. **3271** — `CreatePersonAndOrganization(file, person, organization, null)`.
 *     Το τρίτο όρισμα **είναι** τα `Roles`. ⇒ Ο μεγαλύτερος παίκτης της αγοράς
 *     **ΔΕΝ γράφει ΠΟΤΕ ρόλο** στην κύρια διαδρομή εξαγωγής.
 *   • γρ. **3370** — ο **μόνος** `CreateActorRole` σε ολόκληρο τον exporter ζει
 *     στη διαδρομή COBie και είναι `CreateActorRole(file, "UserDefined",
 *     category, null)` ⇒ **σκέτο `USERDEFINED` + ελεύθερο κείμενο**, δηλαδή
 *     ακριβώς ό,τι το **ADR-798 §6.1 απέρριψε γραπτώς** πριν καν μετρηθεί.
 *
 * Δηλαδή η πρακτική των μεγάλων είναι *«κανένας ρόλος, ή ρόλος ως κείμενο»*.
 * Εδώ ο ρόλος είναι **τιμή του προτύπου όταν υπάρχει**, **ονομασμένο
 * `USERDEFINED` όταν δεν υπάρχει**, και **ποτέ μόνος του**.
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΓΙΑΤΙ Ο ΠΙΝΑΚΑΣ ΕΙΝΑΙ ΜΙΚΡΟΣ — ΚΑΙ ΓΙΑΤΙ ΑΥΤΟ ΔΕΝ ΕΙΝΑΙ ΕΛΛΕΙΨΗ
 *
 * Το `IfcRoleEnum` **δεν είναι ταξινομία επαγγελμάτων**: είναι λίστα **θέσεων σε
 * κατασκευαστικό έργο**. Οι μισές τιμές του *(`CLIENT` · `OWNER` ·
 * `BUILDINGOWNER` · `CONTRACTOR` · `SUBCONTRACTOR` · `SUPPLIER` · `RESELLER` ·
 * `MANUFACTURER`)* είναι **συμβατικοί ρόλοι**, που **κανένας** κωδικός ISCO δεν
 * μπορεί να εκφράσει — κανείς δεν είναι «πελάτης» ως **επάγγελμα**. Και
 * αντίστροφα, το ISCO έχει επαγγέλματα *(δικηγόρος · μεσίτης · λογιστής ·
 * **τοπογράφος**)* που το πρότυπο **δεν έχει**: δεν υπάρχει `SURVEYOR`.
 *
 * ⚠️ **Η αυστηρότητα εδώ είναι ΔΩΡΕΑΝ**, και αυτός είναι ο λόγος που ο πίνακας
 * δηλώνει **μόνο** αντιστοιχίες **ταυτόσημες κατά όνομα**: όταν ο πίνακας
 * σωπαίνει πάνω σε **ταξινομημένο** επάγγελμα, η ετυμηγορία **δεν** είναι σιωπή —
 * είναι `user-defined`, και το **δεύτερο κανάλι κουβαλά το URI ακέραιο**. Μια
 * χαλαρή δήλωση *(«ο αρχιτέκτονας τοπίου είναι ARCHITECT»)* δεν θα κέρδιζε
 * πληροφορία· θα **αντικαθιστούσε** μια ακριβή δήλωση με μια κατά προσέγγιση.
 * ═════════════════════════════════════════════════════════════════════════════
 * ⛔ ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
 *
 * • **ΜΗΝ** ενώσεις με το `isco-job-affinity.ts`. Είναι **άλλο ερώτημα** με
 *   **άλλους καταναλωτές** *(πλοήγηση vs εξαγωγή)* και — μετρημένα — **άλλη
 *   ανάλυση**: εκεί το `214` απαντά για όλους τους μηχανικούς, εδώ χρειάζονται
 *   `2142` και `2144` ξεχωριστά γιατί το πρότυπο τα ξεχωρίζει. Ένωση θα γεννούσε
 *   αρχείο που αλλάζει για **δύο ανεξάρτητους λόγους**.
 * • **ΜΗΝ** προσθέσεις πεδίο `ifcRole` στο `IscoAffinityEntry` — ίδιο σφάλμα,
 *   άλλη μεταμφίεση.
 * • **ΜΗΝ** δηλώσεις ομάδα «για πληρότητα». Κάθε γραμμή φέρει **υποχρεωτικό**
 *   `why` με τον **επίσημο τίτλο** της ομάδας, και άγκυρα το απαιτεί μη κενό.
 * • **ΜΗΝ** δηλώσεις ομάδα της οποίας ο **πλησιέστερος δηλωμένος πρόγονος** δίνει
 *   την ίδια τιμή: είναι πλεονασμός που θα αποκλίνει σιωπηλά.
 * • **ΜΗΝ** αγγίξεις το `profession-bridge.config.ts` — απαντά *«ποιο επάγγελμα
 *   αντιστοιχεί σε **ρόλο έργου**»* (ADR-282/745), **αντίστροφη κατεύθυνση**.
 *
 * @module config/isco-ifc-role
 * @see docs/centralized-systems/reference/adrs/ADR-798-person-professional-identity.md §6
 * @see src/services/ifc/ifc-authorship.ts — ο **μόνος** καταναλωτής της απόφασης
 * @see https://standards.buildingsmart.org/IFC/RELEASE/IFC4/ADD2_TC1/HTML/schema/ifcactorresource/lexical/ifcroleenum.htm
 */

import type { DeclaredOccupation } from '@/types/professional-identity';
import { resolveIscoPrefix } from './isco-prefix';

// =============================================================================
// ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΟΥ ΠΡΟΤΥΠΟΥ
// =============================================================================

/**
 * Το **κλειστό** σύνολο του `IfcRoleEnum`, **IFC4 ADD2 TC1**.
 *
 * ⚠️ Αντιγράφηκε από την **επίσημη** τεκμηρίωση buildingSMART *(EXPRESS
 * specification, ανακτήθηκε 2026-08-24)* — **ποτέ από μνήμη**. Η πρώτη
 * αναζήτηση στο διαδίκτυο επέστρεψε **19** τιμές και **έχανε** τις
 * `FIELDCONSTRUCTIONMANAGER` · `RESELLER` · `USERDEFINED`.
 *
 * ⚠️ **Είναι δεμένο με την έκδοση.** Ο εξαγωγέας εκπέμπει `FILE_SCHEMA(('IFC4'))`
 * *(μετρημένο: `ifc-step-writer.ts`)*. Στο **IFC2X3** η τιμή γραφόταν
 * `COMISSIONINGENGINEER` *(ένα `M`)* — το IFC4 διόρθωσε την ορθογραφία. Αν ποτέ
 * εκπεμφθεί IFC2X3, **αυτή η λίστα δεν ισχύει αυτούσια**.
 */
export type IfcRoleEnumValue =
  | 'SUPPLIER'
  | 'MANUFACTURER'
  | 'CONTRACTOR'
  | 'SUBCONTRACTOR'
  | 'ARCHITECT'
  | 'STRUCTURALENGINEER'
  | 'COSTENGINEER'
  | 'CLIENT'
  | 'BUILDINGOWNER'
  | 'BUILDINGOPERATOR'
  | 'MECHANICALENGINEER'
  | 'ELECTRICALENGINEER'
  | 'PROJECTMANAGER'
  | 'FACILITIESMANAGER'
  | 'CIVILENGINEER'
  | 'COMMISSIONINGENGINEER'
  | 'ENGINEER'
  | 'OWNER'
  | 'CONSULTANT'
  | 'CONSTRUCTIONMANAGER'
  | 'FIELDCONSTRUCTIONMANAGER'
  | 'RESELLER'
  | 'USERDEFINED';

/** Μία δήλωση προβολής. Το `why` είναι **υποχρεωτικό** και δεν εμφανίζεται ποτέ. */
export interface IscoIfcRoleEntry {
  readonly role: Exclude<IfcRoleEnumValue, 'USERDEFINED'>;
  /** Ο **επίσημος** τίτλος ISCO-08 της ομάδας + γιατί η αντιστοιχία είναι ασφαλής. */
  readonly why: string;
}

// =============================================================================
// ΟΙ ΔΗΛΩΣΕΙΣ
// =============================================================================

/**
 * 🔑 **Κάθε κλειδί είναι πρόθεμα ISCO-08· ο πιο ΜΑΚΡΥΣ νικά.**
 *
 * Οι τίτλοι μέσα στα `why` επαληθεύτηκαν **έναν προς έναν** στο **επίσημο ESCO
 * API** *(`ec.europa.eu/esco/api/resource/concept?uri=…/isco/C<κωδικός>`,
 * 2026-08-24)* — την ίδια αυθεντία που καταναλώνει η εφαρμογή (ADR-132).
 *
 * ⚠️ **ΤΡΙΑ ΣΗΜΕΙΑ ΟΠΟΥ Η ΓΕΝΙΚΕΥΣΗ ΘΑ ΗΤΑΝ ΛΑΘΟΣ, ΜΕΤΡΗΜΕΝΑ:**
 *
 *   • `215` *(Electrotechnology engineers)* **ΔΕΝ** δηλώνεται ολόκληρο: περιέχει
 *     `2152` *(Electronics engineers)* και `2153` *(Telecommunications
 *     engineers)*, που **δεν** είναι `ELECTRICALENGINEER`. Δηλώνεται **μόνο** το
 *     `2151` *(Electrical engineers)*, ταυτόσημο κατά όνομα. Τα άλλα δύο **δεν**
 *     πέφτουν στο `214` — το `215` δεν είναι απόγονός του — οπότε παίρνουν
 *     `user-defined` και το URI τους ταξιδεύει ακέραιο.
 *   • `216` *(Architects, planners, surveyors and designers)* **ΔΕΝ** δηλώνεται
 *     ολόκληρο: περιέχει `2163` *(Product and garment designers)* και `2166`
 *     *(Graphic and multimedia designers)*, που δεν σχεδιάζουν κτίρια. Δηλώνεται
 *     **μόνο** το `2161` *(Building architects)*.
 *   • `132` **ΔΕΝ** δηλώνεται: είναι *«Manufacturing, mining, construction, and
 *     distribution managers»* — το `1323` είναι **ένα τέταρτο** αυτής της ομάδας.
 *
 * ⚠️ **Η σειρά `214` → `2142`/`2144` δείχνει τον μηχανισμό**: το `214` δίνει τον
 * **γενικό** `ENGINEER` σε ολόκληρη την ελάσσονα ομάδα, και τα δύο μακρύτερα
 * προθέματα τον **εξειδικεύουν** εκεί που το πρότυπο έχει ξεχωριστή τιμή. Ο
 * `2141` *(βιομηχανικός)* · `2143` *(περιβαλλοντολόγος)* · `2145` *(χημικός)* ·
 * `2146` *(μεταλλείων)* · `2149` *(NEC)* παίρνουν **σωστά** τον γενικό.
 */
export const ISCO_IFC_ROLE: Readonly<Record<string, IscoIfcRoleEntry>> = {
  '214': {
    role: 'ENGINEER',
    why: 'Engineering professionals (excluding electrotechnology) — ο γενικός ENGINEER καλύπτει ολόκληρη την ελάσσονα ομάδα· τα 2142/2144 τον εξειδικεύουν παρακάτω',
  },
  '2142': {
    role: 'CIVILENGINEER',
    why: 'Civil engineers — ταυτόσημο κατά όνομα με το CIVILENGINEER. Εδώ ταξινομείται και ο δομοστατικός: το ISCO-08 ΔΕΝ έχει ξεχωριστή ομάδα γι΄ αυτόν, οπότε το STRUCTURALENGINEER μένει αδήλωτο εκ κατασκευής',
  },
  '2144': {
    role: 'MECHANICALENGINEER',
    why: 'Mechanical engineers — ταυτόσημο κατά όνομα με το MECHANICALENGINEER',
  },
  '2151': {
    role: 'ELECTRICALENGINEER',
    why: 'Electrical engineers — ταυτόσημο κατά όνομα. Δηλώνεται μόνο του, ΟΧΙ το γονικό 215, γιατί εκείνο περιέχει 2152 (ηλεκτρονικών) και 2153 (τηλεπικοινωνιών)',
  },
  '2161': {
    role: 'ARCHITECT',
    why: 'Building architects — ρητά ο μελετητής κτιρίου, ταυτόσημο με το ARCHITECT. Δηλώνεται μόνο του γιατί το γονικό 216 περιέχει και μη-κτιριακούς σχεδιαστές',
  },
  '1323': {
    role: 'CONSTRUCTIONMANAGER',
    why: 'Construction managers — ταυτόσημο κατά όνομα με το CONSTRUCTIONMANAGER. Δηλώνεται μόνο του γιατί το γονικό 132 περιέχει και βιομηχανία/ορυχεία/διανομή',
  },
} as const;

// =============================================================================
// Η ΑΠΟΦΑΣΗ
// =============================================================================

/**
 * Η **ταυτότητα** του επαγγέλματος, όπως ταξιδεύει στο **δεύτερο** κανάλι.
 *
 * ⚠️ Το `uri` είναι **υποχρεωτικό** εδώ, ενώ στο `DeclaredOccupation` είναι
 * προαιρετικό — και αυτό είναι **σκόπιμη στένωση**: χωρίς URI **δεν υπάρχει**
 * δεύτερο κανάλι, και το ADR-798 §6.2 απαγορεύει ρητά μηχανισμό «με ή».
 */
export interface EscoOccupationReference {
  /** `IfcClassificationReference.Location : IfcURIReference` — η **αυθεντία**. */
  readonly uri: string;
  /** `IfcClassificationReference.Identification : IfcIdentifier` — ο κωδικός ISCO-08. */
  readonly code: string | null;
  /** `IfcClassificationReference.Name : IfcLabel` — ετικέτα για ανθρώπους. */
  readonly label: string;
}

/**
 * Η ετυμηγορία, σε **πέντε ρητές καταστάσεις** — ποτέ `IfcRoleEnumValue | null`.
 *
 * | Κατάσταση | Τι εκπέμπεται | Γιατί |
 * |---|---|---|
 * | `enumerated` | `IfcActorRole(.<ΤΙΜΗ>.)` **+** ταξινόμηση | και τα δύο κανάλια, πλήρη |
 * | `user-defined` | `IfcActorRole(.USERDEFINED., ετικέτα)` **+** ταξινόμηση | το πρότυπο δεν έχει τιμή· **η αλήθεια δεν χάνεται** |
 * | `unclassified` | **τίποτα** | ελεύθερο κείμενο: δεν υπάρχει δεύτερο κανάλι να σώσει το πρώτο |
 * | `absent` | **τίποτα** | καμία δήλωση |
 * | `malformed` | **τίποτα** | ο κωδικός δεν είναι ISCO-08· fail-closed **και ορατό** |
 *
 * ⚠️ Το `unclassified` **δεν είναι σφάλμα**: είναι η **συνηθισμένη** κατάσταση
 * του ADR-132 §1 *(οπισθόδρομη συμβατότητα με ελεύθερο κείμενο)*. Και είναι ο
 * λόγος που δεν εκπέμπεται τίποτα: `USERDEFINED` + ωμό ελληνικό κείμενο **χωρίς**
 * URI δίπλα του είναι **ακριβώς** ο μηχανισμός που απέρριψε το §6.1 — και είναι
 * αυτό που κάνει το Revit.
 */
export type IfcActorRoleVerdict =
  | {
      readonly kind: 'enumerated';
      readonly role: Exclude<IfcRoleEnumValue, 'USERDEFINED'>;
      /** Σε ποιο **επίπεδο** ISCO απαντήθηκε — ταξιδεύει στο `Description`. */
      readonly prefix: string;
      readonly source: EscoOccupationReference;
    }
  | {
      readonly kind: 'user-defined';
      readonly label: string;
      readonly source: EscoOccupationReference;
    }
  | { readonly kind: 'unclassified' }
  | { readonly kind: 'absent' }
  | { readonly kind: 'malformed'; readonly value: string };

/**
 * Κενό ή μόνο κενά ⇒ **δεν** είναι τιμή.
 *
 * ⚠️ Ο έλεγχος είναι `trim()`, όχι `length > 0`: ένα πεδίο με κενά είναι
 * **συνηθισμένο** προϊόν φόρμας, και θα γεννούσε `IfcLabel` με κενό — τεχνικά
 * έγκυρο, σημασιολογικά ψέμα.
 */
function firstNonBlank(...candidates: readonly (string | undefined)[]): string | null {
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate.trim().length > 0) return candidate.trim();
  }
  return null;
}

/**
 * Η ετυμηγορία για ένα δηλωμένο επάγγελμα.
 *
 * 🔑 **Η ΣΕΙΡΑ ΤΩΝ ΕΛΕΓΧΩΝ ΕΙΝΑΙ ΤΟ ΣΥΜΒΟΛΑΙΟ.** Το `absent` κρίνεται πρώτο,
 * μετά το `unclassified` *(λείπει URI ή ετικέτα ⇒ **κανένα** κανάλι δεν είναι
 * δυνατό, άρα ο κωδικός ISCO δεν έχει σημασία)*, και **μόνο τότε** ρωτιέται ο
 * πίνακας. Αν ο πίνακας ρωτιόταν πρώτος, ένα **ορφανό** `iscoCode` χωρίς URI θα
 * έδινε `enumerated` με **κενό** δεύτερο κανάλι — μηχανισμό «με ή», από την πίσω
 * πόρτα. *(Ο γραφέας της Φάσης 3 αρνείται να γεννήσει ορφανό κωδικό· δεδομένα
 * από import όμως **δεν** περνούν από αυτόν — handoff §5.5.)*
 */
export function judgeIfcActorRole(
  occupation: DeclaredOccupation | null | undefined,
): IfcActorRoleVerdict {
  if (occupation === null || occupation === undefined) return { kind: 'absent' };

  const uri = firstNonBlank(occupation.escoUri);
  const label = firstNonBlank(occupation.escoLabel, occupation.profession);

  if (uri === null || label === null) {
    const anythingDeclared = firstNonBlank(
      occupation.profession,
      occupation.escoLabel,
      occupation.escoUri,
      occupation.iscoCode,
    );
    return anythingDeclared === null ? { kind: 'absent' } : { kind: 'unclassified' };
  }

  const code = firstNonBlank(occupation.iscoCode);
  const source: EscoOccupationReference = { uri, code, label };
  const verdict = resolveIscoPrefix(ISCO_IFC_ROLE, code);

  switch (verdict.kind) {
    case 'declared':
      return { kind: 'enumerated', role: verdict.entry.role, prefix: verdict.prefix, source };
    case 'malformed':
      return { kind: 'malformed', value: verdict.value };
    case 'undeclared':
    case 'absent':
      return { kind: 'user-defined', label, source };
  }
}
