/**
 * SSoT — **πώς μια `DxfExternalReference` προβάλλεται πάνω στις οντότητες της σκηνής** (ADR-736).
 *
 * Η αναφορά και η οντότητα είναι **δύο πράγματα**: η αναφορά ξέρει *τι δήλωσε το αρχείο*
 * (διαδρομή, όνομα, κατάσταση), η `ImageEntity` ξέρει *πού και πόσο μεγάλο ζωγραφίζεται*. Η
 * γέφυρα είναι το `externalRefId` (= το DXF handle του `IMAGEDEF`, group **340**). Αυτό το
 * αρχείο είναι η **μοναδική** υλοποίηση αυτής της γέφυρας.
 *
 * 🔑 **Γιατί μία και όχι δύο:** η προβολή συμβαίνει σε **δύο εντελώς διαφορετικές στιγμές** —
 *   1. στο **χτίσιμο** της σκηνής (`DxfSceneBuilder`, τρέχει και στις **δύο** πόρτες εισαγωγής,
 *      client **και** server wizard): κάθε αναφορά είναι ακόμη `missing`, οπότε το μόνο που
 *      περνά είναι το **όνομα** — αρκετό για να δείξει ο renderer *τι* λείπει·
 *   2. στην **επίλυση** (client, `io/dxf-external-reference-resolver.ts`): τώρα υπάρχει `url`,
 *      και οι ίδιες οντότητες γεμίζουν.
 * Δύο υλοποιήσεις θα αποκλίνανε αθόρυβα (ακριβώς το σχήμα του ADR-635 Φ C.18, όπου δυνατότητα
 * υλοποιημένη στη μία μόνο πόρτα κόστισε 117 γραμμοσκιάσεις). Μία, δύο φορές καλεσμένη.
 *
 * **Ιδιότητες (N.7.2):**
 * · **Idempotent** — δεύτερη κλήση με τα ίδια δεδομένα δεν αλλάζει τίποτα.
 * · **Καθαρή** — δεν μεταλλάσσει ούτε τον πίνακα ούτε τις οντότητες· φτιάχνει νέα αντικείμενα
 *   **μόνο** για όσες όντως αλλάζουν.
 * · **Σταθερή αναφορά** — όταν δεν αλλάζει τίποτα επιστρέφει τον **ίδιο** πίνακα. Νέος πίνακας
 *   σε κάθε κλήση είναι η κλασική αιτία ατέρμονου βρόχου σε React selector (ADR-366).
 *
 * @see types/dxf-external-reference.ts — το μοντέλο της αναφοράς
 * @see types/image.ts — γιατί το `sourceName` είναι σκόπιμο αντίγραφο του `basename`
 */

import type { AnySceneEntity } from '../types/scene';
import type { ImageEntity } from '../types/image';
import { isImageEntity } from '../types/image';
import type { DxfExternalReference } from '../types/dxf-external-reference';

/**
 * Κλειδί ταύτισης `IMAGE` group 340 ↔ `IMAGEDEF` group 5.
 *
 * Τα DXF handles είναι **δεκαεξαδικά**, άρα η πεζότητά τους δεν φέρει πληροφορία: το AutoCAD
 * γράφει κεφαλαία, αλλά μετατροπείς DWG→DXF τρίτων δεν το εγγυώνται. Ταύτιση ευαίσθητη στην
 * πεζότητα θα απέτυχε σε αρχείο **απολύτως έγκυρο**, και η αποτυχία θα φαινόταν ως «λείπει» —
 * η χειρότερη μορφή σφάλματος, γιατί μοιάζει με φυσιολογική κατάσταση.
 */
const handleKey = (handle: string): string => handle.toUpperCase();

/** `handle (κεφαλαία) → αναφορά`. Αναφορές χωρίς handle δεν μπορούν να συνδεθούν με οντότητα. */
function indexReferencesByHandle(
  refs: readonly DxfExternalReference[],
): Map<string, DxfExternalReference> {
  const byHandle = new Map<string, DxfExternalReference>();
  for (const ref of refs) {
    if (ref.sourceHandle) byHandle.set(handleKey(ref.sourceHandle), ref);
  }
  return byHandle;
}

/**
 * Τα πεδία της εικόνας που **προκύπτουν** από την αναφορά της, ή `null` όταν η εικόνα είναι ήδη
 * συνεπής με αυτήν.
 *
 * Το `url` γράφεται **μόνο** από αναφορά σε κατάσταση `resolved` και **μόνο** όταν η αναφορά
 * όντως φέρει `url`: μια αναφορά που ξαναγύρισε σε `missing` (π.χ. διαγράφηκε το asset) **δεν
 * σβήνει** ό,τι ήδη ζωγραφίζεται — η επίλυση προσθέτει, δεν αφαιρεί.
 */
function imagePatchFor(
  image: ImageEntity,
  ref: DxfExternalReference,
): Partial<ImageEntity> | null {
  const patch: { sourceName?: string; url?: string } = {};
  if (image.sourceName !== ref.basename) patch.sourceName = ref.basename;
  if (ref.status === 'resolved' && ref.url && image.url !== ref.url) patch.url = ref.url;
  return patch.sourceName === undefined && patch.url === undefined ? null : patch;
}

/**
 * Περνά στις `ImageEntity` ό,τι ξέρουν οι αναφορές τους (όνομα πάντα· `url` όταν έχει επιλυθεί).
 *
 * Οντότητες χωρίς `externalRefId`, ή με id που δεν αντιστοιχεί σε καμία αναφορά, μένουν
 * **άθικτες** — δεν είναι σφάλμα: μια εικόνα τοποθετημένη από τον χρήστη μέσα στον ΝΕΣΤΟΡΑ δεν
 * προέρχεται από καμία εξωτερική αναφορά.
 */
export function applyExternalReferencesToEntities(
  entities: AnySceneEntity[],
  refs: readonly DxfExternalReference[],
): AnySceneEntity[] {
  if (refs.length === 0) return entities;
  const byHandle = indexReferencesByHandle(refs);
  if (byHandle.size === 0) return entities;

  let changed = false;
  const next = entities.map((entity): AnySceneEntity => {
    if (!isImageEntity(entity)) return entity;
    if (!entity.externalRefId) return entity;
    const ref = byHandle.get(handleKey(entity.externalRefId));
    if (!ref) return entity;
    const patch = imagePatchFor(entity, ref);
    if (!patch) return entity;
    changed = true;
    return { ...entity, ...patch };
  });

  // Σταθερή αναφορά όταν δεν άλλαξε τίποτα — βλ. κεφαλίδα (ADR-366).
  return changed ? next : entities;
}
