/**
 * =============================================================================
 * Το **σύνορο αποκάλυψης** των routes υποβάθρου (ADR-742 §3.4)
 * =============================================================================
 *
 * Η υπηρεσία λέει πάντα την αλήθεια· **εδώ** κρίνεται τι από αυτήν φεύγει στο
 * σύρμα. Είναι το μόνο στρώμα που ξέρει *ποιος* ρωτάει.
 *
 * Ο κανόνας δεν είναι «διάλεξε κωδικό» αλλά **«θα μπορούσε ο καλών να το μάθει
 * νόμιμα με άλλον τρόπο;»**. Στον Νέστορα η λίστα υποβάθρων είναι πάντα
 * tenant-scoped, άρα κανονικός χρήστης **δεν μπορεί ποτέ** να μάθει νόμιμα ότι
 * υπάρχει ξένο id → σιωπή. Ο bypass ρόλος έχει ήδη cross-tenant ορατότητα → η
 * ειλικρινής άρνηση δεν του αποκαλύπτει τίποτα νέο και του σώζει τη διάγνωση.
 *
 * ⚠️ Υπήρχε σε **τρία** routes ως `msg.includes('Cross-tenant')` — απόφαση
 * ασφαλείας που κρεμόταν από κείμενο μηνύματος. Τώρα είναι `instanceof`, εδώ.
 *
 * @module api/floorplan-backgrounds/_background-error-response
 * @see ADR-742 · ADR-340 Phase 7/9
 */

import { NextResponse } from 'next/server';
import type { AuthContext } from '@/lib/auth';
import { CrossTenantAccessError, concealCrossTenant } from '@/lib/auth/tenant-ownership';
import {
  BackgroundLockedError,
  BackgroundNotFoundError,
} from '@/services/floorplan-background/background-ownership';

/**
 * Κακό αίτημα — η μορφή σφάλματος 4xx που μοιράζονται τα routes υποβάθρου.
 *
 * Ήταν γραμμένη χωριστά σε **δύο** routes· ίδιο σχήμα, καμία εγγύηση ότι θα
 * έμενε ίδιο. Το σχήμα σφάλματος **είναι** δημόσιο συμβόλαιο (οι clients
 * διαβάζουν `body.error` αυτούσιο) — μία πηγή, όχι δύο.
 */
export function badRequest(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message, code: 'BAD_REQUEST' }, { status });
}

/**
 * Η **τυπική** μορφή του «δεν βρέθηκε» για τα routes υποβάθρου.
 *
 * 🔴 Το μήνυμα το παράγει ο **ίδιος constructor** που χρησιμοποιεί και η
 * υπηρεσία στο γνήσιο μονοπάτι. Χειρόγραφο string εδώ θα έκανε το μεταμφιεσμένο
 * 404 να διαφέρει από το γνήσιο — και τότε **το ίδιο το κείμενο γίνεται
 * μαντείο ύπαρξης** και η μεταμφίεση δεν κρύβει τίποτα.
 */
export function backgroundNotFoundResponse(backgroundId: string): NextResponse {
  const err = new BackgroundNotFoundError(backgroundId);
  return NextResponse.json({ error: err.message, code: err.code }, { status: 404 });
}

export interface BackgroundErrorSpec {
  readonly err: unknown;
  /** Ο **καθολικός** ρόλος του καλούντος — ό,τι κρίνει την αποκάλυψη. */
  readonly ctx: Pick<AuthContext, 'globalRole'>;
  /**
   * Το **ΕΝΑ** «δεν βρέθηκε» αυτής της διαδρομής.
   *
   * Το ίδιο callback εξυπηρετεί **και** το γνήσιο **και** το μεταμφιεσμένο 404,
   * ώστε η ταυτότητα των δύο αποκρίσεων να είναι **δομική** και όχι θέμα
   * προσοχής: δεν υπάρχει τρόπος να αποκλίνουν χωρίς να αλλάξουν και τα δύο.
   * Παραμετροποιείται επειδή το `DELETE` έχει δικό του σχήμα (`{ deleted: false }`).
   */
  readonly notFound: () => NextResponse;
}

/**
 * Σφάλμα υπηρεσίας υποβάθρου → HTTP, **με την απόφαση αποκάλυψης**.
 *
 * @returns `null` όταν το σφάλμα **δεν** ανήκει στο πεδίο ορισμού του υποβάθρου
 *          — ο καλών το χειρίζεται ως εσωτερικό σφάλμα με το δικό του σχήμα.
 *          Ρητό `null` αντί για γενικό `500` εδώ: το κάθε route έχει διαφορετικό
 *          σχήμα σφάλματος 500 και δεν δικαιούμαστε να το αλλάξουμε από εδώ.
 */
export function backgroundErrorResponse(spec: BackgroundErrorSpec): NextResponse | null {
  const { err, ctx, notFound } = spec;

  if (err instanceof BackgroundNotFoundError) return notFound();

  if (err instanceof CrossTenantAccessError) {
    return concealCrossTenant(ctx.globalRole, {
      // Ο bypass ρόλος παίρνει την αλήθεια — ό,τι ξέρει ήδη, με τη διάγνωση.
      reveal: () => NextResponse.json({ error: err.message, code: 'FORBIDDEN' }, { status: 403 }),
      // Κάθε άλλος: ξένο ≡ ανύπαρκτο, **στο ίδιο ακριβώς σώμα**.
      conceal: notFound,
    });
  }

  if (err instanceof BackgroundLockedError) {
    // ⚠️ Ξεχωριστός κλάδος **επίτηδες**: μέχρι το ADR-742 έμπαινε στον ίδιο
    // κλάδο με το cross-tenant και έβγαινε ως `409 FORBIDDEN`. Είναι όμως το
    // αντίθετο — μαρτυρά ότι ο πόρος υπάρχει **και σου ανήκει**, πράγμα που ο
    // χρήστης δικαιούται να ξέρει.
    return NextResponse.json({ error: err.message, code: err.code }, { status: 409 });
  }

  return null;
}
