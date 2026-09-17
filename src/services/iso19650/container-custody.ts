/**
 * =============================================================================
 * Η ΣΦΡΑΓΙΣΗ ΤΟΥ ΔΟΧΕΙΟΥ ΣΤΗΝ ΕΙΣΟΔΟ ΤΟΥ ΣΤΟ CDE — ΕΡΓΟ ΚΑΙ ΟΜΑΔΑ (ADR-862 Φ0 Β14)
 * =============================================================================
 *
 * **Το ερώτημα**: *«όταν ένα αρχείο μπαίνει στο CDE, σε ποιο **έργο** και σε ποια **ομάδα
 * εργασίας** ανήκει;»* — απαντημένο **μία φορά**, από τον server, στην **ίδια** συναλλαγή με
 * την πρώτη πράξη.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΣΤΗΝ ΕΙΣΟΔΟ ΚΑΙ ΟΧΙ ΣΤΗ ΓΕΝΝΗΣΗ ΤΟΥ ΑΡΧΕΙΟΥ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `FileRecord` γεννιέται από τον **πελάτη** (client SDK), και το `cdeTeamId` της γέννησης
 * οι κανόνες το δέχονται **μόνο ως υπόδειξη** (`container-subject.ts`). Η είσοδος στο CDE
 * όμως περνά **πάντα** από τον ΕΝΑ γραφέα κατάστασης (CHECK 3.87) — είναι το πρώτο σημείο
 * όπου ο server **ξέρει** ποιος πράττει και έχει συναλλαγή.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ Η ΣΦΡΑΓΙΣΗ ΔΕΝ ΑΡΝΕΙΤΑΙ — ΤΟ ΚΑΘΕΣΤΩΣ ΑΠΟΦΑΣΙΖΕΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η αντικατάσταση έκδοσης (`supersede`) περνά από τον ίδιο γραφέα για **κάθε** αρχείο, και
 * μετρημένα 22 από 35 ζωντανά αρχεία **δεν** ζουν σε έργο (επαφές · αγγελίες ιδιοκτητών).
 * Άρνηση εδώ θα **έσπαγε** τη «νέα έκδοση» για όλα αυτά. ⇒ Σφραγίζεται **ό,τι λύνεται**· ό,τι
 * δεν λύνεται μπαίνει σε καθεστώς `versions-only` (ADR-862 §5.3.7, `container-regime-policy.ts`):
 * εκδόσεις ναι, φάσεις όχι — ποτέ αόρατο αρχείο.
 *
 * 🔑 **Ομάδα = ο οργανισμός του μέλους** (ACC: WIP ανά εταιρεία) — διαβάζεται από το έγγραφο
 * μέλους **αυτού** του έργου, ποτέ από claim (OpenFGA: claims ζουν ως τη λήξη του token).
 *
 * @module services/iso19650/container-custody
 * @see lib/files/container-project — ο αναλυτής έργου
 * @see lib/auth/project-member-ref — η ΜΙΑ ερώτηση μέλους
 */

import 'server-only';

import { trimmedStringOrNull as text } from '@/lib/type-guards';

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { memberByUidQuery, projectMembersCollection } from '@/lib/auth/project-member-ref';
import { resolveContainerProject, type ContainerProjectResolution } from '@/lib/files/container-project';
import type { ContainerPhase } from '@/types/container-access';

import { CDE_REGIME, PERSONAL_REGIME, regimeOfEntry, type ContainerRegime } from './container-regime-policy';
import type { ContainerActor } from './container-transition-vocabulary';

/** Τα πεδία προς σφράγιση — **κενό** αντικείμενο όταν δεν υπάρχει τίποτα να γραφτεί. */
export type ContainerCustodyFields = Readonly<{ projectId?: string; cdeTeamId?: string }>;

/**
 * **Η είσοδος στο CDE** — τι σφραγίζεται **και** σε ποιο καθεστώς μπαίνει το δοχείο.
 *
 * 🔑 Από **μία** ανάλυση έργου (ADR-862 §5.3.7): το «σε ποιο έργο;» απαντά και τα δύο. Δεύτερη
 * ανάγνωση της αλυσίδας για το καθεστώς θα μπορούσε να διαφωνήσει με τη σφράγιση μέσα στην ίδια πράξη.
 */
interface ContainerEntry {
  readonly regime: ContainerRegime;
  readonly fields: ContainerCustodyFields;
}


/** Το `projectId` που **ισχύει**, και αν πρέπει να **γραφτεί**. */
function projectFieldsOf(resolution: ContainerProjectResolution): {
  readonly projectId: string | null;
  readonly fields: ContainerCustodyFields;
} {
  if (resolution.outcome === 'none') return { projectId: null, fields: {} };
  return {
    projectId: resolution.projectId,
    fields: resolution.outcome === 'derived' ? { projectId: resolution.projectId } : {},
  };
}

/**
 * **Τι σφραγίζεται στην είσοδο στο CDE** — μόνο αναγνώσεις, μέσα στη συναλλαγή του γραφέα.
 *
 * ⚠️ Μόνο από `pre-cde`: ένα δοχείο **ήδη** στο CDE έχει ήδη κριθεί, και αλλαγή έργου, ομάδας
 * **ή καθεστώτος** σε αυτό θα άλλαζε **εκ των υστέρων** ποιος το βλέπει. Αυτό είναι πράξη
 * μετακίνησης, όχι παρενέργεια μιας σφραγίδας ⇒ {@link CDE_REGIME}, χωρίς ανάγνωση.
 *
 * 🔑 Χωρίς έργο ⇒ `versions-only` (ADR-862 §5.3.7): ο γραφέας αρνείται τις πράξεις φάσης και
 * γράφει μόνο τη διαδοχή.
 */
export async function custodyOnEntry(
  transaction: Transaction,
  db: Firestore,
  raw: Readonly<Record<string, unknown>>,
  from: ContainerPhase,
  actor: ContainerActor,
): Promise<ContainerEntry> {
  // 🔑 ADR-866 Ε-Φ0-1 — **ο άνθρωπος πρώτος, και ΑΝΕΞΑΡΤΗΤΩΣ ΦΑΣΗΣ**: προσωπικό δοχείο δεν
  //    αποκτά **ποτέ** φάση (ο κανόνας `files_personal` αρνείται κάθε κλειδί του
  //    `cdeCustodyKeys()`), οπότε το «και `pre-cde`» θα ήταν συνθήκη που δεν μπορεί να
  //    ψευδεί — δηλαδή θόρυβος που κρύβει τον πραγματικό λόγο. Καμία ανάγνωση: ο ιδιώτης
  //    **δεν ρωτά καν** για έργο (μία ανάγνωση λιγότερη ανά πράξη, και κανένας ψευδής λόγος).
  //
  // ⚠️ **Τοπικό `const`, όχι `actor.custody.…` σε κάθε σημείο**: η στένωση της ένωσης πάνω σε
  //    τοπική σταθερά επιβιώνει των `await` και **δεν** εξαρτάται από στένωση διαδρομής ιδιότητας.
  const { custody } = actor;
  if (custody.userId !== undefined) return { regime: PERSONAL_REGIME, fields: {} };

  if (from !== 'pre-cde') return { regime: CDE_REGIME, fields: {} };

  const resolution = await resolveContainerProject(transaction, db, raw);
  const regime = regimeOfEntry(resolution);
  const { projectId, fields } = projectFieldsOf(resolution);
  if (projectId === null || text(raw.cdeTeamId) !== null) return { regime, fields };

  // ⚠️ Ο κλάδος είναι **αποδεδειγμένα** εταιρικός: ο προσωπικός κόπηκε στην πρώτη γραμμή.
  const members = projectMembersCollection(db, custody.companyId, projectId);
  const member = (await transaction.get(memberByUidQuery(members, actor.uid))).docs[0];
  const team = text(member?.data().taskTeamId);
  return { regime, fields: team === null ? fields : { ...fields, cdeTeamId: team } };
}

// =============================================================================
// ΤΟ BACKFILL — ΔΟΧΕΙΑ ΠΟΥ ΜΠΗΚΑΝ ΣΤΟ CDE ΠΡΙΝ ΤΟ Β14
// =============================================================================

export type ContainerProjectSeal =
  | { readonly outcome: 'sealed'; readonly projectId: string }
  | { readonly outcome: 'unchanged'; readonly resolution: ContainerProjectResolution }
  | { readonly outcome: 'not-found' };

/**
 * Σφραγίζει το **έργο** ενός δοχείου που είναι **ήδη** στο CDE χωρίς αυτό.
 *
 * ⚠️ **Μόνο το έργο, ποτέ η ομάδα**: η ομάδα ανήκει σε **αυτόν που έκανε** την είσοδο, και
 * για παλιά είσοδο δεν ξέρουμε σε ποια ομάδα ήταν τότε. Μαντεψιά θα ήταν εξουσιοδότηση που
 * κανείς δεν υπέγραψε. Χωρίς ομάδα το WIP μένει κλειστό (`denied-teamless`) — τα άλλα τρία
 * στάδια δεν τη χρειάζονται.
 */
export function sealContainerProject(
  db: Firestore,
  fileId: string,
  options: { readonly dryRun: boolean },
): Promise<ContainerProjectSeal> {
  const ref = db.collection(COLLECTIONS.FILES).doc(fileId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return { outcome: 'not-found' };
    const raw = (snapshot.data() ?? {}) as Record<string, unknown>;
    const resolution = await resolveContainerProject(transaction, db, raw);
    if (resolution.outcome !== 'derived') return { outcome: 'unchanged', resolution };
    if (!options.dryRun) {
      transaction.update(ref, { projectId: resolution.projectId, updatedAt: nowISO() });
    }
    return { outcome: 'sealed', projectId: resolution.projectId };
  });
}
