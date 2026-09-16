/**
 * =============================================================================
 * ΟΙ ΤΕΣΣΕΡΙΣ ΠΡΑΞΕΙΣ ΤΟΥ ΔΟΧΕΙΟΥ — **ΜΙΑ** διαδρομή (ADR-862 Φ0 Β6)
 * =============================================================================
 *
 * `POST /api/files/{fileId}/cde`  ·  σώμα: `{ act, suitabilityCode?, reason? }`
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
import { decideContainerAccess } from '@/lib/auth/container-access';
import { containerSubjectFor } from '@/lib/auth/container-subject';
import { containerFactsOf, readFileRecord } from '@/lib/files/file-record-read';
import { withSensitiveRateLimit } from '@/lib/middleware/with-rate-limit';
import { isContainerVisible } from '@/types/container-access';
import { isSuitabilityCode } from '@/services/iso19650/validators';
import { ACT_SPEC } from '@/services/iso19650/container-transition-policy';
import {
  transitionContainer,
  type ContainerAct,
  type ContainerTransitionOutcome,
  type ContainerTransitionRequest,
} from '@/services/iso19650/container-transitions';
import { fileResource } from '../../_shared/file-ownership';

type Segment = { params: Promise<{ fileId: string }> };

/** Οι τέσσερις πράξεις **ως δεδομένα** — ο φρουρός στενεύει `unknown → ContainerAct`. */
const CONTAINER_ACTS: readonly ContainerAct[] = ['share', 'seal', 'release', 'withdraw'];

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
 * 🔒 **ΔΕΝ ΕΝΕΡΓΕΙΣ ΣΕ ΔΟΧΕΙΟ ΠΟΥ ΔΕΝ ΒΛΕΠΕΙΣ** — ο **πρώτος καταναλωτής
 * παραγωγής** του κριτή του Β5 (ADR-862 Φ0 Β7).
 *
 * ⚠️ **ΚΑΜΙΑ ΔΕΥΤΕΡΗ ΑΝΑΓΝΩΣΗ**: το `fileResource.load` επιστρέφει ήδη το ωμό
 * `doc.data` (`lib/auth/owned-doc-loader.ts:154`), οπότε τα γεγονότα χτίζονται από
 * ό,τι **έχουμε στο χέρι**. Ένα δεύτερο `get()` θα πρόσθετε κόστος **και** ένα
 * παράθυρο όπου τα δύο διαβάσματα διαφωνούν.
 *
 * 🔑 **Η ΕΡΩΤΗΣΗ ΕΙΝΑΙ Η ΙΚΑΝΟΤΗΤΑ ΤΗΣ ΣΥΓΚΕΚΡΙΜΕΝΗΣ ΠΡΑΞΗΣ** (`ACT_SPEC`), όχι
 * ένα καρφωμένο «δες»: ο κριτής κλείνει με τον `decideCapability`, άρα ένα γενικό
 * όνομα εδώ θα έκρινε **άλλη** εξουσιοδότηση από αυτή που πρόκειται να ασκηθεί.
 *
 * ⚠️ **Η άρνηση είναι το ΙΔΙΟ 404 της διαδρομής** — ποτέ 403: ένα «δεν
 * επιτρέπεσαι» πάνω σε δοχείο που ο αιτών δεν δικαιούται να **δει** ανακοινώνει
 * ότι υπάρχει (ADR-742 §7.1). Γι' αυτό καλείται **μετά** τον φρουρό μισθωτή και
 * με το **ίδιο** εργοστάσιο άρνησης.
 *
 * 🔴 Ένα `unreadable` δοχείο κόβεται **εδώ** (404) και δεν φτάνει στον γραφέα —
 * που θα το αρνιόταν κι εκείνος (`refused: 'unreadable'` ⇒ 403). Η **αυστηρότερη**
 * από τις δύο αρνήσεις νικά, όπως επιβάλλει το fail-closed.
 */
async function containerRefusal(
  fileId: string,
  ctx: AuthContext,
  act: ContainerAct,
  raw: unknown,
): Promise<NextResponse | null> {
  const read = readFileRecord(raw, fileId);
  if (read.outcome === 'unreadable') return fileNotFoundResponse();

  const built = await containerSubjectFor({
    caller: ctx,
    // 🔑 Η υπόθεση έρχεται από το **έγγραφο**, ποτέ από το σώμα του αιτήματος.
    projectId: read.record.projectId,
  });
  if (built.outcome === 'unknown') return authorityUnavailableResponse();

  const decision = decideContainerAccess({
    subject: built.subject,
    facts: containerFactsOf(read.record, read.state),
    action: ACT_SPEC[act].capability,
  });

  return isContainerVisible(decision.verdict) ? null : fileNotFoundResponse();
}

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
    actor: {
      uid: ctx.uid,
      companyId: ctx.companyId,
      globalRole: ctx.globalRole,
      // 🔑 ADR-801 Φ3γ — οι **ρητά δοσμένες** ικανότητες του claim. Χωρίς αυτές, η
      //    προ-εξουσιοδότηση του Ε-12 (απελευθέρωση σε ονομασμένο μελετητή) θα ήταν
      //    γραμμένη και **ανενεργή**: ο κριτής θα έκρινε μόνο από ρόλο.
      permissions: ctx.permissions,
    },
    ...(isSuitabilityCode(payload.suitabilityCode)
      ? { suitabilityCode: payload.suitabilityCode }
      : {}),
    ...(typeof payload.reason === 'string' && payload.reason.trim().length > 0
      ? { reason: payload.reason.trim() }
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

  // 🔒 Ο δεύτερος φρουρός: **βλέπει** καν αυτό το δοχείο; (ADR-862 Φ0 Β7)
  const refusal = await containerRefusal(fileId, ctx, payload.act, owned.doc.data);
  if (refusal) return refusal;

  return toResponse(await transitionContainer(transitionRequestOf(fileId, ctx, payload.act, payload)));
}

export const POST = withSensitiveRateLimit(withAuth<unknown, Segment>(handlePost));
