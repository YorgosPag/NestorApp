/**
 * @fileoverview **Τι προσφέρει, πού γράφει και τι διαβάζει μια καρτέλα του κελύφους** — καθαρές συναρτήσεις, ένα σημείο.
 * @related ADR-588 (κέλυφος) · ADR-866 §2.10 (Β1) · `components/shared/files/utils/upload-scope.ts`
 * @module components/space-management/shared/tabs/media-tab-scope
 *
 * 🔑 Το `EntityMediaFilesTab` **και** η άγκυρα Α38.1 ρωτούν **τις ίδιες** συναρτήσεις: ό,τι ελέγχει η άγκυρα είναι ό,τι
 * αποδίδεται, όχι ένα αντίγραφό του. Μετάλλαξη εδώ ⇒ κόκκινο εκεί.
 */

import { selectOfferedEntryPoints, type UploadEntryPoint } from '@/config/upload-entry-points';
import {
  tabReadScopes,
  type FilesTabScopePolicy,
  type UploadTabDefaults,
} from '@/components/shared/files/utils/upload-scope';
import type { EntityMediaBinding } from './entity-media-binding';
import type { MediaTabConfig } from './media-tab-configs';

type ScopeBinding = Pick<EntityMediaBinding, 'entityType' | 'purposePrefix'>;

/** Ο σκοπός της καρτέλας — ο **ένας** κανόνας σύνθεσης `${prefix}-${purposeKey}`. */
export function mediaTabPurpose(binding: Pick<EntityMediaBinding, 'purposePrefix'>, media: MediaTabConfig): string {
  return `${binding.purposePrefix}-${media.purposeKey}`;
}

/** Η λευκή λίστα προσφοράς — μεταβλητός πίνακας για το συμβόλαιο του `EntityFilesManager`, μόνο με δηλωμένο εύρος. */
export function mediaTabAllowedEntryPointIds(media: MediaTabConfig): string[] | undefined {
  return media.entryPointScope ? [...media.entryPointScope.offer] : undefined;
}

/** **Τι προσφέρει** η καρτέλα για ανέβασμα — ακριβώς τα κριτήρια που δίνει το κέλυφος στον επιλογέα. */
export function mediaTabOfferedEntryPoints(binding: ScopeBinding, media: MediaTabConfig): UploadEntryPoint[] {
  return selectOfferedEntryPoints({
    entityType: binding.entityType,
    categoryFilter: media.entryPointCategoryFilter,
    excludeCategories: media.entryPointExcludeCategories,
    allowedEntryPointIds: mediaTabAllowedEntryPointIds(media),
  });
}

/**
 * **Οι προεπιλογές ανεβάσματος** της καρτέλας — ακριβώς ό,τι φτάνει στο `useFileUpload` μέσω του `EntityFilesManager`
 * (`domain` · `category` · `purpose` · `scopePolicy.purposeAuthority`). Ένα σημείο για πολιτική **και** άγκυρα.
 */
export function mediaTabUploadDefaults(binding: ScopeBinding, media: MediaTabConfig): UploadTabDefaults {
  return {
    domain: media.domain,
    category: media.category,
    purpose: mediaTabPurpose(binding, media),
    purposeAuthority: media.entryPointScope?.purposeAuthority,
  };
}

/**
 * **Τι διαβάζει** η καρτέλα — παραγόμενο από τους τύπους του `read` μέσω του **ίδιου** επιλυτή με το ανέβασμα.
 * Χωρίς δηλωμένο εύρος ⇒ `undefined` (η καρτέλα διαβάζει με `domain`/`category`, ό,τι ίσχυε).
 */
export function mediaTabScopePolicy(binding: ScopeBinding, media: MediaTabConfig): FilesTabScopePolicy | undefined {
  const scope = media.entryPointScope;
  if (!scope) return undefined;
  const readable = selectOfferedEntryPoints({ entityType: binding.entityType, allowedEntryPointIds: scope.read });
  return {
    purposeAuthority: scope.purposeAuthority,
    readScopes: tabReadScopes(readable, mediaTabUploadDefaults(binding, media)),
  };
}
