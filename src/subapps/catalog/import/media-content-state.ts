/**
 * =============================================================================
 * Η ΚΑΤΑΣΤΑΣΗ ΕΝΟΣ ΠΕΡΙΕΧΟΜΕΝΟΥ ΚΑΡΑΝΤΙΝΑΣ (ADR-934 §5.2.2 Μ-β5) — ο ΕΝΑΣ κριτής
 * =============================================================================
 *
 * Το περιεχόμενο καραντίνας έχει **ντετερμινιστικό** `fileId` (χώρος · sha256 · κατάληξη): τα ίδια bytes ⇒ η ίδια εγγραφή, για
 * πάντα. Άρα η εγγραφή περνά από κύκλο ζωής — ζωντανή → κάδος → επιτύμβιο — και **ξαναζεί** όταν ξαναζητηθούν τα ίδια bytes:
 *
 * | κατάσταση | τι σημαίνει | τι κάνει ο γραφέας |
 * |---|---|---|
 * | `live`    | δική μας, έτοιμη | υιοθετεί |
 * | `trashed` | δική μας, στον κάδο — τα bytes ζουν ως το `purgeAt` | **επαναφέρει** (χωρίς λήψη, αν απαντήσει 304) |
 * | `purged`  | δική μας, επιτύμβιο — τα bytes έχουν φύγει | **αναγεννά** πάνω στο επιτύμβιο με τα bytes που μόλις ήρθαν |
 * | `absent`  | καμία εγγραφή | γεννά |
 * | `foreign` | άλλου χώρου / άλλων bytes / αλλοιωμένη | **αρνείται** — ποτέ δεν υιοθετείται ούτε ξαναγράφεται |
 *
 * 🔑 Η ταυτότητα («δική μας;») κρίνεται από τον **ίδιο** κριτή με τη ζωντανή (`judgeContainerFile`), πάνω σε ένα αντίγραφο χωρίς τα
 *   σημάδια του κάδου: ένας δεύτερος έλεγχος ιδιοκτησίας εδώ θα μπορούσε να αποκλίνει από τον πρώτο.
 * ⛔ **ΚΑΘΑΡΟ** — καμία βάση, κανένας χρόνος.
 *
 * @module subapps/catalog/import/media-content-state
 */

import { ENTITY_TYPES } from '@/config/domain-constants';
import { FILE_LIFECYCLE_STATES } from '@/config/file-lifecycle-states';
import { judgeContainerFile } from '@/lib/files/container-file-verdict';
import { isInTrash } from '@/lib/files/file-trash-state';

export const MEDIA_CONTENT_STATES = ['live', 'trashed', 'purged', 'absent', 'foreign'] as const;
export type MediaContentState = (typeof MEDIA_CONTENT_STATES)[number];

/** Ποιο περιεχόμενο ψάχνουμε: ο χώρος, το `fileId` και τα bytes που πρέπει να έχει. */
export interface MediaContentIdentity {
  readonly companyId: string;
  readonly fileId: string;
  readonly sha256: string;
}

type Data = Readonly<Record<string, unknown>>;

const acceptedAsOurs = (identity: MediaContentIdentity, data: Data): boolean =>
  judgeContainerFile(identity.fileId, data, {
    owner: { kind: 'company', companyId: identity.companyId },
    entityType: ENTITY_TYPES.CATALOG_MEDIA_CONTENT,
    entityId: identity.sha256,
    contentType: () => true,
  }).kind === 'accepted';

/** Η εγγραφή όπως θα ήταν **έξω** από τον κάδο — μόνο για να ρωτηθεί ο κριτής ταυτότητας. */
const outsideTrash = (data: Data): Data => ({ ...data, isDeleted: false });

/** Επιτύμβιο: τα bytes έφυγαν, η εγγραφή έμεινε (`purgedRecordFields`). Μόνο **ανάγνωση** — εδώ δεν εκκαθαρίζεται τίποτα. */
const isTombstone = (data: Data): boolean => data.lifecycleState === FILE_LIFECYCLE_STATES.PURGED;

/** **Η κρίση.** `data` = το έγγραφο του αρχείου, ή `null` αν δεν υπάρχει. */
export function mediaContentStateOf(identity: MediaContentIdentity, data: Data | null): MediaContentState {
  if (data === null) return 'absent';
  if (isTombstone(data)) return acceptedAsOurs(identity, outsideTrash(data)) ? 'purged' : 'foreign';
  if (isInTrash(data)) return acceptedAsOurs(identity, outsideTrash(data)) ? 'trashed' : 'foreign';
  return acceptedAsOurs(identity, data) ? 'live' : 'foreign';
}
