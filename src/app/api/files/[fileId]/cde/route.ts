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
 * ⚠️ Το σύνορο εξακολουθεί να απαιτεί **ταυτότητα** (`withAuth`) και **ιδιοκτησία
 * μισθωτή** (`fileResource.load`). Καμία νέα μηχανή απομόνωσης.
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
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionCache } from '@/lib/auth';
import { containerVisibilityRefusal } from '@/lib/auth/container-visibility-guard';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { isSuitabilityCode } from '@/services/iso19650/validators';
import { ACT_SPEC } from '@/services/iso19650/container-transition-policy';
import {
  containerActorOf,
  transitionContainer,
  type ContainerAct,
  type ContainerTransitionOutcome,
  type ContainerTransitionRequest,
} from '@/services/iso19650/container-transitions';
import { fileResource } from '../../_shared/file-ownership';

type Segment = { params: Promise<{ fileId: string }> };

/**
 * Οι πέντε πράξεις **ως δεδομένα** — ο φρουρός στενεύει `unknown → ContainerAct`.
 * `supersede` (ADR-862 Φ0 Β10): σώμα `{ act: 'supersede', supersededByFileId }`.
 */
const CONTAINER_ACTS: readonly ContainerAct[] = ['share', 'seal', 'release', 'withdraw', 'supersede'];

function isContainerAct(value: unknown): value is ContainerAct {
  return typeof value === 'string' && (CONTAINER_ACTS as readonly string[]).includes(value);
}

/**
 * Το **ένα** «δεν βρέθηκε» αυτής της διαδρομής (ADR-742 §7.1).
 *
 * ⚠️ Το καλούν **και οι δύο** κλάδοι — γνήσια απουσία **και** ξένος μισθωτής — με
 * **μηδέν ορίσματα**: δεν υπάρχει τιμή που θα μπορούσε να τους διαφοροποιήσει, άρα ο
 * αιτών δεν μπορεί να χρησιμοποιήσει τη διαδρομή ως **μαντείο ύπαρξης**.
 */
const fileNotFoundResponse = (): NextResponse =>
  NextResponse.json({ error: fileResource.notFoundMessage }, { status: 404 });

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
 * Η **αυθεντία δεν απάντησε** — 503, ποτέ «δεν επιτρέπεσαι».
 *
 * 🔴 *Άγνωστο ≠ κενό* (N.12). Ένα 403/404 εδώ θα έλεγε στον μηχανικό «δεν
 * συμμετέχεις σε αυτή την υπόθεση» επειδή **έπεσε το δίκτυο** — και θα τον
 * έστελνε να ζητήσει δικαιώματα που **έχει**. Το 503 λέει την αλήθεια: *ξαναδοκίμασε*.
 */
const authorityUnavailableResponse = (): NextResponse =>
  NextResponse.json({ success: false, error: 'authority-unavailable' }, { status: 503 });

/**
 * Το αίτημα προς τον γραφέα, από **ήδη επαληθευμένη** ταυτότητα και κριμένο σώμα.
 *
 * ⚠️ Τα δύο προαιρετικά μπαίνουν με **conditional spread**: ένα `suitabilityCode:
 * undefined` θα ταξίδευε μέχρι το Firestore, που το **απορρίπτει**.
 */
function transitionRequestOf(
  fileId: string,
  ctx: AuthContext,
  act: ContainerAct,
  payload: Record<string, unknown>,
): ContainerTransitionRequest {
  return {
    fileId,
    act,
    actor: containerActorOf(ctx),
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
  ctx: AuthContext,
  _cache: PermissionCache,
  segment?: Segment,
): Promise<NextResponse> {
  const fileId = (await segment?.params)?.fileId;
  if (!fileId) {
    return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
  }

  const body: unknown = await request.json().catch(() => null);
  const payload = (body ?? {}) as Record<string, unknown>;

  if (!isContainerAct(payload.act)) {
    return NextResponse.json({ error: 'Invalid act', allowed: CONTAINER_ACTS }, { status: 400 });
  }

  // 🔒 Ο PEP: φόρτωσε → υπάρχει; → δικό μου; σε **μία** πράξη, με το «όχι» αυτής της
  //    διαδρομής. Το **ΥΠΑΡΧΟΝ** εργοστάσιο — καμία νέα μηχανή απομόνωσης (ADR-742).
  const owned = await fileResource.load({
    docId: fileId,
    caller: ctx,
    action: 'cde',
    refusal: fileNotFoundResponse,
  });
  if (owned.refusal) return owned.refusal;

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
  const refusal = await containerVisibilityRefusal({
    fileId,
    caller: ctx,
    action: ACT_SPEC[payload.act].capability,
    raw: owned.doc.data,
    notFound: fileNotFoundResponse,
    unavailable: authorityUnavailableResponse,
  });
  if (refusal) return refusal;

  return toResponse(await transitionContainer(transitionRequestOf(fileId, ctx, payload.act, payload)));
}

export const POST = withSensitiveRateLimit(withAuth<unknown, Segment>(handlePost));
