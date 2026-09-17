/**
 * =============================================================================
 * ΟΙ ΤΕΣΣΕΡΙΣ ΠΡΑΞΕΙΣ ΤΟΥ ΔΟΧΕΙΟΥ — **ΜΙΑ** διαδρομή (ADR-862 Φ0 Β6)
 * =============================================================================
 *
 * `POST /api/files/{fileId}/cde`  ·  σώμα: `{ act, suitabilityCode?, reason?, supersededByFileId? }`
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ ΓΙΑΤΙ **ΜΙΑ** ΔΙΑΔΡΟΜΗ ΚΑΙ ΟΧΙ ΤΕΣΣΕΡΙΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Τέσσερα αρχεία `share/` · `seal/` · `release/` · `withdraw/` θα διέφεραν σε **ένα
 * literal** — ακριβώς η αστοχία που ονομάζει ο N.18 (*«κεντρικοποιείς το Α και γράφεις
 * Β+Γ ως δίδυμα»*) και που το **CHECK 3.28** μετρά ως κλώνο **μέσα στο ίδιο commit**.
 * Η πράξη είναι **δεδομένο** του αιτήματος, όχι σχήμα της διεύθυνσης.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΟ `withAuth` **ΔΕΝ** ΔΗΛΩΝΕΙ ΙΚΑΝΟΤΗΤΑ ΕΔΩ
 * ─────────────────────────────────────────────────────────────────────────────
 * Οι τέσσερις πράξεις θέλουν **τέσσερις διαφορετικές** ικανότητες. Μια στατική δήλωση
 * στο σύνορο θα ήταν είτε **πολύ χαλαρή** (η ίδια για όλες ⇒ ο μελετητής αποκτά
 * απελευθέρωση) είτε **πολύ σφιχτή** (η αυστηρότερη ⇒ κανείς δεν παραδίδει). Η
 * ικανότητα κρίνεται **ανά πράξη** μέσα στον γραφέα, με τον ΕΝΑ κριτή (ADR-801) —
 * δηλαδή στο σημείο που **ξέρει ποια** πράξη ζητήθηκε.
 *
 * ⚠️ Το σύνορο εξακολουθεί να απαιτεί **ταυτότητα** και **ιδιοκτησία** (`resolveContainerFile` →
 * `fileResource` για εταιρεία, `personalFileResource` για άνθρωπο). Καμία νέα μηχανή απομόνωσης.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🗂️ ΔΥΟ ΔΙΑΜΕΡΙΣΜΑΤΑ — ΚΑΙ Ο ΙΔΙΩΤΗΣ ΕΧΕΙ **ΜΙΑ** ΠΡΑΞΗ (ADR-866 Ε-Φ0-1)
 * ─────────────────────────────────────────────────────────────────────────────
 * `?custody=personal` ⇒ ο κάτοχος ζητά πράξη σε **δικό του** αρχείο. Από τις πέντε, μόνο η
 * **αντικατάσταση** (`supersede`) έχει νόημα: οι τέσσερις πράξεις **φάσης** παίρνουν ονομασμένη
 * άρνηση `no-project` από το **καθεστώς** του δοχείου (`container-regime-policy`, ADR-862 §5.3.7)
 * — **μέσα στον γραφέα**, όχι με δεύτερο φρουρό εδώ. Έτσι το «γιατί όχι» λέγεται **μία** φορά,
 * από το σημείο που το ξέρει.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚡ ΤΟ ΟΡΙΟ ΡΥΘΜΟΥ ΔΗΛΩΝΕΤΑΙ **ΕΔΩ**, ΡΗΤΑ (CHECK 3.78)
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ **ΜΗΝ το μεταφέρεις σε `defineRoute`**: το εργοστάσιο είναι στο **κλειστό σύνολο**
 * του CHECK 3.78 (`scripts/lib/rate-limit-policy/inventory.js:70`), οπότε νέα διαδρομή
 * μέσα από αυτό παράγει **νέα εργοστασιακή δήλωση** και **μπλοκάρει** — *«δεν είναι
 * λάθος, αλλά ΔΕΝ φαίνεται στην ανασκόπηση: ο αναγνώστης του `route.ts` δεν μπορεί να
 * δει ποιο όριο ισχύει»*. Το `/api/files` **δεν** έχει γραμμή στον πίνακα προθεμάτων
 * (προεπιλογή `STANDARD`), άρα η ρητή δήλωση κρίνεται `declared-over-default` = ✅.
 *
 * 🔒 `SENSITIVE` και όχι `STANDARD`: αυτές οι τέσσερις αλλάζουν **ποιος βλέπει τι** —
 * ίδια βαθμίδα με τα μονοπάτια ταυτότητας, όχι με την ανάγνωση καταλόγου.
 *
 * @module app/api/files/[fileId]/cde
 * @enterprise ADR-862 Φ0 Β6 · ADR-742 §7undecies (ο PEP των αρχείων)
 */

import { NextRequest, NextResponse } from 'next/server';
import { containerVisibilityRefusal } from '@/lib/auth/container-visibility-guard';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { isSuitabilityCode } from '@/services/iso19650/validators';
import { ACT_SPEC } from '@/services/iso19650/container-transition-policy';
import {
  transitionContainer,
  type ContainerAct,
  type ContainerActor,
  type ContainerTransitionOutcome,
  type ContainerTransitionRequest,
} from '@/services/iso19650/container-transitions';
import {
  withFileCustodyAuth,
  type FileCustodyCaller,
} from '../../_shared/file-custody-route';
// Οι δύο απαντήσεις + η φόρτωση ζουν ΜΙΑ φορά (N.18) — κοινές με `versions` και `versions/promote`.
import {
  authorityUnavailableResponse,
  fileNotFoundResponse,
  resolveContainerFile,
  type FileSegment,
} from '../../_shared/container-route-responses';

// ⚠️ Το τμήμα διαδρομής ζει **μία** φορά στο `_shared` (N.18) — εδώ μόνο ψευδώνυμο, ώστε το
//    υπόλοιπο αρχείο να μείνει ανέγγιχτο.
type Segment = FileSegment;

/**
 * Οι πέντε πράξεις **ως δεδομένα** — ο φρουρός στενεύει `unknown → ContainerAct`.
 * `supersede` (ADR-862 Φ0 Β10): σώμα `{ act: 'supersede', supersededByFileId }`.
 */
const CONTAINER_ACTS: readonly ContainerAct[] = ['share', 'seal', 'release', 'withdraw', 'supersede'];

function isContainerAct(value: unknown): value is ContainerAct {
  return typeof value === 'string' && (CONTAINER_ACTS as readonly string[]).includes(value);
}

/**
 * **Η έκβαση → HTTP.** Η άρνηση πολιτικής είναι **403 με όνομα**, ποτέ 500.
 *
 * 🔑 Το `why` ταξιδεύει στο σύρμα ως **σταθερό αναγνωριστικό**, όχι ως κείμενο: η
 * οθόνη το μεταφράζει (N.11). Χωρίς αυτό, ο άνθρωπος βλέπει «κάτι πήγε στραβά» εκεί
 * όπου το σύστημα ξέρει **ακριβώς** τι έλειπε.
 */
function toResponse(outcome: ContainerTransitionOutcome): NextResponse {
  if (outcome.kind === 'refused') {
    // `not-found` ⇒ 404 (ίδιο σχήμα με κάθε άλλη άρνηση ύπαρξης της οικογένειας).
    if (outcome.why === 'not-found' || outcome.why === 'tenant-mismatch') {
      return fileNotFoundResponse();
    }
    return NextResponse.json(
      { success: false, act: outcome.act, refused: outcome.why },
      { status: 403 },
    );
  }

  return NextResponse.json({ success: true, ...outcome }, { status: 200 });
}

/**
 * Το αίτημα προς τον γραφέα, από **ήδη επαληθευμένη** ταυτότητα και κριμένο σώμα.
 *
 * ⚠️ Τα δύο προαιρετικά μπαίνουν με **conditional spread**: ένα `suitabilityCode:
 * undefined` θα ταξίδευε μέχρι το Firestore, που το **απορρίπτει**.
 */
function transitionRequestOf(
  fileId: string,
  actor: ContainerActor,
  act: ContainerAct,
  payload: Record<string, unknown>,
): ContainerTransitionRequest {
  return {
    fileId,
    act,
    actor,
    ...(isSuitabilityCode(payload.suitabilityCode)
      ? { suitabilityCode: payload.suitabilityCode }
      : {}),
    ...(typeof payload.reason === 'string' && payload.reason.trim().length > 0
      ? { reason: payload.reason.trim() }
      : {}),
    // 🔑 Β10 — **ισχυρισμός** του πελάτη, ποτέ απόφαση: ο γραφέας τον **αποδεικνύει** μέσα
    //    στη συναλλαγή (`judgeSuccession`). Απόν ⇒ ονομασμένη άρνηση `successor-missing`.
    ...(act === 'supersede' && typeof payload.supersededByFileId === 'string' && payload.supersededByFileId.length > 0
      ? { supersededByFileId: payload.supersededByFileId }
      : {}),
  };
}

async function handlePost(
  request: NextRequest,
  caller: FileCustodyCaller,
  segment?: Segment,
): Promise<NextResponse> {
  const body: unknown = await request.json().catch(() => null);
  const payload = (body ?? {}) as Record<string, unknown>;

  if (!isContainerAct(payload.act)) {
    return NextResponse.json({ error: 'Invalid act', allowed: CONTAINER_ACTS }, { status: 400 });
  }

  // 🔒 Ο PEP: `fileId` → φόρτωσε → υπάρχει; → δικό μου; **στο διαμέρισμα που ζητήθηκε**, σε μία
  //    πράξη, με το «όχι» αυτής της διαδρομής. Το **ΥΠΑΡΧΟΝ** εργοστάσιο (ADR-742 · ADR-866).
  const resolved = await resolveContainerFile(segment, caller, 'cde');
  if (resolved.refusal) return resolved.refusal;
  const { fileId, actor } = resolved;

  // 🔒 Ο δεύτερος φρουρός: **βλέπει** καν αυτό το δοχείο; (ADR-862 Φ0 Β7→Β8)
  //
  // ⚠️ Το σώμα του ζούσε **εδώ** μέχρι το Β8. Μόλις οι διαδρομές bytes το
  //    χρειάστηκαν κι εκείνες, τρίτο χειρόγραφο αντίγραφο θα ήταν ο N.18 / CHECK
  //    3.28 **μέσα στο ίδιο commit** ⇒ εξήχθη στο `container-visibility-guard`.
  //
  // 🔑 Η ερώτηση μένει **η ικανότητα της συγκεκριμένης πράξης** (`ACT_SPEC`), όχι
  //    καρφωμένο «δες»: ο κριτής κλείνει με τον `decideCapability`, άρα γενικό
  //    όνομα θα έκρινε **άλλη** εξουσιοδότηση από αυτή που πρόκειται να ασκηθεί.
  //
  // ⚠️ Η άρνηση είναι το **ΙΔΙΟ** 404 της διαδρομής — ποτέ 403: ένα «δεν
  //    επιτρέπεσαι» πάνω σε δοχείο που ο αιτών δεν δικαιούται να **δει**
  //    ανακοινώνει ότι υπάρχει (ADR-742 §7.1).
  //
  // 🔑 **ΜΟΝΟ ΓΙΑ ΕΤΑΙΡΕΙΑ** (ADR-866 Ε-Φ0-1): προσωπικό δοχείο **δεν έχει φάση** ⇒ δεν υπάρχει
  //    ορατότητα φάσης να κριθεί, και η άρνηση των τεσσάρων πράξεων φάσης δεν ανήκει εδώ: τη
  //    δίνει **ονομασμένη** (`no-project`) ο ΕΝΑΣ γραφέας, από το **καθεστώς** του δοχείου
  //    (`container-regime-policy`). Δεύτερος φρουρός εδώ θα ήταν δεύτερη κρίση για το ίδιο.
  if (caller.custody === 'company') {
    const refusal = await containerVisibilityRefusal({
      fileId,
      caller: caller.ctx,
      action: ACT_SPEC[payload.act].capability,
      raw: resolved.doc.data,
      notFound: fileNotFoundResponse,
      unavailable: authorityUnavailableResponse,
    });
    if (refusal) return refusal;
  }

  return toResponse(await transitionContainer(transitionRequestOf(fileId, actor, payload.act, payload)));
}

// ⚠️ **ΚΑΜΙΑ ικανότητα στο σύνορο — αμετάβλητο** (δες την αιτιολογία στην κεφαλή): η πόρτα
//    διαμερίσματος δέχεται **προαιρετικό** `permissions` ακριβώς ώστε αυτή η απόφαση να μη χρειαστεί
//    να σπάσει. Η ικανότητα κρίνεται **ανά πράξη** μέσα στον γραφέα, με τον ΕΝΑ κριτή.
export const POST = withSensitiveRateLimit(withFileCustodyAuth<Segment>(handlePost));
