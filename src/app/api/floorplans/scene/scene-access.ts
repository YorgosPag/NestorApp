/**
 * Ποιος βλέπει ΑΥΤΗ τη σκηνή — η **μία** απόφαση της διαδρομής
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ (ADR-742 §7undecies · N.7.1)
 * ─────────────────────────────────────────────────────────────────────────────
 * Η διαδρομή σκηνής είναι η **μόνη** του πόρου `file` με **τρεις** τάξεις
 * καλούντος — ανώνυμος, συνδεδεμένος με δικαίωμα, συνδεδεμένος χωρίς — και δύο
 * ανεξάρτητους λόγους να πει «ναι» (ιδιοκτησία **ή** δημοσιότητα). Γραμμένη
 * ενσωματωμένη στον χειριστή ήταν 60 γραμμές με τέσσερα εμφωλευμένα `if`, όπου
 * ο έλεγχος tenant και ο έλεγχος δικαιώματος ήταν πλεγμένοι.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΛΛΑΞΕ ΣΤΗ ΣΥΜΠΕΡΙΦΟΡΑ — ΚΑΙ ΓΙΑΤΙ ΚΑΘΕ ΑΛΛΑΓΗ ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * **(α) Το ξένο αρχείο απαντά `404`, όχι `403`.** Ο καλών δεν ξεχωρίζει πια το
 * ξένο id από το ανύπαρκτο (§3.3). Το ίχνος ελέγχου κρατά την αλήθεια (§3.4).
 *
 * **(β) Αρχείο χωρίς `companyId` δεν ανήκει σε κανέναν.** Η παλιά γραφή
 * `if (file.companyId && …)` παρέκαμπτε τον έλεγχο **επίτηδες** όταν έλειπε ο
 * tenant — δηλαδή το έδινε σε **οποιονδήποτε** συνδεδεμένο (§4).
 *
 * **(γ) Η δημοσιότητα ελέγχεται ΚΑΙ όταν η ιδιοκτησία λέει όχι.** Παλιά ο
 * έλεγχος tenant προηγούνταν και **έκοβε οριστικά**: ένα σχέδιο δημόσια
 * αναρτημένου ακινήτου το έβλεπε ο **ανώνυμος** επισκέπτης, αλλά ο συνδεδεμένος
 * χρήστης άλλης εταιρείας έπαιρνε `403`. Το (β) θα είχε μετατρέψει αυτή την
 * ασυνέπεια σε **σπασμένη δημόσια σελίδα** για κάθε αρχείο χωρίς tenant.
 *
 * 🔑 Το κριτήριο του §3.3 είναι *«θα μπορούσε ο καλών να το μάθει **νόμιμα**
 * αλλιώς;»*. Για δημόσιο σχέδιο η απάντηση είναι **ναι — χωρίς καν να συνδεθεί**.
 * Άρα η άρνηση σε συνδεδεμένο χρήστη δεν κρύβει τίποτα· απλώς χαλάει.
 *
 * @module app/api/floorplans/scene/scene-access
 * @see ../../files/_shared/file-ownership — η δήλωση του πόρου
 * @see ADR-742 §3.3, §3.4, §4, §7undecies
 */

import 'server-only';

import { NextResponse } from 'next/server';
import type { AuthContext } from '@/lib/auth';
import { createPermissionCache, hasPermission } from '@/lib/auth/permissions';
import { createModuleLogger } from '@/lib/telemetry';
import { fileResource } from '../../files/_shared/file-ownership';
import { isFilePublic, type FileRecordData } from './scene-fetcher';

const logger = createModuleLogger('FloorplanSceneAccess');

/** Το δικαίωμα που ζητούσε ήδη η διαδρομή — καρφωμένο, όχι παραμετροποιημένο. */
const SCENE_PERMISSION = 'floorplans:floorplans:process';

/**
 * Το **ένα** «δεν βρέθηκε» της διαδρομής.
 *
 * Το καλούν **και οι δύο** κλάδοι — το αρχείο όντως λείπει (στον χειριστή), ή
 * ανήκει αλλού και δεν είναι δημόσιο (εδώ) — με **μηδέν ορίσματα**, ώστε να μην
 * υπάρχει τιμή που θα μπορούσε να τους διαφοροποιήσει (§7.1).
 */
export function sceneFileNotFound(): NextResponse {
  return NextResponse.json(
    { success: false, error: fileResource.notFoundMessage },
    { status: 404 },
  );
}

export interface SceneAccessSpec {
  /** Το αρχείο **όπως βγήκε από τη βάση** — ποτέ στενεμένο (§7.5). */
  readonly file: FileRecordData;
  readonly fileId: string;
  readonly ctx: AuthContext;
}

/**
 * Αποφασίζει αν ο **συνδεδεμένος** καλών βλέπει τη σκηνή.
 *
 * Ο ανώνυμος κρίνεται στον χειριστή: εκεί η απάντηση είναι `401` (άρνηση
 * **ταυτότητας**, όχι εγγράφου) και δεν μαρτυρά τίποτα για το id.
 *
 * @returns `null` όταν επιτρέπεται, αλλιώς η απάντηση που πρέπει να φύγει
 */
export async function authorizeSceneAccess(spec: SceneAccessSpec): Promise<NextResponse | null> {
  const { file, fileId, ctx } = spec;

  const verdict = fileResource.check({
    data: file,
    caller: ctx,
    resourceId: fileId,
    action: 'scene',
  });

  if (verdict === 'denied') {
    // Ξένο ή χωρίς tenant: **μόνο** η δημοσιότητα το δικαιολογεί — και τη
    // δικαιολογεί ολόκληρη, αφού ο ανώνυμος το παίρνει ήδη.
    if (await isFilePublic(file)) {
      logger.info('Δημόσιο σχέδιο εκτός tenant — επιτρέπεται', { fileId, email: ctx.email });
      return null;
    }
    return sceneFileNotFound();
  }

  if (await hasPermission(ctx, SCENE_PERMISSION, {}, createPermissionCache())) {
    return null;
  }

  if (await isFilePublic(file)) {
    logger.info('Auth user with public project access granted', { email: ctx.email, fileId });
    return null;
  }

  // Άρνηση **δικαιώματος**, όχι εγγράφου: ο καλών κατέχει το αρχείο, άρα ξέρει
  // ήδη ότι υπάρχει. Νόμιμο 403 (§3.3 — «τι ΔΕΝ βλέπει» του anchor).
  logger.warn('Permission denied', { email: ctx.email, fileId });
  return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
}
