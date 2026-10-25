import 'server-only';

/**
 * Ο **γραφέας των ρυθμίσεων** του καταλόγου (ADR-923 §5.10 Δ6) — **ένα** έγγραφο ανά χώρο: σε ποιες γλώσσες
 * κρίνεται η πληρότητα κάθε καναλιού (Akeneo channel locales).
 *
 * - CAS όπως παντού· το **πρώτο** αποθηκευμένο έγγραφο ζητά `expectedRevision: 0` («διάβασα τις προεπιλογές»).
 * - 🔒 Γλώσσα που **φεύγει εντελώς** από τις ρυθμίσεις ενώ κάποιο προϊόν έχει τιμή σε αυτήν ⇒ απορρίπτεται
 *   (`localeLockedInUse`): αλλιώς κάθε τέτοιο προϊόν θα γινόταν **μη αποθηκεύσιμο** (`localeNotEnabled`) χωρίς να
 *   το έχει αγγίξει κανείς. (Το Akeneo κρατά τις τιμές κρυμμένες· εδώ ο άνθρωπος το μαθαίνει **πριν**.)
 * - Η αλλαγή κάνει μπαγιάτικη την πληρότητα κάθε προϊόντος — το **αποδεικνύει** το αποτύπωμα (Δ7) και τη
 *   διορθώνει η εργασία επανυπολογισμού, όχι μια εγγραφή σε χιλιάδες έγγραφα εδώ.
 * @module server/catalog/catalog-settings-writer.server
 */

import type { HumanLanguage } from '@/i18n/languages';
import type { AuthContext } from '@/lib/auth';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import { validateCatalogSettings } from '@/subapps/catalog/schema/validate-catalog-settings';
import {
  DEFAULT_CATALOG_SETTINGS,
  enabledCatalogLocales,
  type CatalogSettingsDefinition,
} from '@/subapps/catalog/types/catalog-settings';
import { localeInUse } from './catalog-usage-reads.server';
import {
  assertRevision,
  readSingleton,
  runCatalogTransaction,
  stageCreate,
  stageReplace,
  type CatalogTx,
  type StoredCatalogRecord,
} from './catalog-store.server';
import { assertNoIssues, CatalogWriteError } from './catalog-write-error';

type StoredSettings = StoredCatalogRecord<CatalogSettingsDefinition>;

/** Οι γλώσσες που φεύγουν εντελώς και **χρησιμοποιούνται** ακόμη. */
async function lockedLocaleRemovals(
  scope: CatalogTx,
  previous: CatalogSettingsDefinition,
  next: CatalogSettingsDefinition,
): Promise<CatalogIssue[]> {
  const kept = enabledCatalogLocales(next);
  const removed = [...enabledCatalogLocales(previous)].filter((locale: HumanLanguage) => !kept.has(locale));
  const issues: CatalogIssue[] = [];
  for (const locale of removed) {
    if (await localeInUse(scope, locale)) issues.push({ code: 'localeLockedInUse', path: 'channelLocales', params: { locale } });
  }
  return issues;
}

export async function saveCatalogSettings(
  ctx: AuthContext,
  expectedRevision: number,
  definition: CatalogSettingsDefinition,
): Promise<StoredSettings> {
  assertNoIssues(validateCatalogSettings(definition));
  return runCatalogTransaction(ctx, async (scope) => {
    const { target, current } = await readSingleton<CatalogSettingsDefinition>(scope, 'settings');
    assertRevision({ revision: current?.revision ?? 0 }, expectedRevision);
    const locked = await lockedLocaleRemovals(scope, current ?? DEFAULT_CATALOG_SETTINGS, definition);
    if (locked.length > 0) throw new CatalogWriteError('inUse', locked);
    const stored: CatalogSettingsDefinition = { channelLocales: definition.channelLocales };
    return current ? stageReplace(scope, 'settings', current, stored) : stageCreate(scope, 'settings', target, stored);
  });
}
