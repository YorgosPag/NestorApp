/**
 * SSoT — **ταυτότητα ΔΙΑΣΤΑΣΕΩΝ ενός ξένου asset**: το εγγενές μέγεθος του raster σε pixels.
 *
 * Τρίτο μέλος της οικογένειας `io/shared/`, που απαντά τα τρία ερωτήματα ταύτισης ενός αρχείου
 * που **δηλώνεται** από ξένο format και πρέπει να **ξαναβρεθεί** ανάμεσα σε αυτά που έδωσε ο
 * χρήστης:
 *   · `foreign-asset-basename`     → «ίδιο **ΟΝΟΜΑ**;»
 *   · `foreign-asset-content-hash` → «ίδια **BYTES**;»
 *   · αυτό εδώ                     → «ίδιες **ΔΙΑΣΤΑΣΕΙΣ**;»
 *
 * 🔑 **Γιατί χρειάζεται το τρίτο** (μετρημένο, ADR-736): στο πραγματικό τοπογραφικό τα 9 από τα
 * 10 υπόβαθρα **υπάρχουν** δίπλα στο `.dxf` — αλλά με **εντελώς άλλα ονόματα** (`dianomi_1.JPG`
 * ↔ «2026-07-20 - Διανομή Ευόσμου 1967-68-81 - φύλλο 1.JPG»), γιατί ο τοπογράφος τα μετονόμασε
 * κατά την παράδοση. Ούτε το όνομα ούτε το hash μπορούν να τα ταυτίσουν: **μόνο** οι διαστάσεις,
 * που το DXF τις κρατά ήδη στο `IMAGEDEF` group 10/20 (`imageSizePx`). Χωρίς αυτό το πέρασμα, η
 * αυτόματη επίλυση θα έβρισκε **μηδέν από τα 10**.
 *
 * **Μηδέν dependency (N.5):** `createImageBitmap` — native, ίδιο μοτίβο με το
 * `texture-average-color.ts`. Το bitmap **κλείνει πάντα**: δεκάδες αποκωδικοποιημένα υπόβαθρα
 * είναι εκατοντάδες MB αν μείνουν ζωντανά.
 *
 * @see ./foreign-asset-basename.ts — ταυτότητα ΟΝΟΜΑΤΟΣ
 * @see ./foreign-asset-content-hash.ts — ταυτότητα ΠΕΡΙΕΧΟΜΕΝΟΥ
 */

/** Διαστάσεις σε pixels — ίδιο σχήμα με το `DxfReferenceVec2` του μοντέλου αναφορών. */
export interface ForeignAssetPixelSize {
  readonly x: number;
  readonly y: number;
}

/**
 * Το εγγενές μέγεθος σε pixels ενός `Blob`/`File` εικόνας, ή `null` όταν δεν αποκωδικοποιείται.
 *
 * `null` σημαίνει **«δεν ξέρω»**, ποτέ «μηδέν»: μη-εικόνα, μορφή που ο browser δεν διαβάζει
 * (π.χ. TIFF), ή περιβάλλον χωρίς `createImageBitmap` (Node/test). Ο καλών οφείλει να το
 * μεταφράζει σε «αυτό το αρχείο δεν συμμετέχει στην ταύτιση διαστάσεων» — όχι σε αποτυχία.
 */
export async function foreignAssetPixelSize(blob: Blob): Promise<ForeignAssetPixelSize | null> {
  if (typeof createImageBitmap !== 'function') return null;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(blob);
    return bitmap.width > 0 && bitmap.height > 0 ? { x: bitmap.width, y: bitmap.height } : null;
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}
