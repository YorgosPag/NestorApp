/**
 * ADR-798 Φάση 4 — Η **ΕΚΠΟΜΠΗ** της επαγγελματικής ταυτότητας στο IFC4.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔒 ΤΙ ΓΡΑΦΕΙ ΚΑΙ ΤΙ **ΔΕΝ** ΓΡΑΦΕΙ
 *
 *   ✅ Τον **ΡΟΛΟ** — τιμή του προτύπου, και το ESCO URI ακέραιο δίπλα του.
 *   ⛔ **ΚΑΝΕΝΑ ΟΝΟΜΑ ΑΝΘΡΩΠΟΥ.** Ποτέ. Ούτε ψευδώνυμο, ούτε uid.
 *
 * 🔴 **ΓΙΑΤΙ — ΚΑΙ ΤΟ ΛΕΕΙ ΤΟ ΙΔΙΟ ΤΟ ΠΡΟΤΥΠΟ.** Ο ορισμός του `IfcPerson`
 * φέρει **ρητή** προειδοποίηση, αυτολεξεί:
 *
 *   > *«Many countries have legislation concerning the identification of
 *   > individual persons within databases. … an IFC file might in some
 *   > situations be considered to be a **database that enables identification of
 *   > a particular person** under the terms of such legislation.»*
 *
 * Και το **IFC4 άνοιξε τον δρόμο** για να μη χρειάζεται:
 *
 *   > *«IFC4 CHANGE: Attribute Id renamed to Identification. **WHERE rule
 *   > relaxed to allow omission of names if Identification is provided.**»*
 *
 * Ο κανόνας `IdentifiablePerson` απαιτεί **ένα** από `Identification` /
 * `FamilyName` / `GivenName`. Δίνουμε το **πρώτο**, με τιμή που **δεν δείχνει σε
 * άνθρωπο** ⇒ το αρχείο είναι **έγκυρο** και **ανώνυμο** — όχι ψευδωνυμοποιημένο.
 * *(Η διάκριση έχει σημασία: η ψευδωνυμοποίηση παραμένει προσωπικό δεδομένο κατά
 * το GDPR· η ανωνυμοποίηση όχι — Αιτιολογική σκέψη 26.)*
 *
 * 🏆 **ΤΟ REVIT ΚΑΝΕΙ ΤΟ ΑΚΡΙΒΩΣ ΑΝΤΙΘΕΤΟ — ΜΕΤΡΗΜΕΝΟ ΣΤΗΝ ΠΗΓΗ (2026-08-24)**
 * *(`Autodesk/revit-ifc`, `Source/Revit.IFC.Export/Exporter/Exporter.cs`)*:
 *
 *   • γρ. **3220-3226** — `author = projectInfo.Author`, και αν είναι κενό
 *     **`author = doc.Application.Username`** → `ParseName(...)` σε
 *     `familyName` / `givenName`. **Το πραγματικό όνομα χρήστη του λειτουργικού
 *     ή του λογαριασμού Autodesk, χωρίς καμία ερώτηση, χωρίς συγκατάθεση.**
 *   • γρ. **3266** — `CreatePerson(file, **null**, familyName, givenName, …)`:
 *     το πρώτο όρισμα **είναι** το `Identification`, και είναι **`null`**.
 *
 * Δηλαδή ο μεγαλύτερος παίκτης αφήνει **κενή** ακριβώς τη θέση που το IFC4
 * χαλάρωσε για να προστατεύσει τον χρήστη, και γεμίζει **αυτές** που το πρότυπο
 * προειδοποιεί ότι κάνουν το αρχείο βάση δεδομένων ταυτοποίησης. Εδώ γίνεται το
 * αντίστροφο, και **δεν είναι γνώμη — είναι ο γραμμένος κανόνας του προτύπου**.
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔑 ΤΑ ΔΥΟ ΚΑΝΑΛΙΑ, ΚΑΙ ΓΙΑΤΙ ΤΟ ΔΕΥΤΕΡΟ **ΔΕΝ** ΕΙΝΑΙ ΑΥΤΟ ΤΟΥ ΣΧΕΔΙΟΥ
 *
 * Το ADR-798 §6.2 όρισε το δεύτερο κανάλι ως `IfcRelAssociatesClassification`.
 * **Είναι δομικά ανεφάρμοστο εδώ**, και επαληθεύτηκε στην πηγή:
 * `IfcRelAssociatesClassification.RelatedObjects : IfcDefinitionSelect` δέχεται
 * **μόνο** `IfcObjectDefinition` / `IfcPropertyDefinition` — και ούτε το
 * `IfcPerson` ούτε το `IfcActorRole` κληρονομούν `IfcRoot`. Το §6.2 επαλήθευσε
 * σωστά ότι φτάνει στο **`IfcActor`**, αλλά ο εξαγωγέας **δεν έχει `IfcActor`**·
 * για να αποκτήσει θα γεννούσε **rooted** οντότητα-συμμετέχοντα στο έργο,
 * δηλαδή θα έφερνε το ανοιχτό ερώτημα GDPR *(§3.5)* στον κρίσιμο δρόμο.
 *
 * Το IFC4 έχει την **σχεδιασμένη γι' αυτό** οντότητα, και το γράφει αυτολεξεί:
 *
 *   > `IfcExternalReferenceRelationship` — *«used to assign classification,
 *   > library or document information to entities that **do not inherit from
 *   > IfcRoot**. It has a **similar functionality as the subtypes of
 *   > IfcRelAssociates**.»*
 *
 * και το `IfcResourceObjectSelect` περιλαμβάνει **ρητά** `IfcActorRole` **και**
 * `IfcPerson`. Το `IfcActorRole` έχει μάλιστα αντίστροφη `HasExternalReference`
 * *(νέα στο IFC4)*, περιγραφόμενη ως *«classification … associated with the
 * **actor role**»*. **Η αρχή των δύο καναλιών μένει ακέραιη· αλλάζει μόνο ο
 * φορέας του δεύτερου, και αλλάζει επειδή ο προτεινόμενος δεν χωρά.**
 *
 * ⚠️ Η ταξινόμηση κρεμιέται στον **ΡΟΛΟ**, όχι στον άνθρωπο: ο ρόλος **είναι** η
 * προβολή του επαγγέλματος, και το πρότυπο περιγράφει αυτή ακριβώς τη σχέση.
 * Έτσι η αλυσίδα μένει **κλειστή** — αν δεν υπάρχει ρόλος, δεν υπάρχει ούτε
 * ταξινόμηση, και ο κανόνας «**ΚΑΙ ΤΑ ΔΥΟ, ΠΑΝΤΑ**» του §6.2 γίνεται **δομικός**
 * αντί για σύμβαση που κάποιος πρέπει να θυμάται.
 * ═════════════════════════════════════════════════════════════════════════════
 * ⚠️ **ΤΟ ΣΧΟΛΙΟ ΠΟΥ ΕΛΕΓΕ ΨΕΜΑΤΑ.** Μέχρι σήμερα το `ifc-spatial-hierarchy.ts`
 * έγραφε `null, // OwnerHistory — patched in by exporter` και **κανείς δεν το
 * έκανε patch**: μηδέν `IFCOWNERHISTORY` σε ολόκληρο το `src/services/ifc/`.
 * Ήταν το σχήμα των CHECK 3.34 / 3.36 / 3.57 — *ένα anchor χωρίς εκτέλεση είναι
 * σχόλιο*. Αυτό το module είναι ο exporter που το σχόλιο υποσχόταν.
 *
 * @module services/ifc/ifc-authorship
 * @see docs/centralized-systems/reference/adrs/ADR-798-person-professional-identity.md §6
 * @see src/config/isco-ifc-role.ts — η **απόφαση**· εδώ ζει μόνο η **εκπομπή**
 */

import type { DeclaredOccupation } from '@/types/professional-identity';
import { ESCO_CLASSIFICATION_SOURCE } from '@/types/professional-identity';
import { judgeIfcActorRole, type IfcActorRoleVerdict } from '@/config/isco-ifc-role';
import { enumValue, integer, lbl, ref } from './ifc-entity-graph';
import type { IfcGraph, IfcValue } from './ifc-entity-graph';

// ─── Public types ───────────────────────────────────────────────────────────

/**
 * Η ταυτότητα της **εφαρμογής** που παράγει το αρχείο — `IfcApplication`.
 *
 * ⚠️ Δεν έχει προεπιλογή **επίτηδες**: το «ποιος το έγραψε» είναι δήλωση που
 * οφείλει να κάνει ο καλών, όχι κάτι που διαρρέει από μια σταθερά βαθιά μέσα σε
 * βοηθητικό module.
 */
export interface IfcAuthoringApplication {
  /** `IfcOrganization.Name` του κατασκευαστή — **υποχρεωτικό στο πρότυπο**. */
  readonly developer: string;
  /** `IfcApplication.Version`. */
  readonly version: string;
  /** `IfcApplication.ApplicationFullName`. */
  readonly fullName: string;
  /** `IfcApplication.ApplicationIdentifier`. */
  readonly identifier: string;
}

export interface IfcAuthorshipInput {
  readonly application: IfcAuthoringApplication;
  /** Το δηλωμένο επάγγελμα του κατόχου του λογαριασμού. `null` ⇒ σιωπή. */
  readonly occupation?: DeclaredOccupation | null;
  /** Στιγμή δημιουργίας σε **δευτερόλεπτα** epoch — `IfcOwnerHistory.CreationDate`. */
  readonly creationTimestamp: number;
}

export interface IfcAuthorshipOutcome {
  /** Το `#id` του `IfcOwnerHistory`, για το `IfcRoot.OwnerHistory` κάθε οντότητας. */
  readonly ownerHistoryId: number;
  /**
   * Η ετυμηγορία που **όντως** εκπέμφθηκε — **ποτέ boolean**.
   *
   * ⚠️ Επιστρέφεται ώστε η **σιωπή να είναι μετρήσιμη**: ένας καλών που δεν
   * ξεχωρίζει το `absent` από το `unclassified` από το `malformed` δεν μπορεί να
   * πει αν το αρχείο βγήκε χωρίς ρόλο επειδή **δεν έπρεπε** ή επειδή **κάτι
   * έσπασε**. Είναι το ίδιο επιχείρημα με τις τέσσερις καταστάσεις της Φάσης 3.
   */
  readonly verdict: IfcActorRoleVerdict;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * 🔴 Η **μη-ταυτοποιητική** τιμή του `IfcPerson.Identification`.
 *
 * Ικανοποιεί τον κανόνα `IdentifiablePerson` *(«Requires that the identification
 * or/and the family name or/and the given name is provided as minimum
 * information»)* **χωρίς να δείχνει σε άνθρωπο**. Δεν είναι uid, δεν είναι hash,
 * δεν είναι ψευδώνυμο — είναι **σταθερά**, ίδια για κάθε αρχείο, άρα **μηδενικής
 * διακριτικής ικανότητας**.
 *
 * ⚠️ **ΜΗΝ το κάνεις uid / email / hash «για ιχνηλασιμότητα».** Θα μετέτρεπε την
 * **ανωνυμοποίηση** σε **ψευδωνυμοποίηση**, που κατά το GDPR παραμένει προσωπικό
 * δεδομένο — δηλαδή θα άλλαζε τη νομική φύση του αρχείου με μία σταθερά.
 *
 * ⚠️ **ΜΗΝ το βάλεις στο `GivenName`** *(όπως κάνει ο εξαγωγέας καννάβου, που
 * γράφει `IFCPERSON($,$,'NestorCAD',…)`)*: το `GivenName` δηλώνει *«το όνομα με
 * το οποίο είναι γνωστός ένας άνθρωπος μέσα στην οικογένειά του»*. Ένα όνομα
 * λογισμικού εκεί είναι **σημασιολογικό ψέμα** σε πεδίο που άλλα εργαλεία
 * διαβάζουν ως ανθρώπινο όνομα.
 */
const ANONYMOUS_AUTHOR_IDENTIFICATION = 'nestor:anonymous-author';

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Προσθέτει στον γράφο την **αλυσίδα ιδιοκτησίας** και, όπου υπάρχει, τον
 * επαγγελματικό ρόλο με την ταξινόμησή του. Επιστρέφει το `IfcOwnerHistory`.
 *
 * Πάντα: `IfcOrganization` → `IfcApplication` → `IfcPerson` →
 * `IfcPersonAndOrganization` → `IfcOwnerHistory`.
 * Όπου η ετυμηγορία το επιτρέπει, **επιπλέον**: `IfcActorRole` +
 * `IfcClassification` + `IfcClassificationReference` +
 * `IfcExternalReferenceRelationship`.
 */
export function appendIfcAuthorship(
  graph: IfcGraph,
  input: IfcAuthorshipInput,
): IfcAuthorshipOutcome {
  const { application, creationTimestamp } = input;

  const organizationId = graph.add('IFCORGANIZATION', [
    null, // Identification
    lbl(application.developer), // Name — υποχρεωτικό
    null, // Description
    null, // Roles
    null, // Addresses
  ]);
  const applicationId = graph.add('IFCAPPLICATION', [
    ref(organizationId),
    lbl(application.version),
    lbl(application.fullName),
    lbl(application.identifier),
  ]);

  const verdict = judgeIfcActorRole(input.occupation);
  const roleId = appendActorRole(graph, verdict);

  const personId = graph.add('IFCPERSON', [
    lbl(ANONYMOUS_AUTHOR_IDENTIFICATION),
    null, // FamilyName — σκοπίμως κενό
    null, // GivenName  — σκοπίμως κενό
    null, // MiddleNames
    null, // PrefixTitles
    null, // SuffixTitles
    roleId === null ? null : [ref(roleId)], // Roles — το ΚΑΝΑΛΙ 1
    null, // Addresses
  ]);
  const owningUserId = graph.add('IFCPERSONANDORGANIZATION', [
    ref(personId),
    ref(organizationId),
    null, // Roles — ρόλος ΜΕΣΑ σε οργανισμό· άλλο ερώτημα (βλ. παρακάτω)
  ]);

  const ownerHistoryId = graph.add('IFCOWNERHISTORY', [
    ref(owningUserId),
    ref(applicationId),
    null, // State
    null, // ChangeAction — κενό μαζί με το LastModifiedDate ⇒ WHERE CorrectChangeAction ✅
    null, // LastModifiedDate
    null, // LastModifyingUser
    null, // LastModifyingApplication
    integer(creationTimestamp), // CreationDate — υποχρεωτικό
  ]);

  return { ownerHistoryId, verdict };
}

// ─── Internals ──────────────────────────────────────────────────────────────

/**
 * Το **ΚΑΝΑΛΙ 1** — `IfcActorRole` — και, αχώριστα, το **ΚΑΝΑΛΙ 2**.
 *
 * 🔑 Η ταξινόμηση γράφεται **μέσα εδώ**, στην ίδια συνάρτηση που γεννά τον ρόλο.
 * Ξεχωριστή κλήση θα ήταν κάτι που ο **επόμενος καλών οφείλει να θυμηθεί** — και
 * το CHECK 3.39 έχει ήδη πληρώσει ακριβώς αυτό *(«ήταν ξεχωριστή κλήση που κάθε
 * καταναλωτής όφειλε να θυμάται, και ο τρίτος δεν τη θυμόταν»)*. Έτσι ο κανόνας
 * «**ΚΑΙ ΤΑ ΔΥΟ, ΠΑΝΤΑ**» γίνεται **δομικός**.
 */
function appendActorRole(graph: IfcGraph, verdict: IfcActorRoleVerdict): number | null {
  if (verdict.kind !== 'enumerated' && verdict.kind !== 'user-defined') return null;

  const role: IfcValue = enumValue(verdict.kind === 'enumerated' ? verdict.role : 'USERDEFINED');
  // WR1: όταν Role = USERDEFINED, το UserDefinedRole είναι ΥΠΟΧΡΕΩΤΙΚΟ.
  const userDefinedRole: IfcValue = verdict.kind === 'user-defined' ? lbl(verdict.label) : null;
  const description: IfcValue =
    verdict.kind === 'enumerated' ? lbl(`ISCO-08 ${verdict.prefix}`) : null;

  const roleId = graph.add('IFCACTORROLE', [role, userDefinedRole, description]);
  appendEscoClassification(graph, roleId, verdict.source);
  return roleId;
}

/**
 * Το **ΚΑΝΑΛΙ 2** — η **αλήθεια**, χωρίς απώλεια.
 *
 * Η αντιστοιχία με το ESCO είναι ένα προς ένα *(ADR-798 §6.2)*: το URI στο
 * `Location : IfcURIReference`, ο κωδικός ISCO-08 στο `Identification`, η
 * ετικέτα στο `Name`. Η ταξινομία δηλώνεται **μία φορά**, από το SSoT.
 */
function appendEscoClassification(
  graph: IfcGraph,
  roleId: number,
  source: { readonly uri: string; readonly code: string | null; readonly label: string },
): void {
  const classificationId = graph.add('IFCCLASSIFICATION', [
    lbl(ESCO_CLASSIFICATION_SOURCE.publisher), // Source
    lbl(ESCO_CLASSIFICATION_SOURCE.edition), // Edition
    null, // EditionDate
    lbl(ESCO_CLASSIFICATION_SOURCE.name), // Name — υποχρεωτικό
    null, // Description
    lbl(ESCO_CLASSIFICATION_SOURCE.location), // Location
    null, // ReferenceTokens
  ]);
  const referenceId = graph.add('IFCCLASSIFICATIONREFERENCE', [
    lbl(source.uri), // Location — η ΑΥΘΕΝΤΙΑ
    source.code === null ? null : lbl(source.code), // Identification
    lbl(source.label), // Name
    ref(classificationId), // ReferencedSource
    null, // Description
    null, // Sort
  ]);
  graph.add('IFCEXTERNALREFERENCERELATIONSHIP', [
    null, // Name
    null, // Description
    ref(referenceId), // RelatingReference
    [ref(roleId)], // RelatedResourceObjects — SET[1:?]
  ]);
}
