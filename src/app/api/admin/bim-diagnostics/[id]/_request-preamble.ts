/**
 * 🏛️ **ΤΟ ΕΝΑ ΠΡΟΟΙΜΙΟ ΤΩΝ ΑΙΤΗΜΑΤΩΝ ΔΙΑΓΝΩΣΤΙΚΟΥ** (N.0.2 · CHECK 3.28).
 *
 * Και οι δύο γραφείς ενός `performance_diagnostics` — το `PATCH …/[id]` και το
 * `PUT …/[id]/notes` — ξεκινούσαν με **το ίδιο σώμα γραμμένο δύο φορές**: λύσε τα
 * `params`, βρες το `id`, διάβασε JSON. Ο κλώνος ήταν **κληρονομημένος**· τον
 * ονόμασε το `jscpd --diff` όταν η μετακίνηση του ταβανιού στη δήλωση
 * (ADR-801 §2.10) έκανε τα δύο αρχεία ακόμα πιο όμοια, αφαιρώντας τις
 * διαφορετικές τους διατυπώσεις σφάλματος.
 *
 * 🔑 **Ο ΕΠΙΚΥΡΩΤΗΣ ΠΕΡΝΙΕΤΑΙ, ΔΕΝ ΖΕΙ ΕΔΩ** — και η διάκριση είναι ολόκληρο το
 * σχέδιο. Οι δύο διαδρομές επικυρώνουν **διαφορετικό σχήμα** (μετάβαση κατάστασης
 * έναντι ενός πεδίου σημειώσεων)· κοινός *επικυρωτής* θα ήταν **δεύτερη αυθεντία**
 * για δύο ερωτήματα που απλώς μοιάζουν (ADR-749). Κοινό είναι το **πρωτόκολλο**:
 * *λύσε τη διαδρομή → διάβασε JSON → επικύρωσε → απόρριψε με 400*.
 *
 * ⚠️ **ΓΙ' ΑΥΤΟ ΚΑΤΑΠΙΝΕΙ ΚΑΙ ΤΗΝ ΕΠΙΚΥΡΩΣΗ**: με τον επικυρωτή απ' έξω, κάθε
 * καλών ξανάγραφε το `if (!validation.ok) return … 400`, δηλαδή **τρεις**
 * ευκαιρίες να ξεχαστεί ο κωδικός. Τώρα ο τύπος **δεν επιτρέπει** στον καλούντα
 * να δει σώμα που δεν πέρασε.
 *
 * ⚠️ **ΔΙΑΚΡΙΤΗ ΕΤΥΜΗΓΟΡΙΑ, ΠΟΤΕ `null`**: επιστρέφει `ok` ή **την ίδια την
 * απόκριση σφάλματος**, ώστε η απόρριψη να μην μπορεί να χαθεί σιωπηλά.
 */

import 'server-only';

import { NextResponse } from 'next/server';

/** Η ετυμηγορία ενός επικυρωτή σώματος — το σχήμα που ήδη μιλούν και οι δύο διαδρομές. */
export type BodyVerdict<T> =
  | { readonly ok: true; readonly body: T }
  | { readonly ok: false; readonly reason: string };

/** Το αποτέλεσμα του προοιμίου: είτε τα επικυρωμένα δεδομένα, είτε η έτοιμη απόρριψη. */
export type DiagnosticPreamble<T> =
  | { readonly ok: true; readonly diagId: string; readonly body: T }
  | { readonly ok: false; readonly response: NextResponse };

/** Λύνει το `id` της διαδρομής, διαβάζει το σώμα JSON και το επικυρώνει. */
export async function readDiagnosticRequest<T>(
  request: Request,
  routeContext: { params: Promise<{ id: string }> } | undefined,
  validateBody: (raw: unknown) => BodyVerdict<T>,
): Promise<DiagnosticPreamble<T>> {
  const params = await routeContext?.params;
  const diagId = params?.id;
  if (!diagId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Missing diagnostic id' }, { status: 400 }),
    };
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }

  const validation = validateBody(raw);
  if (!validation.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: validation.reason }, { status: 400 }),
    };
  }

  return { ok: true, diagId, body: validation.body };
}
