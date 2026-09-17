/**
 * =============================================================================
 * FILE DOWNLOAD PROXY — ΤΑ BYTES, ΜΕ ΦΡΟΥΡΟ (ADR-862 Φ0 Β8)
 * =============================================================================
 *
 * `GET /api/files/{fileId}/download` — κατεβάζει το αντικείμενο με Admin SDK,
 * παρακάμπτοντας CORS **και** τους κανόνες Storage. Ακριβώς γι' αυτό ο φρουρός
 * πρέπει να ζει **εδώ**.
 *
 * @module api/files/[fileId]/download
 * @enterprise ADR-031 — Canonical File Storage System · ADR-862 Φ0 Β8
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔒 ΟΙ ΤΡΕΙΣ ΦΡΟΥΡΟΙ — Η ΣΕΙΡΑ ΤΟΥΣ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ, ΚΑΙ ΖΕΙ ΑΛΛΟΥ
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. **ταυτότητα + ικανότητα** — `withFileCustodyAuth`: εταιρεία ⇒ `withAuth({ permissions: 'dxf:files:view' })`
 *      όπως πριν· `?custody=personal` ⇒ πολίτης ή μέλος, **μόνο** `uid` (ADR-866 §2.6.9)
 *   2. **μισθωτής** — `fileResource.load()` (ADR-742 §7undecies)
 *   3. **ορατότητα δοχείου** — ο κριτής του Β5 🆕 *(ADR-862 Φ0 Β8)*
 *
 * ⚠️ Τα (2)+(3)+η λήψη ζουν στο {@link loadOwnedFileBytes}, **όχι εδώ**: τρεις
 * διαδρομές τα χρειάζονται με **την ίδια σειρά**, και αντίγραφο που ρωτά «το
 * βλέπω;» **μετά** τη λήψη δουλεύει κανονικά — απλώς έχει ήδη διαβάσει bytes που
 * δεν δικαιούται.
 *
 * 🔴 **ΜΕΧΡΙ ΤΟ Β8 Ο ΤΡΙΤΟΣ ΕΛΕΙΠΕ, ΚΑΙ ΕΚΑΝΕ ΤΟΥΣ ΔΥΟ ΠΡΩΤΟΥΣ ΘΕΑΤΡΟ**: το
 * `cdeState` ονόμαζε τις καταστάσεις του ISO 19650 από τον Μάιο του 2026 με **0**
 * εμφανίσεις σε `firestore.rules` και **0** στο `lib/auth/**`. Ένα σχέδιο μπορούσε
 * να λέει `WIP` — *«ορατό μόνο στην ομάδα που το φτιάχνει»* — και να το κατεβάζει
 * **κάθε** μέλος του γραφείου με το id του.
 *
 * ✅ **Απόν ⇒ επιτρέπεται**: αρχείο χωρίς κατάσταση είναι `pre-cde` ⇒
 * `visible-legacy-tenant` ⇒ **καμία υπάρχουσα λήψη δεν σπάει**. Μετρημένο
 * 2026-09-16: **35 από 35** ζωντανά αρχεία είναι εκεί.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΡΟΗΓΟΥΜΕΝΟ ΚΕΝΟ ΑΥΤΗΣ ΤΗΣ ΔΙΑΔΡΟΜΗΣ (ADR-742 §7undecies)
 * ─────────────────────────────────────────────────────────────────────────────
 * **Μέχρι τις 2026-08-01 ο φρουρός μισθωτή έλειπε ΕΝΤΕΛΩΣ**: το `_ctx` ήταν
 * **αχρησιμοποίητο** ⇒ οποιοσδήποτε συνδεδεμένος χρήστης, **οποιασδήποτε**
 * εταιρείας, κατέβαζε ξένο αρχείο δίνοντας το id του. Δεν ήταν μαντείο ύπαρξης —
 * ήταν **διαρροή περιεχομένου**. Καμία σάρωση δεν μπορούσε να το δείξει: όλοι οι
 * ανιχνευτές ψάχνουν **λάθος σύγκριση**, και εδώ δεν υπήρχε σύγκριση **καθόλου**.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/error-utils';
import { fileResource } from '../../_shared/file-ownership';
import { withFileCustodyAuth, type FileCustodyCaller } from '../../_shared/file-custody-route';
import { loadOwnedFileBytes } from '../../_shared/owned-file-bytes';

// 🏢 ENTERPRISE: Extended timeout for Storage downloads
export const maxDuration = 30;

/**
 * 🔑 Η ικανότητα που ρωτά ο φρουρός ορατότητας είναι **η ίδια** που δηλώνει το
 * σύνορο παρακάτω (`withFileCustodyAuth`) — ονομασμένη **μία** φορά.
 *
 * ⚠️ Δύο literals θα ήταν ελεύθερα να αποκλίνουν, και η απόκλιση θα ήταν
 * **αόρατη**: ο κριτής θα έκρινε άλλη εξουσιοδότηση από αυτή που το σύνορο
 * απαίτησε, και το αποτέλεσμα θα φαινόταν σωστό μέχρι να αλλάξει ένας ρόλος.
 */
const DOWNLOAD_CAPABILITY = 'dxf:files:view' as const;

/**
 * Το **ένα** «δεν βρέθηκε» αυτής της διαδρομής — ADR-742 §7.1.
 *
 * Το σχήμα (`{ error }` σκέτο, χωρίς `success`) είναι **ακριβώς** αυτό που έγραφε
 * ο γνήσιος κλάδος εδώ· το `floorplans/process` γράφει άλλο και **πρέπει** να
 * γράφει άλλο. Κοινό είναι το **κείμενο**, το μόνο που ο πελάτης μπορεί να
 * συγκρίνει μεταξύ αδελφικών διαδρομών.
 *
 * ⚠️ Το καλούν **όλοι** οι κλάδοι άρνησης — απουσία, ξένος μισθωτής, δοχείο που ο
 * αιτών δεν βλέπει, διαγραμμένο, χωρίς αντικείμενο — με **μηδέν ορίσματα**: δεν
 * υπάρχει τιμή που να τους διαφοροποιεί, άρα η διαδρομή δεν γίνεται **μαντείο
 * ύπαρξης**.
 */
const fileNotFoundResponse = (): NextResponse =>
  NextResponse.json({ error: fileResource.notFoundMessage }, { status: 404 });

/**
 * Η **αυθεντία δεν απάντησε** — 503, ποτέ «δεν επιτρέπεσαι».
 *
 * 🔴 *Άγνωστο ≠ κενό* (N.12). Ένα 404 εδώ θα έλεγε «δεν συμμετέχεις σε αυτή την
 * υπόθεση» επειδή **έπεσε το δίκτυο** — και θα έστελνε τον μηχανικό να ζητήσει
 * δικαιώματα που **έχει**. Το 503 λέει την αλήθεια: *ξαναδοκίμασε*.
 */
const authorityUnavailableResponse = (): NextResponse =>
  NextResponse.json({ error: 'authority-unavailable' }, { status: 503 });

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ fileId: string }> }
): Promise<Response> {
  const handler = withFileCustodyAuth(
    async (_req: NextRequest, caller: FileCustodyCaller): Promise<NextResponse> => {
      const params = await segmentData.params;
      const fileId = params?.fileId;

      if (!fileId) {
        return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
      }

      try {
        const result = await loadOwnedFileBytes({
          fileId,
          caller,
          action: 'download',
          capability: DOWNLOAD_CAPABILITY,
        });

        if (result.outcome === 'unavailable') return authorityUnavailableResponse();
        if (result.outcome === 'refused') return fileNotFoundResponse();

        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(result.buffer));
            controller.close();
          },
        });

        return new NextResponse(body, {
          status: 200,
          headers: {
            'Content-Type': result.contentType,
            'Cache-Control': 'private, max-age=3600',
          },
        });
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
      }
    },
    { permissions: DOWNLOAD_CAPABILITY }
  );

  return handler(request);
}
