/**
 * @fileoverview 🏆 **Ο ΤΡΙΤΟΣ ΠΑΡΑΓΩΓΟΣ ΤΟΥ ΔΗΜΟΣΙΟΥ ΡΑΦΙΟΥ** — το σήμα του
 *   επαγγελματία (ADR-841 §7 Α21, Στάδιο 2).
 * @related ADR-841 §7 Α21.6 · Α12.7 · services/upload/utils/public-shelf-kinds
 * @module services/mandate/showcase-mark-publication
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΟΙ ΤΡΕΙΣ ΠΑΡΑΓΩΓΟΙ, ΚΑΙ ΓΙΑΤΙ Ο ΤΡΙΤΟΣ ΕΙΝΑΙ ΔΙΑΦΟΡΕΤΙΚΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | παραγωγός | πού διαλέγει ο άνθρωπος | από πού έρχεται το μονοπάτι |
 * |---|---|---|
 * | ιδιώτης | `OwnerPropertyMediaField` | **αποθηκευμένο** `OwnerPropertyMedia.storagePath` |
 * | γραφείο | `classification: 'public'` | **αποθηκευμένο** `files/{id}.storagePath` |
 * | **βιτρίνα** | *(Φάση 2 — οθόνη)* | 🔴 **ΤΟ ΣΥΡΜΑ** |
 *
 * 🔴 **ΚΑΙ ΑΥΤΗ Η ΤΕΛΕΥΤΑΙΑ ΓΡΑΜΜΗ ΕΙΝΑΙ ΟΛΟΚΛΗΡΟ ΤΟ ΣΚΕΠΤΙΚΟ ΑΥΤΟΥ ΤΟΥ ΑΡΧΕΙΟΥ.**
 * Στους δύο πρώτους, το *«είναι δικό σου αυτό το αρχείο;»* απαντήθηκε **στο ανέβασμα**:
 * ο γραφέας διαβάζει μονοπάτια από έγγραφο που ο ίδιος ο άνθρωπος κατέχει, οπότε το
 * ερώτημα **δεν ξαναγεννιέται**.
 *
 * Εδώ το μονοπάτι το **στέλνει ο πελάτης**. Χωρίς ρητό φρουρό, ο επαγγελματίας Α
 * δηλώνει μονοπάτι της εταιρείας Β και το **δημοσιεύει σε ανώνυμο κοινό** — δηλαδή η
 * πλατφόρμα γίνεται μηχανή εξαγωγής ιδιωτικών αρχείων, με **μία** κλήση API.
 *
 * ⇒ {@link markSourceForCompany} απαντά *«ανήκει αυτό το μονοπάτι σε **αυτόν**;»* πριν
 * αγγίξει byte, και η ταυτότητα έρχεται **από την απόδειξη** (`showcaseOwnerId`), ποτέ
 * από το σύρμα.
 *
 * ⚠️ **SERVER-ONLY**: το ράφι σέρνει `sharp` + Admin SDK.
 */

import { createModuleLogger } from '@/lib/telemetry';
import { reconcilePublicShelf } from '@/services/listings/public-shelf.service';
import { SHOWCASE_SHELF } from '@/services/upload/utils/public-shelf-kinds';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';
import { parseStoragePath } from '@/services/upload/utils/storage-path';
import {
  SHOWCASE_MARK_ALT_KEYS,
  type ShowcaseMarkKind,
  type ShowcaseMarkMaterial,
} from '@/lib/agency/showcase-mark-kind';
import type { DeclaredShowcaseMark } from '@/types/agency-profile';

const logger = createModuleLogger('showcase-mark-publication');

/**
 * **Τι δήλωσε ο άνθρωπος** — είδος + το ιδιωτικό αρχείο που διάλεξε.
 *
 * ⚠️ **Μονοπάτι, ποτέ bytes και ποτέ URL** — ίδιο συμβόλαιο με το
 * {@link PublicShelfSource}: ο γραφέας κατεβάζει το πρωτότυπο **ο ίδιος**, ώστε ο
 * καθαρισμός EXIF/GPS να **μην μπορεί** να παρακαμφθεί από τον καλούντα *(Α12.7)*.
 *
 * 🔴 **Και εδώ ο καθαρισμός δεν είναι βελτιστοποίηση — είναι απαίτηση ασφαλείας**: το
 * `portrait` είναι **φυσικό πρόσωπο**, και η selfie του υδραυλικού κουβαλά **GPS του
 * σπιτιού του**.
 */
export interface ShowcaseMarkDeclaration {
  readonly kind: ShowcaseMarkKind;
  readonly privateStoragePath: string;
}

/** Γιατί ένα δηλωμένο σήμα **δεν** δημοσιεύτηκε — ονομαστικά, ποτέ σιωπηλά. */
export type ShowcaseMarkRefusal = 'showcase-mark-not-owned' | 'showcase-mark-unpublishable';

/** Τι απέγινε η δήλωση του σήματος. */
export type ShowcaseMarkOutcome =
  | { readonly kind: 'published'; readonly mark: DeclaredShowcaseMark }
  | { readonly kind: 'cleared' }
  | { readonly kind: 'refused'; readonly reason: ShowcaseMarkRefusal };

/**
 * 🔴 **Ο ΦΡΟΥΡΟΣ ΚΑΤΟΧΗΣ** — *«ανήκει αυτό το μονοπάτι σε **ΑΥΤΗ** την εταιρεία;»*
 *
 * Το κανονικό ιδιωτικό μονοπάτι είναι
 * `companies/{companyId}/entities/…` *(ADR-709)*, οπότε η απάντηση είναι **ανάγνωση του
 * ίδιου του μονοπατιού** — καμία δεύτερη πηγή αλήθειας, κανένα ερώτημα.
 *
 * 🔑 **Χρησιμοποιεί τον ΥΠΑΡΧΟΝΤΑ αναγνώστη** ({@link parseStoragePath}) και δεν γράφει
 * δεύτερο: ένας τοπικός `startsWith('companies/' + id)` θα ήταν **δεύτερος κριτής** για
 * τη μορφή του μονοπατιού, ελεύθερος να διαφωνήσει με τον πρώτο — π.χ. στη **legacy**
 * παραλλαγή `companies/{c}/projects/{p}/entities/…` που εκείνος αναγνωρίζει ρητά.
 *
 * ⚠️ **Επιστρέφει `null` αντί να πετάξει**: ο καλών οφείλει να **ονομάσει** την άρνηση
 * στον άνθρωπο, και μια εξαίρεση εδώ θα γινόταν `500` σε αίτημα που είναι απλώς λάθος.
 */
export function markSourceForCompany(
  companyId: string,
  declaration: ShowcaseMarkDeclaration,
): PublicShelfSource<ShowcaseMarkMaterial> | null {
  const parsed = parseStoragePath(declaration.privateStoragePath);
  if (parsed === null || parsed.companyId !== companyId) return null;

  return {
    privateStoragePath: declaration.privateStoragePath,
    material: { kind: declaration.kind },
  };
}

/**
 * **Κάνε το ράφι της βιτρίνας ΑΚΡΙΒΩΣ ίσο με τη δήλωση** — και πες τι έγινε.
 *
 * 🔑 **Η ΑΠΟΣΥΡΣΗ ΕΡΧΕΤΑΙ ΔΩΡΕΑΝ**: `declaration === null` ⇒ κενό σύνολο ⇒ το πρόθεμα
 * `showcases/{companyId}/` **αδειάζει**. Δεν γράφτηκε καμία διαδρομή διαγραφής — είναι
 * η **ίδια** πράξη με άλλη τιμή, ακριβώς όπως στις αγγελίες.
 *
 * ⚠️ **ΤΡΕΧΕΙ ΠΑΝΤΑ, ακόμη και χωρίς δήλωση**, και αυτό είναι η αυτο-ίαση: ένας
 * επαγγελματίας που αφαίρεσε το σήμα του πρέπει να δει τα bytes να **φεύγουν** από τον
 * δημόσιο κάδο, όχι απλώς να πάψουν να αναφέρονται.
 *
 * ⚠️ **Δεν πετά ποτέ** — ίδιο συμβόλαιο με τον γραφέα του ραφιού: αποτυχία εδώ **δεν**
 * ακυρώνει τη δημοσίευση της βιτρίνας. Επιστρέφεται **ονομασμένη**.
 */
export async function publishShowcaseMark(
  companyId: string,
  declaration: ShowcaseMarkDeclaration | null,
): Promise<ShowcaseMarkOutcome> {
  if (declaration === null) {
    await reconcilePublicShelf<ShowcaseMarkMaterial>(SHOWCASE_SHELF, companyId, []);
    return { kind: 'cleared' };
  }

  const source = markSourceForCompany(companyId, declaration);
  if (source === null) {
    // 🔴 ΔΕΝ αγγίζουμε το ράφι: μια «απόσυρση» εδώ θα σήμαινε ότι αίτημα με **ξένο**
    //    μονοπάτι σβήνει το **δικό μου** σήμα — άρνηση που έγινε όπλο.
    logger.warn('Δηλωμένο σήμα ΕΚΤΟΣ του χώρου της εταιρείας — δεν δημοσιεύεται', {
      companyId,
      privateStoragePath: declaration.privateStoragePath,
    });
    return { kind: 'refused', reason: 'showcase-mark-not-owned' };
  }

  const report = await reconcilePublicShelf(SHOWCASE_SHELF, companyId, [source]);
  const published = report.published[0];

  if (report.outcome === 'failed' || published === undefined) {
    logger.error('Το σήμα δεν δημοσιεύτηκε — η βιτρίνα γράφεται ΧΩΡΙΣ αυτό', {
      companyId,
      outcome: report.outcome,
      rejected: report.rejected,
    });
    return { kind: 'refused', reason: 'showcase-mark-unpublishable' };
  }

  return {
    kind: 'published',
    mark: {
      kind: published.material.kind,
      image: {
        url: published.canonical.url,
        width: published.canonical.width,
        height: published.canonical.height,
        // 🔴 **Το alt βγαίνει από το ΕΙΔΟΣ, ποτέ από όνομα αρχείου** (Ο-18): ο άνθρωπος
        //    που ακούει την οθόνη χρειάζεται *«λογότυπο»* ή *«φωτογραφία προσώπου»* —
        //    διαφορετική πληροφορία, όχι διαφορετική διατύπωση.
        altKey: SHOWCASE_MARK_ALT_KEYS[published.material.kind],
        // ⚠️ **ΟΛΑ** τα παράγωγα, όχι μόνο το κανονικό: αυτό ακριβώς είναι το `srcset`.
        sources: published.variants.map((variant) => ({
          url: variant.url,
          width: variant.width,
        })),
      },
    },
  };
}
