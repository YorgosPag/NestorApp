import 'server-only';

/**
 * **«Σύνδεση, και μετά πίσω εδώ»** — ο ΕΝΑΣ τρόπος για φρουρό του διακομιστή
 *
 * @module server/auth/login-return
 * @see ADR-848 §9 #3 · ADR-875 §14 (Φ2.2)
 *
 * Ένας Server Component που στέλνει τον ανώνυμο στη σύνδεση **δεν** γράφει
 * `AUTH_ROUTES.login`: ζητά από εδώ τη σύνδεση **με επιστροφή στη διαδρομή του
 * αιτήματος**. Η διαδρομή έρχεται από το middleware (`lib/http/request-path.ts`),
 * επειδή ένα layout δεν τη βλέπει.
 *
 * 🔑 Ο κριτής της τιμής **δεν** είναι εδώ — είναι το `loginHref` → `safeReturnPath`
 * (ADR-848 §4). Απούσα κεφαλίδα (π.χ. αίτημα που δεν πέρασε από middleware) ⇒
 * σκέτο `/login`, ποτέ σφάλμα.
 *
 * 🔒 Τον μετρά ζωντανά ο **δίδυμος** του χρησμού (CHECK 3.51 Χ, `guard-contract.js`):
 * ανώνυμο `/o/**` → `/login` **χωρίς** σωστό `?next=` ⇒ 🔴 `guard-return-lost`.
 */

import { headers } from 'next/headers';

import { REQUEST_PATH_HEADER } from '@/lib/http/request-path';
import { loginHref } from '@/lib/routes/return-path';
import type { WorkspaceHref } from '@/lib/workspace/route-worlds';

export async function loginHrefForRequest(): Promise<WorkspaceHref> {
  return loginHref((await headers()).get(REQUEST_PATH_HEADER));
}
