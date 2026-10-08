/**
 * =============================================================================
 * ΑΠΟ ΠΟΥ ΦΕΡΝΕΙ Ο PDF VIEWER ΤΑ BYTES; — ο ΕΝΑΣ απαντητής (ADR-901 §14.9)
 * =============================================================================
 *
 * **Το ερώτημα**: *«Με αυτά τα δεδομένα (`fileId` · `url` · δήλωση παράδοσης), ποιο
 * αίτημα κάνει ο φυλλομετρητής — και με ποια διαπιστευτήρια;»*
 *
 * 🔴 **ΤΙ ΜΕΤΡΗΘΗΚΕ (παραγωγή, 2026-10-08)**: η απόφαση ζούσε inline στον viewer ως
 * `url.startsWith('/') ? url : proxy`. Δηλαδή **κάθε** απόλυτο URL θεωρούνταν μόνιμο
 * Firebase token URL που θέλει τον proxy `/api/download?url=` — και ο **βραχύβιος
 * υπογεγραμμένος σύνδεσμος** του τεκμηρίου υπόθεσης (ADR-901 Φ4) τυλιγόταν κι αυτός:
 *
 *   1. ο proxy είναι `withAuth` ⇒ ο επαγγελματίας χωρίς εταιρεία έπαιρνε **401**
 *      (`missing_claims`) — «PDF fetch: HTTP 401», σε **κάθε** PDF·
 *   2. ο σύνδεσμος ταξίδευε ως **παράμετρος query** στον δικό μας διακομιστή, ενώ το
 *      `lib/storage/signed-download-url` τον ονομάζει **μυστικό** που δεν καταγράφεται.
 *
 * Ο ίδιος σύνδεσμος, ζητημένος **απευθείας** από τον φυλλομετρητή, απάντησε 200.
 *
 * 🔑 **Ο ΚΑΛΩΝ ΔΗΛΩΝΕΙ, Ο VIEWER ΔΕΝ ΜΑΝΤΕΥΕΙ.** Ένα υπογεγραμμένο URL και ένα μόνιμο
 * token URL ζουν στο **ίδιο** hostname· κριτήριο πάνω στη μορφή του URL θα ήταν
 * μαντεψιά που σπάει στην επόμενη αλλαγή υπογραφής (V2 → V4). Όποιος **εξέδωσε** τον
 * σύνδεσμο ξέρει τι είναι — και το λέει με {@link PreviewUrlDelivery}.
 *
 * ⚠️ `'direct'` σημαίνει: *«ο διακομιστής **έκρινε ήδη** και υπέγραψε· το URL **είναι** η
 * άδεια»* (το πρότυπο του Autodesk Construction Cloud: `item_id` → κρίση → βραχύβιο
 * υπογεγραμμένο URL, τα bytes **δεν** περνούν από το API). ⛔ **ΜΗΝ** το δηλώσεις για
 * μόνιμο `downloadUrl` του Firebase: εκείνο παρακάμπτει τους κανόνες και ο proxy είναι
 * ο φρουρός του (ADR-862 Φ0 Β8).
 *
 * @module components/file-manager/pdf-fetch-target
 * @see lib/storage/signed-download-url — ο γεννήτορας της άδειας
 * @see app/api/download/route — ο proxy των δύο άλλων εισόδων
 */

import { API_ROUTES } from '@/config/domain-constants';

/**
 * Πώς **παραδίδεται** το `url` μιας προεπισκόπησης.
 *
 * - `'proxied'` (προεπιλογή) — το απόλυτο URL περνά από τον φρουρούμενο proxy.
 * - `'direct'` — το URL είναι βραχύβια υπογεγραμμένη άδεια· ζητείται όπως είναι.
 */
export type PreviewUrlDelivery = 'proxied' | 'direct';

export interface PdfFetchSource {
  readonly url: string;
  readonly fileId?: string;
  readonly urlDelivery?: PreviewUrlDelivery;
}

/** Το αίτημα που θα γίνει — **και** τα διαπιστευτήριά του, ποτέ το ένα χωρίς το άλλο. */
export interface PdfFetchTarget {
  readonly url: string;
  /**
   * `'omit'` στην απευθείας παράδοση: η άδεια είναι **μέσα** στο URL, και ένα cookie
   * προς τρίτο host δεν έχει κανέναν λόγο να ταξιδέψει. `'same-origin'` αλλού — ο
   * proxy ταυτοποιεί με το cookie συνεδρίας.
   */
  readonly credentials: 'omit' | 'same-origin';
}

/**
 * **Η σειρά είναι συμβόλαιο**:
 *
 * 1. `'direct'` — ο εκδότης δήλωσε ότι το URL είναι η άδεια ⇒ όπως είναι, χωρίς cookie.
 * 2. `fileId` — η μόνη είσοδος που ο διακομιστής επαληθεύει **πλήρως** (μισθωτή **και**
 *    δοχείο, ADR-862 Φ0 Β8).
 * 3. Σχετικό URL — ήδη δική μας διαδρομή (π.χ. `/api/shared/[token]/pdf`).
 * 4. Απόλυτο URL — κληρονομιά, μέσα από τον φρουρούμενο proxy `?url=`.
 */
export function pdfFetchTarget({ url, fileId, urlDelivery }: PdfFetchSource): PdfFetchTarget {
  if (urlDelivery === 'direct') {
    return { url, credentials: 'omit' };
  }
  if (fileId) {
    return { url: `${API_ROUTES.DOWNLOAD}?fileId=${encodeURIComponent(fileId)}`, credentials: 'same-origin' };
  }
  if (url.startsWith('/')) {
    return { url, credentials: 'same-origin' };
  }
  return {
    url: `${API_ROUTES.DOWNLOAD}?url=${encodeURIComponent(url)}&filename=preview.pdf`,
    credentials: 'same-origin',
  };
}
