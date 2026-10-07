import 'server-only';

/**
 * **Ο ΕΝΑΣ αναγνώστης της διαδρομής του αιτήματος** στον διακομιστή.
 *
 * @module server/lib/request-path
 * @see lib/http/request-path — ο συγγραφέας (middleware) και το συμβόλαιο της κεφαλίδας
 * @see ADR-848 §9 #3 · ADR-875 §14 · ADR-901 §15.16
 *
 * Ένα layout του App Router δεν βλέπει τη διαδρομή· τη φέρνει το middleware ως κεφαλίδα. Εδώ διαβάζεται **μία**
 * φορά — ποτέ ωμό `headers().get(...)` σε σελίδα ή layout.
 *
 * ⚠️ `null` = το αίτημα δεν πέρασε από το middleware. Ο καλών οφείλει να έχει **ασφαλή** απάντηση για την απουσία
 * (σκέτο `/login` · το ίδιο 404) — η τιμή προσφέρει ευκολία, ποτέ δικαίωμα.
 */

import { headers } from 'next/headers';

import { REQUEST_PATH_HEADER } from '@/lib/http/request-path';

export async function readRequestPath(): Promise<string | null> {
  return (await headers()).get(REQUEST_PATH_HEADER);
}
