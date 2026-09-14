/**
 * @fileoverview **Το «δεν υπάρχει» ενός στατικού asset** — αληθινό `404`, **ποτέ** σε cache.
 * @related ADR-860 §Ε2 · ADR-858 §5.5
 * @module app/api/static-asset-miss/route
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΕΝΑ ΑΡΧΕΙΟ ΠΟΥ ΔΕΝ ΥΠΗΡΧΕ ΑΠΑΝΤΟΥΣΕ «200, ΚΡΑΤΑ ΤΟ ΕΝΑ ΧΡΟΝΟ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μετρημένο στην παραγωγή 2026-09-14: `GET /_next/static/chunks/doesnotexist.js` →
 * `200` + HTML + `Cache-Control: public, max-age=31536000, immutable`. Τρεις αιτίες μαζί:
 *
 *   1. Το catch-all `(app)/[...unprefixed]` ταιριάζει **κάθε** διαδρομή στο στάδιο των
 *      dynamic routes (`resolve-routes.js:187`) — άρα το δικό μας 404 του Next για
 *      `/_next/static/` (`router-server.js:461`) **δεν εκτελούνταν ποτέ**.
 *   2. Το `(app)/loading.tsx` στέλνει κέλυφος με streaming ⇒ το status **κλειδώνει σε 200**
 *      πριν αποφασιστεί το `notFound()`.
 *   3. Οι κανόνες `headers()` (πλέον αφαιρεμένοι) έβαζαν `immutable` ανεξαρτήτως status.
 *
 * Ο browser εκτελούσε HTML ως JavaScript, έριχνε `ChunkLoadError` — και **κρατούσε την
 * αποτυχία στην cache του για ένα χρόνο**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ `afterFiles` ΚΑΙ ΟΧΙ ΑΛΛΟ ΣΗΜΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `afterFiles` του `rewrites()` τρέχει **μετά** τον έλεγχο αρχείων (ό,τι υπάρχει
 * σερβίρεται κανονικά από το Next) και **πριν** τα dynamic routes (δεν φτάνει ποτέ στο
 * catch-all). Είναι το **μόνο** σημείο όπου «δεν βρέθηκε αρχείο» είναι ήδη γνωστό και
 * καμία σελίδα δεν έχει αρχίσει να αποδίδεται.
 *
 * ⛔ ΜΗΝ το κάνεις `beforeFiles`: θα έκλεβε και τα αρχεία που **υπάρχουν**.
 * ⛔ ΜΗΝ προσθέσεις `_next` στο `OUTSIDE_WORKSPACE`: κλειστό σύνολο με άγκυρες ισότητας.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΟ `Cache-Control` ΤΟΥ HANDLER ΚΕΡΔΙΖΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το routing layer γράφει τις κεφαλίδες του `headers()` **πρώτο** (`router-server.js:329`)·
 * ο handler γράφει **μετά**, και στο Node το τελευταίο `setHeader` για το ίδιο κλειδί
 * κερδίζει. Το `nosniff` εγγυάται ότι κανένας browser δεν θα προσπαθήσει να το εκτελέσει.
 *
 * 📊 **Κάθε αίτημα εδώ είναι μέτρηση skew**: μια ανοιχτή καρτέλα ζητά κώδικα έκδοσης που δεν
 * σερβίρεται πια. Το ADR-860 §Ε1 κρατά τα assets 7 ημέρες — άρα αυτή η γραμμή του log
 * σημαίνει καρτέλα **παλαιότερη** από την περίοδο χάριτος, ή σπασμένο build.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAssetRateLimit } from '@/lib/middleware/with-rate-limit';
import { createModuleLogger } from '@/lib/telemetry';

// Κάθε αίτημα είναι διαφορετικό asset — ποτέ προ-αποδιδόμενο, ποτέ cache.
export const dynamic = 'force-dynamic';

const logger = createModuleLogger('StaticAssetMiss');

/** Οροφή μήκους στο log: η διαδρομή έρχεται από το δίκτυο, όχι από εμάς. */
const MAX_LOGGED_PATH_LENGTH = 200;

/**
 * Το αρχικό μονοπάτι μεταφέρεται από το rewrite ως `?asset=:path*` — μετά από rewrite το
 * `request.url` δείχνει τον **προορισμό**, όχι αυτό που ζήτησε ο browser.
 */
function describeMiss(request: NextRequest): { readonly asset: string; readonly deploymentId: string | null } {
  const params = request.nextUrl.searchParams;
  return {
    asset: (params.get('asset') ?? '').slice(0, MAX_LOGGED_PATH_LENGTH),
    deploymentId: params.get('dpl'),
  };
}

function handler(request: NextRequest): NextResponse {
  logger.warn('Static asset miss — client requested code this server does not serve', describeMiss(request));

  return new NextResponse(null, {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/**
 * ⚠️ **`ASSET` και όχι `STANDARD`**: μια καρτέλα αμέσως μετά από deploy ζητά **πολλά**
 * chunks μαζί, και η κατηγορία είναι `failMode: 'open'` — μια βλάβη του μετρητή δεν
 * επιτρέπεται να μετατρέψει ένα `404` σε `5xx`.
 */
export const GET = withAssetRateLimit(handler);
