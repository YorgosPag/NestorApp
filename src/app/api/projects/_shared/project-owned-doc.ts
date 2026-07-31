/**
 * «ΤΟ έργο — αν είναι δικό μου»: ο **ένας** φορτωτής
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (N.18 · CHECK 3.28 · ADR-742 §7sexies)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η κεντρικοποίηση της **ερώτησης** ({@link requireProjectAccess}) δεν αρκούσε:
 * τα σημεία εξακολουθούσαν να γράφουν την ίδια **τετράδα βημάτων**:
 *
 * ```ts
 * const ref = db.collection(COLLECTIONS.PROJECTS).doc(projectId);
 * const snap = await ref.get();
 * if (!snap.exists) throw projectNotFound();          // υπάρχει;
 * const data = snap.data();
 * requireProjectAccess({ projectData: data, … });     // δικό μου;
 * ```
 *
 * Το `jscpd` το μέτρησε **αμέσως** ως κλώνο ανάμεσα στο `route.ts` (GET) και
 * στο `project-mutations.service.ts` (delete) — η ακριβώς προβλεπόμενη αστοχία
 * του N.18: *κεντρικοποιείς το Α και γράφεις Β+Γ ως δίδυμα*.
 *
 * 🔴 **Ο κίνδυνος δεν είναι οι γραμμές — είναι η ΣΕΙΡΑ.** Αντίγραφο που
 * φορτώνει, δουλεύει, και ρωτά «δικό μου;» **στο τέλος** απαντά κανονικά·
 * απλώς έχει ήδη διαβάσει ξένο έγγραφο. Η διαφορά **δεν φαίνεται πουθενά**:
 * κανένα test του φύλακα δεν την πιάνει, γιατί ο φύλακας *κλήθηκε* — απλώς
 * αργά. Ενώνοντας φόρτωση + απόφαση σε **μία** κλήση, η σειρά παύει να είναι
 * θέμα προσοχής και γίνεται **δομική** (ADR-742 §7.1).
 *
 * ⚠️ **Ο φύλακας δέχεται το ωμό `snap.data()`, όχι το `as Project`**: ο τύπος
 * υπόσχεται `companyId: string`, η βάση δεν το εγγυάται (§7.5). Η στένωση
 * γίνεται στον **καλούντα**, ρητά και ορατά.
 *
 * ⛔ **Δεν εξυπηρετεί το `structure/[projectId]`** — και αυτό είναι σκόπιμο.
 * Εκείνη η διαδρομή **επιστρέφει** την άρνηση με δικό της σχήμα σύρματος αντί
 * να τη ρίξει, οπότε καλεί απευθείας το `checkProjectAccess` (PDP) και
 * επιβάλλει μόνη της (PEP). Φορτωτής που «ρίχνει ή επιστρέφει ανάλογα με
 * σημαία» θα ήταν ακριβώς η boolean σε κλήση ασφαλείας που απαγορεύει το
 * ADR-742 §3.2.
 *
 * @module app/api/projects/_shared/project-owned-doc
 * @see ./project-ownership — η ερώτηση + το εργοστάσιο «δεν βρέθηκε»
 */

import 'server-only';

import type { DocumentData, DocumentReference, Firestore } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import {
  projectNotFound,
  requireProjectAccess,
  type ProjectAccessCaller,
} from './project-ownership';

const logger = createModuleLogger('ProjectOwnedDoc');

export interface LoadOwnedProjectSpec {
  readonly projectId: string;
  readonly caller: ProjectAccessCaller;
  /** Ποιο μονοπάτι ρώτησε — μπαίνει στα logs ασφαλείας του φύλακα. */
  readonly action: string;
  /**
   * Η ήδη ανοιγμένη σύνδεση, όταν ο καλών τη χρειάζεται **και** μετά (π.χ. ο
   * χειριστής διαγραφής τη δίνει στη μηχανή soft-delete). Χωρίς αυτό θα
   * άνοιγαν δύο στιγμιότυπα για το ίδιο αίτημα.
   */
  readonly db?: Firestore;
}

/** Ό,τι έχει στα χέρια του ο καλών **αφού** ο φύλακας έχει αποφανθεί. */
export interface OwnedProjectDoc {
  readonly id: string;
  /** Για τους χειριστές που γράφουν αμέσως μετά — δεν ξαναχτίζεται το path. */
  readonly ref: DocumentReference<DocumentData>;
  /** Το φορτίο **όπως βγήκε από τη βάση** — ποτέ `as Project` (§7.5). */
  readonly data: DocumentData | undefined;
}

/**
 * Διαβάζει το έργο και **αμέσως** το κρίνει. Και τα δύο «όχι» — γνήσια απουσία
 * **και** άρνηση ιδιοκτησίας — βγαίνουν από το **ίδιο** εργοστάσιο, οπότε ο
 * καλών δεν μπορεί να τα ξεχωρίσει σε κανένα πεδίο του σύρματος.
 */
export async function loadOwnedProject(spec: LoadOwnedProjectSpec): Promise<OwnedProjectDoc> {
  const { projectId, caller, action } = spec;

  const ref = (spec.db ?? getAdminFirestore()).collection(COLLECTIONS.PROJECTS).doc(projectId);
  const snap = await ref.get();

  if (!snap.exists) {
    logger.info('Project not found', { action, projectId });
    throw projectNotFound();
  }

  const data = snap.data();
  requireProjectAccess({ projectData: data, caller, projectId, action });

  return { id: snap.id, ref, data };
}
