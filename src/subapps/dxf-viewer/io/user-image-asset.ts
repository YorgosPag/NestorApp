'use client';

/**
 * ADR-736 §6 — **ανέβασμα μιας εικόνας που έδωσε ρητά ο χρήστης** (εισαγωγή ή αντικατάσταση).
 *
 * 🔑 **Δεν υλοποιεί τίποτα.** Είναι thin adapter πάνω στο ήδη υπάρχον συμβόλαιο του resolver
 * εξωτερικών αναφορών ({@link buildDxfExternalReferenceDeps}), που κάνει **ακριβώς** αυτή τη
 * δουλειά και την κάνει σωστά: επικύρωση μορφής/μεγέθους, ταυτότητα περιεχομένου SHA-256,
 * ντετερμινιστικό company-scoped Storage path, **idempotent** ανέβασμα (ίδια bytes ⇒ ίδιο
 * αντικείμενο, μηδέν δεύτερο αντίγραφο) και εγγενές μέγεθος σε pixels.
 *
 * Γι' αυτό εδώ δεν υπάρχει ούτε `uploadBytes`, ούτε path builder, ούτε αυτοσχέδια γεννήτρια
 * τυχαίων id (N.6): θα ήταν το τέταρτο αντίγραφο μιας αλυσίδας που ήδη ζει σε ΕΝΑ σημείο. Το μόνο που
 * προσθέτει αυτό το module είναι **η σειρά των τριών κλήσεων** — και το γεγονός ότι δύο
 * καλούντες (η εντολή εισαγωγής και η αντικατάσταση από το πάνελ Ιδιοτήτων) τη μοιράζονται
 * αντί να τη γράψει ο καθένας του (N.18).
 *
 * ## Γιατί το ΙΔΙΟ Storage path με τις εξωτερικές αναφορές
 *
 * Είναι το ίδιο είδος πράγματος: raster asset που ανήκει σε σχέδιο μιας εταιρείας. Ίδιοι
 * κανόνες `storage.rules`, ίδιο όριο 25 MB, ίδιο dedup περιεχομένου — μια σάρωση που
 * χρησιμοποιείται και ως xref και ως ελεύθερη εικόνα ανεβαίνει **μία** φορά. Δεύτερο δέντρο
 * αποθήκευσης θα ήθελε δεύτερους κανόνες ασφαλείας για μηδενικό όφελος.
 *
 * ⚠️ Το «ανέβασμα» **δεν** δημιουργεί `DxfExternalReference` και δεν αγγίζει τη σκηνή. Αυτό
 * είναι δουλειά του καλούντος: η αναφορά είναι δήλωση του **αρχείου DXF**, όχι κάθε εικόνας
 * που τοποθετεί ο χρήστης (βλ. `types/image.ts` — το `externalRefId` υπάρχει **μόνο σε
 * εισαγόμενες**).
 *
 * @see ./dxf-external-reference-deps.ts — το SSoT που καλωδιώνει επικύρωση/hash/ανέβασμα
 * @see ../bim/image/image-source-attach.ts — τι γίνεται με το αποτέλεσμα (pure geometry)
 */

import { buildDxfExternalReferenceDeps } from './dxf-external-reference-deps';
import type { ForeignAssetPixelSize } from './shared/foreign-asset-pixel-size';

/** Ό,τι χρειάζεται ο καλών για να φτιάξει ή να ενημερώσει μια `ImageEntity`. */
export interface UploadedUserImage {
  /** Download URL του asset (Firebase Storage). */
  readonly url: string;
  /** Εγγενές μέγεθος σε pixels· `null` όταν το raster δεν αποκωδικοποιήθηκε. */
  readonly pixelSize: ForeignAssetPixelSize | null;
  /** Το όνομα του αρχείου όπως το διάλεξε ο χρήστης — γίνεται η ετικέτα της εικόνας. */
  readonly fileName: string;
}

/**
 * Ανεβάζει το αρχείο και επιστρέφει ό,τι χρειάζεται η σκηνή.
 *
 * **Πετά** `ImageAssetUploadError` (code `'format'` / `'size'`) όταν η μορφή ή το μέγεθος δεν
 * γίνονται δεκτά — ο καλών το μεταφράζει σε μήνυμα προς τον χρήστη. Σκόπιμα **δεν** το
 * καταπίνει εδώ: σε μια ενέργεια που ξεκίνησε ρητά ο χρήστης, η σιωπηλή αποτυχία είναι η
 * χειρότερη έκβαση — το κουμπί θα έμοιαζε νεκρό.
 *
 * Το εγγενές μέγεθος, αντίθετα, **δεν** είναι λόγος αποτυχίας: `null` σημαίνει «δεν ξέρω τον
 * λόγο πλευρών», και η εικόνα μπαίνει ούτως ή άλλως (βλ. `imagePlacementSize`).
 */
export async function uploadUserImageAsset(
  file: File,
  companyId: string,
): Promise<UploadedUserImage> {
  const deps = buildDxfExternalReferenceDeps(companyId);
  const contentHash = await deps.hashFile(file);
  // Σειριακά και όχι `Promise.all`: αν το ανέβασμα απορριφθεί (μορφή/μέγεθος), δεν έχει νόημα
  // να έχει ήδη ξοδευτεί αποκωδικοποίηση ενός raster δεκάδων megapixel.
  const url = await deps.uploadByContent(file, contentHash);
  const pixelSize = await deps.pixelSizeOf(file);
  return { url, pixelSize, fileName: file.name };
}
