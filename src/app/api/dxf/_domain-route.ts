/**
 * =============================================================================
 * Η **σύνδεση** ενός DXF route — μία φορά (N.18 / ADR-583)
 * =============================================================================
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: έντεκα endpoints των προτύπων κειμένου και του λεξικού
 * ορθογραφίας έγραφαν το **ίδιο ακριβώς** δεκάγραμμο σκελετό — ρυθμιστής
 * ρυθμού, έλεγχος ταυτότητας, δικαιώματα, `try/catch`, καταγραφή, χαρτογράφηση
 * σφάλματος. Το `jscpd` το μετρούσε ως τρία clones **ήδη στο HEAD**· ό,τι κι αν
 * άγγιζε κανείς σε αυτά τα αρχεία, το CHECK 3.28 έκοβε.
 *
 * Δεν είναι «λίγος κώδικας που μοιάζει». Είναι η **αλυσίδα ασφαλείας** κάθε
 * endpoint: αν κάποιο αντίγραφο ξεχάσει τον ρυθμιστή ρυθμού ή τυλίξει το
 * `try/catch` λίγο πιο μέσα, η διαφορά **δεν φαίνεται πουθενά** — το endpoint
 * απαντά κανονικά, απλώς είναι λιγότερο προστατευμένο από τα αδέλφια του.
 * Γραμμένη μία φορά, η παράλειψη γίνεται αδύνατη αντί για απίθανη.
 *
 * ⚠️ Ο ρυθμιστής ρυθμού είναι σκόπιμα **καρφωμένος** σε `STANDARD` και δεν
 * παραμετροποιείται: και τα έντεκα endpoints είχαν `withStandardRateLimit`.
 * Παράμετρος που έχει μία μόνο τιμή σε όλους τους καλούντες δεν είναι
 * ευελιξία — είναι πρόσκληση να διαφοροποιηθεί κάποιος αθόρυβα. Όταν
 * χρειαστεί δεύτερη κατηγορία, **τότε** μπαίνει στο `spec`, ρητά.
 *
 * Το `errorResponse` περνιέται στο εργοστάσιο (όχι σε κάθε κλήση) επειδή είναι
 * χαρακτηριστικό **του πεδίου ορισμού**, όχι του endpoint: κάθε πεδίο κρατά τα
 * δικά του `code` και μηνύματα — δημόσιο συμβόλαιο που ήδη καταναλώνουν clients
 * (βλ. `_domain-error-mapping.ts`).
 *
 * @module api/dxf/_domain-route
 * @see ADR-742 §3.4 (η απόφαση αποκάλυψης που τρέχει στο `catch`)
 */

import type { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import type { AuthContext, PermissionId } from '@/lib/auth';
import { withStandardRateLimit } from '@/lib/middleware/with-rate-limit';

export interface DxfRouteSpec {
  /** Τα δικαιώματα αυτού **του** endpoint — ποτέ κοινά, ποτέ προεπιλογή. */
  readonly permissions: PermissionId | PermissionId[];
  /**
   * Καταγραφή της **αλήθειας**, πριν τη μεταμφίεση.
   *
   * Χωριστά από τη χαρτογράφηση επίτηδες: το log κρατά ό,τι πραγματικά συνέβη
   * (ADR-742), ενώ στο σύρμα μπορεί να φύγει σιωπή. Το επίπεδο και τα
   * συμφραζόμενα διαφέρουν ανά endpoint, γι' αυτό μένουν στον καλούντα.
   */
  readonly onError: (err: unknown, ctx: AuthContext) => void;
}

/** Η **καθαρή** δουλειά του endpoint: ό,τι μένει αφού φύγει ο σκελετός. */
export type DxfRouteWork = (req: NextRequest, ctx: AuthContext) => Promise<NextResponse>;

/**
 * Φτιάχνει τον εκτελεστή route ενός πεδίου ορισμού, δεμένο με τη δική του
 * χαρτογράφηση σφαλμάτων.
 *
 * Τα δυναμικά τμήματα διαδρομής (`[entryId]`, `[templateId]`) **δεν** περνούν
 * από εδώ: ο καλών τα διαβάζει από το `segmentData` και τα κλείνει σε closure,
 * όπως έκανε και πριν. Έτσι ο εκτελεστής μένει ένας, ανεξάρτητα από το αν η
 * διαδρομή έχει παραμέτρους ή όχι.
 */
export function makeDxfRouteRunner(
  errorResponse: (err: unknown, ctx: Pick<AuthContext, 'globalRole'>) => NextResponse,
) {
  return function runDxfRoute(
    request: NextRequest,
    spec: DxfRouteSpec,
    work: DxfRouteWork,
  ): Promise<Response> | Response {
    const handler = withStandardRateLimit(
      withAuth<unknown>(
        async (req: NextRequest, ctx: AuthContext) => {
          try {
            return await work(req, ctx);
          } catch (err) {
            spec.onError(err, ctx);
            return errorResponse(err, ctx);
          }
        },
        { permissions: spec.permissions },
      ),
    );
    return handler(request);
  };
}
