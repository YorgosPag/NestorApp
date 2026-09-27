import 'server-only';

/**
 * @fileoverview **Η ΣΥΝΕΧΕΙΑ ΤΗΣ ΣΥΝΕΔΡΙΑΣ ΜΕΤΑ ΤΗΝ ΑΠΟΧΩΡΗΣΗ** — ADR-892 Φ3 (§13).
 * @related server/workspace/member-exit-claims (η ανάκληση) · auth/issued-session (ο πελάτης που την υιοθετεί)
 * @module server/workspace/member-exit-session
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΡΟΒΛΗΜΑ
 * ─────────────────────────────────────────────────────────────────────────────
 * Όταν ο άνθρωπος αποχωρεί από τον **οικείο** του χώρο, το `releaseHomeWorkspace` ανακαλεί **όλες** τις
 * συνεδρίες του — υποχρεωτικά: ο κριτής δίνει `home` από το token με **0** αναγνώσεις, άρα κάθε ανοιχτή
 * συνεδρία θα άνοιγε το γραφείο για ακόμη 24 ώρες (§8.1). Χωρίς κάτι επιπλέον θα αποσυνδεόταν όμως
 * **και η συσκευή όπου μόλις πάτησε το κουμπί**. Κανένας από GitHub/Notion/Figma δεν αποσυνδέει όποιον
 * φεύγει — εκεί όμως η θέση κρίνεται σε κάθε αίτημα, και το πρόβλημα δεν υπάρχει.
 *
 * 🔑 **Η λύση — καλύτερα και από τους δύο κόσμους**: οι **άλλες** συσκευές κόβονται (ασφάλεια), και
 * **αυτή** παίρνει ένα κλειδί (custom token) για **νέα** συνεδρία με τα **νέα** claims. Το `auth_time` της
 * είναι μεταγενέστερο της ανάκλησης ⇒ περνά τη σφραγίδα (`revocation-watermark`). Ο άνθρωπος συνεχίζει
 * στον προσωπικό του χώρο (ή στο επόμενο γραφείο του) χωρίς νέα σύνδεση.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ ΠΟΤΕ ΑΠΟ ΣΚΕΤΟ COOKIE
 * ─────────────────────────────────────────────────────────────────────────────
 * Το κλειδί δίνει συνεδρία **χωρίς** τη λήξη της παλιάς. Ένα κλεμμένο cookie (24 ώρες) που καλούσε την
 * αποχώρηση θα «ξεπλενόταν» σε φρέσκια συνεδρία. Γι' αυτό απαιτείται αίτημα πιστοποιημένο με **Bearer
 * ID token** — αυτό που στέλνει ο δικός μας πελάτης, και που βγαίνει **μόνο** από κάτοχο του refresh token.
 * Το σύνορο (`buildApiIdentity`) επαληθεύει **μόνο** το Bearer όταν υπάρχει — δεν πέφτει σε cookie — άρα
 * «υπάρχει Bearer» στον handler σημαίνει «πιστοποιήθηκε με Bearer».
 */

import type { NextRequest } from 'next/server';

import { getAdminAuth } from '@/lib/firebaseAdmin';
import { extractBearerToken } from '@/lib/auth/token-credentials';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

import type { HomeAfterExit } from './member-exit-claims';

const logger = createModuleLogger('member-exit-session');

/**
 * Τι μαθαίνει ο πελάτης για τη δική του συνεδρία — κλειστό σύνολο.
 * - `unchanged` — ο οικείος χώρος δεν άλλαξε, καμία ανάκληση: η συνεδρία του συνεχίζει ως έχει.
 * - `reissued`  — ανακλήθηκαν όλες· αυτό είναι το κλειδί της νέας συνεδρίας **αυτής** της συσκευής.
 * - `ended`     — ανακλήθηκαν όλες και **δεν** δίνεται κλειδί (όχι Bearer, ή αποτυχία έκδοσης):
 *                 ο πελάτης το λέει με λόγια και στέλνει στη σύνδεση — η αποχώρηση **έγινε**.
 */
export type SessionContinuation =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'reissued'; readonly token: string }
  | { readonly kind: 'ended' };

/**
 * Μετά την αποχώρηση: χρειάζεται νέα συνεδρία, και δικαιούται αυτό το αίτημα να την πάρει;
 * ⚠️ **Δεν πετά ποτέ**: η αποχώρηση έχει ήδη γίνει· η συνέχεια είναι άνεση, όχι μέρος της πράξης.
 */
export async function continueSessionAfterExit(
  request: NextRequest,
  uid: string,
  home: HomeAfterExit,
): Promise<SessionContinuation> {
  if (home.kind === 'untouched') return { kind: 'unchanged' };
  if (extractBearerToken(request) === null) return { kind: 'ended' };
  try {
    return { kind: 'reissued', token: await getAdminAuth().createCustomToken(uid) };
  } catch (error: unknown) {
    logger.error('Το κλειδί συνέχειας δεν εκδόθηκε — η αποχώρηση ΕΓΙΝΕ', { uid, error: getErrorMessage(error) });
    return { kind: 'ended' };
  }
}
