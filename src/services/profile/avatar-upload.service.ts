'use client';

/**
 * =============================================================================
 * 🖼️ ΦΩΤΟΓΡΑΦΙΑ ΠΡΟΦΙΛ — Η ΜΕΤΑΦΟΡΤΩΣΗ (ADR-798 §16)
 * =============================================================================
 *
 * Λεπτό στρώμα: **δεν** ξαναγράφει uploader. Ο πυρήνας «validate → `uploadBytes`
 * → `getDownloadURL`» ζει στο `services/upload/image-asset-upload.ts` (SSoT) και
 * εδώ προστίθεται μόνο ό,τι κάνει τη φωτογραφία προφίλ διαφορετική: **ποιο path**
 * και **τι σβήνεται**.
 *
 * ⛔ **ΜΗΝ φτιάξεις δεύτερο uploader.** Η υπηρεσία θυμάται ότι το κάνει, γιατί η
 * ίδια η κεφαλίδα του SSoT καταγράφει ότι το μοτίβο είχε ήδη αντιγραφεί **τρεις**
 * φορές πριν κεντρικοποιηθεί.
 *
 * @module services/profile/avatar-upload.service
 */

import {
  ImageAssetUploadError,
  deleteImageAssetByUrl,
  uploadImageAsset,
} from '@/services/upload/image-asset-upload';
import { allUserAvatarPaths, buildUserAvatarPath } from '@/services/upload/utils/storage-path-user';
import type { RenderedAvatar } from './avatar-render';

/**
 * Ανεβάζει το **παραγόμενο** καρέ και επιστρέφει το download URL.
 *
 * ⚠️ Το `File` κατασκευάζεται εδώ με όνομα `avatar.<ext>` **επίτηδες**: ο
 * `validateImageAssetFile` του SSoT κρίνει από το **όνομα**, και το μόνο όνομα
 * που επιτρέπεται να φτάσει εκεί είναι δικό μας. Το όνομα που διάλεξε ο άνθρωπος
 * **δεν ταξιδεύει ποτέ** — ούτε ως string, ούτε ως bytes.
 */
export async function uploadUserAvatar(params: {
  userId: string;
  rendered: RenderedAvatar;
}): Promise<string> {
  const { userId, rendered } = params;
  const file = new File([rendered.blob], `avatar.${rendered.ext}`, { type: rendered.blob.type });
  const url = await uploadImageAsset({
    file,
    storagePath: buildUserAvatarPath({ userId, ext: rendered.ext }),
    ext: rendered.ext,
  });

  // Η κατάληξη είναι μέρος του ονόματος: ένα παλιό `avatar.png` δεν
  // αντικαθίσταται από ένα νέο `avatar.webp`. Ο καθαρισμός τρέχει **μετά** την
  // επιτυχή γραφή — ποτέ πριν, ώστε αποτυχία να μην αφήνει τον άνθρωπο χωρίς
  // καμία φωτογραφία.
  await removeOtherAvatarObjects(userId, rendered.ext);
  return url;
}

/**
 * Δείχνει το `photoURL` σε **δική μας** ανεβασμένη εικόνα, ή στον πάροχο;
 *
 * Το χρειάζεται η οθόνη για να αποφασίσει αν προσφέρει «Αφαίρεση»: δεν έχει
 * νόημα να προσφέρεις αφαίρεση για τη φωτογραφία **του Google**, την οποία δεν
 * ανέβασε ο άνθρωπος εδώ και δεν του ανήκει να τη σβήσει από εδώ.
 *
 * ⚠️ Κρίνει το **path μέσα στο download URL** (`getDownloadURL` κωδικοποιεί το
 * path ως `users%2F{uid}%2Favatar…`), όχι τον host. Αστοχία είναι **αβλαβής**:
 * το χειρότερο που συμβαίνει είναι να μη φανεί το κουμπί «Αφαίρεση» — ποτέ να
 * σβηστεί κάτι που δεν έπρεπε.
 */
export function isOwnUploadedAvatar(photoURL: string | null | undefined, userId: string): boolean {
  if (!photoURL) return false;
  return photoURL.includes(encodeURIComponent(`users/${userId}/avatar`));
}

/** Σβήνει **κάθε** avatar object του ανθρώπου. Χρησιμοποιείται στην «Αφαίρεση». */
export async function removeUserAvatar(userId: string): Promise<void> {
  await Promise.all(allUserAvatarPaths(userId).map(deleteQuietly));
}

async function removeOtherAvatarObjects(userId: string, keep: RenderedAvatar['ext']): Promise<void> {
  const stale = allUserAvatarPaths(userId).filter((p) => !p.endsWith(`.${keep}`));
  await Promise.all(stale.map(deleteQuietly));
}

/**
 * Διαγραφή που **δεν** αποτυγχάνει σε «δεν υπάρχει».
 *
 * ⚠️ Το `object-not-found` είναι η **κανονική** περίπτωση εδώ (ο άνθρωπος μπορεί
 * να μην είχε ποτέ png), όχι εξαίρεση. Αν αυτό γινόταν σφάλμα, μια επιτυχημένη
 * μεταφόρτωση θα αναφερόταν ως αποτυχία — και ο άνθρωπος θα ξαναπροσπαθούσε για
 * κάτι που **ήδη έγινε**.
 */
async function deleteQuietly(storagePath: string): Promise<void> {
  try {
    await deleteImageAssetByUrl(storagePath);
  } catch (err) {
    if (err instanceof ImageAssetUploadError) return;
    // Firebase: `storage/object-not-found` και συγγενικά — δεν είναι αποτυχία της πράξης.
    const code = (err as { code?: string } | null)?.code ?? '';
    if (code.startsWith('storage/')) return;
    throw err;
  }
}
