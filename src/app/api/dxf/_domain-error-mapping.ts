/**
 * =============================================================================
 * Σφάλμα πεδίου ορισμού → HTTP, **με την απόφαση αποκάλυψης** (ADR-742 §3.4)
 * =============================================================================
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ: τα `_helpers.ts` των προτύπων κειμένου και του λεξικού
 * ορθογραφίας ήταν ήδη δίδυμα (μετρημένο: **19% κοινά tokens**) και η Φάση Β
 * τα έκανε **χειρότερα** — η ίδια λογική μεταμφίεσης γραμμένη δύο φορές. Ο
 * έλεγχος `jscpd:diff` (N.18) το έπιασε στο ίδιο commit.
 *
 * Το κοινό δεν είναι «λίγος κώδικας που μοιάζει». Είναι **μία πολιτική
 * ασφαλείας**: ποιος μαθαίνει ότι υπάρχει ένα id. Γραμμένη δύο φορές, θα
 * αποκλίνει — και η απόκλιση είναι **αόρατη** (και τα δύο μονοπάτια απαντούν
 * «404», η οθόνη δείχνει κάτι λογικό). Γραμμένη μία φορά, αλλάζει μία φορά.
 *
 * Παραμετροποιείται με **τους τύπους σφάλματος** του κάθε πεδίου ορισμού, ώστε
 * να μη χάνεται το δημόσιο συμβόλαιο: κάθε πεδίο κρατά τα δικά του `code` και
 * μηνύματα, που ήδη καταναλώνουν clients.
 *
 * @module api/dxf/_domain-error-mapping
 * @see ADR-742 §3.3 (ο κανόνας) · §3.4 (η παγίδα της μη-πανομοιότυπης μεταμφίεσης)
 */

import { NextResponse } from 'next/server';
import type { AuthContext } from '@/lib/auth';
import { CrossTenantAccessError, concealCrossTenant } from '@/lib/auth/tenant-ownership';

/** Η κοινή μορφή απόκρισης σφάλματος αυτών των routes. */
export interface MappedError {
  readonly status: number;
  readonly body: {
    readonly success: false;
    readonly error: string;
    readonly code: string;
    readonly details?: readonly string[];
  };
}

/** Σφάλμα με σταθερό αναγνωριστικό — το `code` είναι δημόσιο συμβόλαιο. */
export interface CodedError extends Error {
  readonly code: string;
}

/**
 * Το **ΕΝΑ** σημείο που παράγει «δεν βρέθηκε» — γνήσιο *και* μεταμφιεσμένο.
 *
 * 🔴 Αν το γνήσιο έλεγε `Text template "tpl_x" not found.` και το μεταμφιεσμένο
 * σκέτο `Not found`, **το ίδιο το κείμενο θα γινόταν μαντείο ύπαρξης** και η
 * σιωπή δεν θα έκρυβε τίποτα. Και οι δύο κλάδοι περνούν από εδώ, με σφάλμα
 * φτιαγμένο από τον **ίδιο constructor** — ποτέ χειρόγραφο string.
 */
function notFoundOf(err: CodedError): MappedError {
  return { status: 404, body: { success: false, error: err.message, code: err.code } };
}

export interface DomainErrorSpec<N extends CodedError> {
  readonly err: unknown;
  /** Ο **καθολικός** ρόλος του καλούντος — ό,τι κρίνει την αποκάλυψη. */
  readonly ctx: Pick<AuthContext, 'globalRole'>;
  /**
   * Ο τύπος «δεν βρέθηκε» του πεδίου ορισμού. Χρησιμοποιείται **και** ως
   * φίλτρο (`instanceof`) **και** ως εργοστάσιο για τη μεταμφίεση — γι' αυτό
   * περνιέται η κλάση, όχι δύο ξεχωριστά callbacks που θα μπορούσαν να
   * αποκλίνουν.
   */
  readonly notFoundClass: new (resourceId: string) => N;
  /** Ο τύπος cross-tenant του πεδίου ορισμού (υποκλάση `CrossTenantAccessError`). */
  readonly crossTenantClass: new (...args: never[]) => CrossTenantAccessError & CodedError;
  /**
   * Ό,τι επιπλέον χαρτογραφεί το πεδίο ορισμού (validation, duplicate…).
   * Επιστρέφει `null` όταν δεν αναγνωρίζει το σφάλμα.
   */
  readonly extra?: (err: unknown) => MappedError | null;
}

/**
 * Σφάλμα υπηρεσίας → HTTP, εφαρμόζοντας τον κανόνα αποκάλυψης του ADR-742.
 *
 * Η υπηρεσία λέει **πάντα την αλήθεια**· εδώ, στο σύνορο, κρίνεται τι από αυτήν
 * φεύγει στο σύρμα. Ο bypass ρόλος έχει ήδη cross-tenant ορατότητα → ειλικρινές
 * `403` που του σώζει τη διάγνωση. Ο κανονικός χρήστης δεν μπορεί ποτέ να μάθει
 * νόμιμα ότι υπάρχει ξένο id (το `list` είναι πάντα tenant-scoped) → **σιωπή**,
 * πανομοιότυπη με ανύπαρκτο.
 *
 * ⚠️ Το `ctx` είναι **υποχρεωτικό επίτηδες**. Προαιρετικό σημαίνει «ξεχνιέται»,
 * και ένα ξεχασμένο `ctx` εδώ δεν σπάει τίποτα ορατό — απλώς ξαναγίνεται το
 * μαντείο. Ίδια συλλογιστική με το `getById(id)` χωρίς `companyId` (ADR-734 §7.1).
 */
export function mapDomainError<N extends CodedError>(spec: DomainErrorSpec<N>): MappedError {
  const { err, ctx, notFoundClass: NotFound, crossTenantClass: CrossTenant, extra } = spec;

  if (err instanceof NotFound) return notFoundOf(err);

  if (err instanceof CrossTenant) {
    return concealCrossTenant(ctx.globalRole, {
      reveal: () => ({
        status: 403,
        body: { success: false as const, error: err.message, code: err.code },
      }),
      conceal: () => notFoundOf(new NotFound(err.resourceId)),
    });
  }

  const mapped = extra?.(err);
  if (mapped) return mapped;

  const message = err instanceof Error ? err.message : 'Unknown error';
  return { status: 500, body: { success: false, error: message, code: 'INTERNAL' } };
}

/** `MappedError` → `NextResponse`. Ένα σημείο, ώστε το σχήμα να μη διχαστεί. */
export function toErrorResponse(mapped: MappedError): NextResponse {
  return NextResponse.json(mapped.body, { status: mapped.status });
}
