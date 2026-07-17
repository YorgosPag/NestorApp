/**
 * ADR-652 M2/M6 — «Αποθήκευση block στην ΙΔΙΩΤΙΚΗ βιβλιοθήκη»: το SSoT που χτίζει το
 * {@link SaveBlockLibraryItemInput} από έναν {@link InSessionBlockDef} + τις τιμές της φόρμας.
 *
 * Δύο καταναλωτές, ΕΝΑ σημείο (N.18): το palette («save session card» → `saveEntry`) και η
 * «Δημιουργία Block» από επιλογή (`CreateBlockDialogHost`). Και οι δύο σώζουν σε scope `user`
 * με ασφαλή provenance — γράφεται ΜΙΑ φορά εδώ ώστε το `jscpd` να μη βλέπει δίδυμα σώματα.
 *
 * @see ./block-library-types.ts — SaveBlockLibraryItemInput / DEFAULT_USER_IMPORT_LICENSE
 * @see ../services/BlockLibraryService.ts — ο service που καταναλώνει το input (saveBlock)
 */

import { computeBlockLocalBoundsMm } from './block-local-bounds';
import type {
  BlockCategory,
  BlockLicense,
  InSessionBlockDef,
  SaveBlockLibraryItemInput,
} from './block-library-types';

/** Ό,τι δίνει ο χρήστης στη φόρμα (όνομα/κατηγορία/άδεια) — κοινό save + create. */
export interface UserBlockSaveValues {
  readonly name: string;
  readonly category: BlockCategory;
  readonly license: BlockLicense;
}

/**
 * Χτίζει το input αποθήκευσης για scope `user`. `null` όταν ο ορισμός δεν έχει μετρήσιμη
 * γεωμετρία (κανένα bounds & άδεια members) — ο καλών το χειρίζεται ως αποτυχία.
 *
 * `now` = timestamp προέλευσης (περνά απ' έξω· τα stores/scripts δεν έχουν `Date.now`).
 */
export function buildUserBlockSaveInput(
  def: InSessionBlockDef,
  values: UserBlockSaveValues,
  userId: string,
  now: number,
): SaveBlockLibraryItemInput | null {
  const boundsMm = def.boundsMm ?? computeBlockLocalBoundsMm(def.localMembers);
  if (!boundsMm) return null;

  return {
    scope: 'user',
    name: values.name,
    category: values.category,
    boundsMm,
    localMembers: def.localMembers,
    provenance: {
      // «user-import» = δικό του, ιδιωτικό, άγνωστης άδειας — καλύπτει και το user-authored block
      // (καμία λογική δεν κάνει switch στο sourceType· η ασφάλεια έρχεται από το license gate).
      sourceType: 'user-import',
      importedAt: now,
      importedBy: userId,
    },
    license: values.license,
  };
}
