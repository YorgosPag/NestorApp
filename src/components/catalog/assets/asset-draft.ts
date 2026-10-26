/**
 * @fileoverview **Το πρόχειρο του επεξεργαστή μέσου** — εγγραφή ⇄ πρόχειρο ⇄ ορισμός, και η κρίση πριν σταλεί
 *   (ADR-923 §5.10.4).
 * @related subapps/catalog/schema/validate-catalog-settings.ts (`validateCatalogAsset` — ο ίδιος επικυρωτής με τον γραφέα) ·
 *   lib/media-rights/media-rights-draft.ts
 * @module components/catalog/assets/asset-draft
 *
 * 🔑 Ο κωδικός **δεν** είναι στο πρόχειρο: είναι η ταυτότητα του μέσου (ντετερμινιστικό id) και δεν αλλάζει ποτέ.
 * 🔑 **Αλλαγή είδους με αρχείο δεμένο** ⇒ το αρχείο ξανακρίνεται εδώ, με την ίδια κρίση τύπου που κάνει ο γραφέας
 *    (`fileKindMismatch` στο `kind`) — ένα μέσο «εικόνα» δεν γίνεται σιωπηλά «έγγραφο» με φωτογραφία μέσα.
 */

import type { LocalizedText } from '@/i18n/localized-text';
import {
  mediaRightsDraftIssues,
  mediaRightsDraftOf,
  mediaRightsOf,
  type MediaRightsAuthor,
  type MediaRightsDraft,
  type MediaRightsDraftIssue,
} from '@/lib/media-rights/media-rights-draft';
import type { AssetRecord } from '@/services/catalog/catalog-api.client';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { validateCatalogAsset } from '@/subapps/catalog/schema/validate-catalog-settings';
import type { CatalogAssetInput } from '@/subapps/catalog/schema/zod/asset.schema';
import type { CatalogAssetRole } from '@/subapps/catalog/vocabulary/asset-roles';
import { attachedFileKindIssues } from '@/subapps/catalog/schema/judge-asset-file';
import type { AssetFileTypeFacts } from '@/subapps/catalog/vocabulary/asset-files';
import type { AssetKind } from '@/subapps/catalog/vocabulary/attribute-types';

export interface AssetDraft {
  readonly labels: LocalizedText;
  readonly description: LocalizedText;
  readonly role: CatalogAssetRole;
  readonly kind: AssetKind;
  readonly rights: MediaRightsDraft<'catalog'>;
}

export function assetDraftOf(record: AssetRecord): AssetDraft {
  return {
    labels: record.labels,
    description: record.description,
    role: record.role,
    kind: record.kind,
    rights: mediaRightsDraftOf('catalog', record.rights),
  };
}

/** Πρόχειρο ⇒ ορισμός για τον γραφέα. Τα δικαιώματα χτίζονται **πάνω** στα υπάρχοντα (κρατούν ό,τι η φόρμα δεν δείχνει). */
export function assetInputOf(draft: AssetDraft, record: AssetRecord, author: MediaRightsAuthor, year: number): CatalogAssetInput {
  return {
    code: record.code,
    role: draft.role,
    kind: draft.kind,
    labels: draft.labels,
    description: draft.description,
    rights: mediaRightsOf(draft.rights, author, year, record.rights),
  };
}

/** Το εύρημα της φόρμας δικαιωμάτων ως εύρημα καταλόγου — ίδιος κωδικός και διαδρομή με ό,τι θα έλεγε ο γραφέας. */
const RIGHTS_ISSUE_OF_DRAFT: Readonly<Record<MediaRightsDraftIssue, CatalogIssue>> = {
  creatorRequired: { code: 'rightsCreatorRequired', path: 'rights.creator.name' },
  termDateRequired: { code: 'rightsTermDateRequired', path: 'rights.license.term' },
};

/**
 * Η κρίση πριν σταλεί: ο επικυρωτής του γραφέα + το δεμένο αρχείο απέναντι στο (νέο) είδος + η φόρμα δικαιωμάτων.
 * 🔑 Το «λήξη χωρίς ημερομηνία» **μόνο** η φόρμα το βλέπει: ο ορισμός θα το έκανε σιωπηλά «χωρίς λήξη», άρα πρέπει να
 *    κλειδώσει την αποθήκευση εδώ.
 */
export function assetDraftIssues(
  draft: AssetDraft,
  input: CatalogAssetInput,
  record: AssetRecord,
  attachedFile: AssetFileTypeFacts | null,
): readonly CatalogIssue[] {
  const kindChange = attachedFile !== null && input.kind !== record.kind ? attachedFileKindIssues(input.kind, attachedFile) : [];
  const found = [...validateCatalogAsset({ ...input, fileId: record.fileId }), ...kindChange];
  const rights = mediaRightsDraftIssues(draft.rights).map((issue) => RIGHTS_ISSUE_OF_DRAFT[issue]);
  return [...found, ...rights.filter((issue) => !found.some((other) => other.code === issue.code))];
}
