/**
 * 🏛️ **ΤΟ ΕΝΑ ΠΡΟΟΙΜΙΟ ΤΩΝ ΑΙΤΗΜΑΤΩΝ ΤΗΛΕΜΕΤΡΙΑΣ BIM** (N.0.2 · CHECK 3.28 · ADR-366 §C.7.Q3).
 *
 * Η εισαγωγή (`POST …/bim-performance`) και η διαγραφή GDPR (`POST …/bim-performance/erase`) ξεκινούσαν με
 * **το ίδιο σώμα γραμμένο δύο φορές**: έλεγξε το `x-bim-session-id` → διάβασε JSON → 400. Μαζί του
 * διπλασιάζονταν η κεφαλίδα, το σχήμα της ταυτότητας συνεδρίας και το κλειδί του rate limiter. Ο κλώνος
 * ήταν κληρονομημένος· τον ονόμασε το `jscpd --diff` όταν το ADR-225 Phase 2 άγγιξε και τα δύο αρχεία.
 *
 * 🔑 **Η ΕΠΙΚΥΡΩΣΗ ΤΟΥ ΣΩΜΑΤΟΣ ΜΕΝΕΙ ΣΤΗ ΔΙΑΔΡΟΜΗ**: η εισαγωγή κρίνει δείγματα, η διαγραφή μόνο ότι το
 * σώμα επαναλαμβάνει τη συνεδρία της κεφαλίδας — δύο διαφορετικά ερωτήματα (ADR-749). Κοινό είναι
 * μόνο το **πρωτόκολλο**, όπως στο `admin/bim-diagnostics/[id]/_request-preamble.ts`.
 *
 * ⚠️ **ΔΙΑΚΡΙΤΗ ΕΤΥΜΗΓΟΡΙΑ, ΠΟΤΕ `null`**: `ok` ή η ίδια η απόκριση σφάλματος.
 */

import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';

/** Η κεφαλίδα που κουβαλά την ανώνυμη συνεδρία — `SHA-256(daily_salt + userId)` σε hex. */
export const SESSION_HEADER = 'x-bim-session-id';
const SESSION_ID_REGEX = /^[a-f0-9]{64}$/;

/** Η ταυτότητα συνεδρίας της κεφαλίδας, ή `null` όταν λείπει ή δεν έχει το σχήμα της. */
export function sessionIdOf(request: Request): string | null {
  const sid = request.headers.get(SESSION_HEADER);
  return sid && SESSION_ID_REGEX.test(sid) ? sid : null;
}

/** Κλειδί του rate limiter ανά συνεδρία (όχι ανά IP: η ανώνυμη κίνηση θα μοιραζόταν έναν κουβά). */
export function sessionRateLimitKey(prefix: string): (request: NextRequest) => string | null {
  return (request) => {
    const sid = sessionIdOf(request);
    return sid ? `${prefix}:${sid}` : null;
  };
}

/** Το αποτέλεσμα του προοιμίου: η συνεδρία και το ακατέργαστο σώμα, ή η έτοιμη απόρριψη. */
export type SessionPreamble =
  | { readonly ok: true; readonly sessionId: string; readonly raw: unknown }
  | { readonly ok: false; readonly response: NextResponse<{ error: string }> };

/** Επαληθεύει την κεφαλίδα συνεδρίας και διαβάζει το σώμα JSON. */
export async function readSessionRequest(request: NextRequest): Promise<SessionPreamble> {
  const sessionId = sessionIdOf(request);
  if (!sessionId) {
    return { ok: false, response: NextResponse.json({ error: 'Missing or malformed session id' }, { status: 400 }) };
  }
  try {
    return { ok: true, sessionId, raw: await request.json() };
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) };
  }
}
