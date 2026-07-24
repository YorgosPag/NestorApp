/**
 * =============================================================================
 * STORAGE: ORPHAN CANDIDATE MARKER (onFinalize) — ADR-694 Απόφαση Α1
 * =============================================================================
 *
 * 🔴 **ΑΥΤΗ Η ΣΥΝΑΡΤΗΣΗ ΔΕΝ ΔΙΑΓΡΑΦΕΙ ΠΟΤΕ ΑΡΧΕΙΑ.** Είναι η πλευρά «mark» ενός
 * mark-and-sweep. Η ανάκτηση χώρου ζει αποκλειστικά στον `orphanSweeper`, τρέχει
 * ημερησίως, και απαιτεί **θετική απόδειξη ορφανότητας** + παράθυρο ημερών.
 *
 * ## Γιατί άλλαξε (ADR-694 §2 — μετρημένο, όχι υπόθεση)
 *
 * Η προηγούμενη έκδοση διέγραφε κάθε αρχείο κάτω από `companies/` που δεν έβρισκε
 * claim, μετά από grace window 12 δευτερολέπτων. Αποτέλεσμα, από τα Cloud Function
 * logs της περιόδου 12–24/07/2026:
 *
 *   | υποσύστημα                  | νόμιμα αρχεία που διαγράφηκαν |
 *   |-----------------------------|-------------------------------|
 *   | bim-material-textures       | 28                            |
 *   | imported-meshes             | 20                            |
 *   | block-library               | 10                            |
 *   | bim-material-thumbnails     |  3                            |
 *
 * **61 αρχεία σε 13 ημέρες, σε 4 υποσυστήματα.** Ο μηχανισμός ήταν σωστά γραμμένος
 * για τη λάθος ερώτηση: ρωτούσε «βρίσκω απόδειξη ότι κάποιος το κατέχει;» και
 * θεωρούσε το «όχι» ισοδύναμο με «είναι σκουπίδι». Δεν είναι — μπορεί κάλλιστα να
 * σημαίνει «νέο υποσύστημα που δεν ξέρω ακόμη».
 *
 * Ήταν το **3ο incident της ίδιας κλάσης**: 2026-04-17 (showcase PDFs → ADR-312),
 * 2026-07-22 (imported meshes → ADR-683 §11), 2026-07-24 (textures/blocks/thumbnails).
 * Κάθε φορά η αντίδραση ήταν «πρόσθεσε άλλον έναν provider» — patching του συμπτώματος,
 * που αφήνει το επόμενο υποσύστημα εξίσου εκτεθειμένο. Το ADR-694 αλλάζει την ερώτηση.
 *
 * ## Το πρότυπο
 *
 * Kubernetes GC: dependent σβήνεται μόνο σε **σπασμένη** owner reference· object χωρίς
 * καμία reference δεν αγγίζεται ποτέ (https://kubernetes.io/docs/concepts/architecture/garbage-collection/).
 * Google SRE Book: soft deletion με παράθυρο ημερών, και η αρχιτεκτονική οφείλει να
 * «hinder developers from circumventing» το safety net (https://sre.google/sre-book/data-integrity/).
 * AWS S3: ακόμη και το αναμφισβήτητα ορφανό (ημιτελές multipart upload) παίρνει 7 ημέρες.
 *
 * @module functions/storage/orphan-cleanup
 * @enterprise ADR-694 Α1 — mark-only· μηδέν διαγραφή σε real-time μονοπάτι
 * @see ./storage-path-custody.ts — ποιος κατέχει τι (SSoT)
 * @see ./orphan-sweeper.ts — ο ΜΟΝΟΣ που διαγράφει
 * @see ./orphan-spike-alert.ts — ADR-327 Layer 3 observability
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

import { COLLECTIONS } from '../config/firestore-collections';
import { resolveCustody } from './storage-path-custody';

/**
 * Σταθερό doc id από το storage path: base64url, χωρίς `/` (απαγορευμένο σε doc ids)
 * και χωρίς padding. Ίδιο path → ίδιο έγγραφο → το re-upload ενημερώνει, δεν
 * πολλαπλασιάζει (idempotent).
 */
export function candidateDocId(filePath: string): string {
  return Buffer.from(filePath, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Καταγράφει/ανανεώνει έναν υποψήφιο προς ανάκτηση. Το `firstSeenAt` γράφεται **μόνο
 * την πρώτη φορά** (`merge` χωρίς overwrite) ώστε το παράθυρο διατήρησης να μετρά από
 * την πρώτη παρατήρηση, όχι από την τελευταία — αλλιώς ένα αρχείο που ξαναγράφεται
 * τακτικά δεν θα ωρίμαζε ποτέ.
 */
async function markCandidate(
  filePath: string,
  outcome: { readonly kind: string; readonly rule?: string; readonly reason?: string },
  object: functions.storage.ObjectMetadata,
): Promise<void> {
  const ref = db.collection(COLLECTIONS.STORAGE_ORPHAN_CANDIDATES).doc(candidateDocId(filePath));
  const snap = await ref.get();
  await ref.set(
    {
      storagePath: filePath,
      custodyKind: outcome.kind,
      custodyRule: outcome.rule ?? null,
      unknownReason: outcome.reason ?? null,
      contentType: object.contentType ?? null,
      size: object.size ?? null,
      lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(snap.exists ? {} : { firstSeenAt: admin.firestore.FieldValue.serverTimestamp() }),
    },
    { merge: true },
  );
}

/** Ένας υποψήφιος που απέκτησε ιδιοκτήτη παύει να είναι υποψήφιος (self-healing). */
async function clearCandidate(filePath: string): Promise<void> {
  await db
    .collection(COLLECTIONS.STORAGE_ORPHAN_CANDIDATES)
    .doc(candidateDocId(filePath))
    .delete()
    .catch(() => {
      /* δεν υπήρχε — η συνήθης περίπτωση */
    });
}

export const onStorageFinalize = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .storage.object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    if (!filePath) return;

    // Μόνο enterprise paths· temp/ και cad/ εξαιρούνται εξ ορισμού.
    if (!filePath.startsWith('companies/')) return;

    // Companion thumbnails ({fileId}_thumb.{ext}) — παράγωγα, ζουν όσο ο γονιός τους.
    const fileName = filePath.split('/').pop();
    if (!fileName || fileName.includes('_thumb.')) return;

    const custody = await resolveCustody(db, filePath);

    if (custody.kind === 'claimed') {
      // Μπορεί να ήταν υποψήφιος από προηγούμενη παρατήρηση (π.χ. το claim γράφτηκε
      // μετά το upload — debounced auto-save, ADR-683 §11). Καθαρίζουμε το σημάδι.
      await clearCandidate(filePath);
      return;
    }

    await markCandidate(filePath, custody, object);

    // ⚠️ ΚΑΜΙΑ ΔΙΑΓΡΑΦΗ ΕΔΩ — by design (ADR-694 Α1). Το `unknown` δεν είναι καν
    // υποψήφιο προς ανάκτηση· καταγράφεται ώστε τα κενά του μητρώου custody να είναι
    // μετρήσιμα αντί για αόρατα.
    functions.logger.info('Storage custody: candidate recorded (no deletion)', {
      filePath,
      custodyKind: custody.kind,
      custodyRule: custody.kind === 'orphaned' ? custody.rule : undefined,
      unknownReason: custody.kind === 'unknown' ? custody.reason : undefined,
      contentType: object.contentType,
      size: object.size,
    });
  });
