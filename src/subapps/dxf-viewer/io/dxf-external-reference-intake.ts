/**
 * ADR-736 Φ3 — **ΕΙΣΟΔΟΣ**: ό,τι έδωσε ο χρήστης → επίπεδη λίστα υποψήφιων αρχείων.
 *
 * Ο χρήστης δίνει τα υπόβαθρα με **τρεις** τρόπους, και οι τρεις καταλήγουν εδώ:
 *   · μεμονωμένα αρχεία δίπλα στο `.dxf` (`multiple`),
 *   · ολόκληρο φάκελο (`webkitdirectory`),
 *   · ένα `.zip` — το πακέτο *eTransmit* που στέλνει ο τοπογράφος.
 *
 * Ένα σημείο μετάφρασης, ώστε ο resolver να βλέπει πάντα το **ίδιο** πράγμα: `File[]`. Και οι
 * τρεις δρόμοι είναι ισοδύναμοι· κανένας δεν έχει «λιγότερες» δυνατότητες από τους άλλους.
 *
 * ## Τι κάνει και τι ΔΕΝ κάνει
 *
 * · Ανοίγει τα `.zip` (αναδρομικά **όχι** — zip μέσα σε zip δεν είναι πραγματικό σενάριο και θα
 *   ήταν άπειρος βρόχος χωρίς όριο).
 * · Πετά ό,τι δεν είναι εικόνα που ξέρουμε να αποθηκεύσουμε — **δεν** είναι κρίση για το αν θα
 *   ταιριάξει, είναι κρίση για το αν μπορεί να ανέβει. Ένα `.dxf` μέσα στο zip δεν είναι
 *   υποψήφιο υπόβαθρο· να ταξίδευε ως τέτοιο θα ήταν απλώς θόρυβος στη σκάλα ταύτισης.
 * · **Δεν αποτυγχάνει ποτέ συνολικά.** Ένα χαλασμένο/κρυπτογραφημένο zip καταγράφεται και
 *   αγνοείται· τα υπόλοιπα αρχεία περνούν. Η εισαγωγή σχεδίου δεν είναι σωστό να πέφτει επειδή
 *   ένα από τα πέντε συνοδευτικά ήταν προβληματικό.
 *
 * @see ../export/core/zip-unpack — ο αναγνώστης zip (μηδέν εξάρτηση)
 * @see ./dxf-external-reference-match — ο καταναλωτής (η σκάλα ταύτισης)
 */

import { unpackZipBlob, ZipUnpackError } from '../export/core/zip-unpack';
import {
  imageAssetExtFromName,
  imageAssetContentType,
} from '@/services/upload/image-asset-upload';
import { dwarn } from '../debug';

/** Ό,τι δεν μπορεί να αποθηκευτεί ως εικόνα-asset δεν είναι υποψήφιο υπόβαθρο. */
const isCandidateName = (name: string): boolean => imageAssetExtFromName(name) !== null;

const isZipName = (name: string): boolean => name.toLowerCase().endsWith('.zip');

/**
 * Μετατρέπει μια εγγραφή zip σε `File` **με σωστό MIME**.
 *
 * Το `type` δεν είναι διακοσμητικό: το `createImageBitmap` (πέρασμα διαστάσεων) και το
 * `uploadBytes` το χρειάζονται. Ένα `File` με κενό `type` θα αποτύγχανε να αποκωδικοποιηθεί και
 * θα έμενε σιωπηλά έξω από την ταύτιση διαστάσεων — δηλαδή τα zip θα «δούλευαν» χειρότερα από
 * τους φακέλους, χωρίς ορατή αιτία.
 */
function zipEntryToFile(name: string, data: Uint8Array): File | null {
  const ext = imageAssetExtFromName(name);
  if (!ext) return null;
  // Μόνο το τελευταίο τμήμα: μέσα στο zip το όνομα φέρει διαδρομή (`ΦΩΤΟ/1.jpg`), αλλά η
  // ταύτιση γίνεται πάντα σε basename — και το ίδιο περιμένει και ο uploader.
  const leaf = name.split('/').pop() ?? name;
  return new File([data as BlobPart], leaf, { type: imageAssetContentType(ext) });
}

/**
 * Επίπεδη λίστα υποψήφιων αρχείων από ό,τι έδωσε ο χρήστης.
 *
 * Η σειρά διατηρείται (αρχεία με τη σειρά επιλογής, περιεχόμενα zip στη θέση του zip): σε
 * ισοπαλία basename το ευρετήριο κρατά **το τελευταίο**, οπότε η σειρά είναι παρατηρήσιμη
 * συμπεριφορά και δεν πρέπει να αλλάζει αυθαίρετα.
 */
export async function collectExternalReferenceCandidates(
  offered: readonly File[],
): Promise<File[]> {
  const candidates: File[] = [];
  for (const item of offered) {
    if (isZipName(item.name)) {
      candidates.push(...(await expandZip(item)));
    } else if (isCandidateName(item.name)) {
      candidates.push(item);
    }
  }
  return candidates;
}

/** Τα αρχεία-εικόνες ενός zip· κάθε αποτυχία καταγράφεται και **δεν** διακόπτει τα υπόλοιπα. */
async function expandZip(archive: File): Promise<File[]> {
  try {
    const entries = await unpackZipBlob(archive);
    return entries
      .map((entry) => zipEntryToFile(entry.name, entry.data))
      .filter((file): file is File => file !== null);
  } catch (error) {
    dwarn(
      'ExternalReferences',
      `⚠️ Το «${archive.name}» δεν διαβάστηκε`,
      error instanceof ZipUnpackError ? error.code : error,
    );
    return [];
  }
}
