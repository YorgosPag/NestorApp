/**
 * Η κατάσταση της στοίβας εκδόσεων για την οθόνη ιστορικού (ADR-862 Φ0).
 *
 * 🔑 Η οθόνη **δεν** κρατά αισιόδοξη εκδοχή της στοίβας: η «Ορισμός ως τρέχουσας» αλλάζει
 * ποια έκδοση ισχύει για **όλο** το γραφείο, οπότε η αλήθεια διαβάζεται **ξανά** από τον
 * διακομιστή μετά από επιτυχία — ή μετά από `head-moved`, όπου η εικόνα ήταν μπαγιάτικη.
 *
 * @module components/shared/files/hooks/useVersionStack
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import {
  fetchVersionStack,
  requestVersionPromotion,
  type PromoteVersionOutcome,
} from '@/services/filesystem/version-stack.client';
import type { FileVersionEntry, FileVersionStackResponse } from '@/types/file-version-stack';

/** «v{n}» ανά id — παλαιότερη = v1, κεφαλή = η μεγαλύτερη. */
function versionNumbers(versions: readonly FileVersionEntry[]): ReadonlyMap<string, number> {
  return new Map(versions.map((version, index) => [version.id, versions.length - index]));
}

/** Η ανακοίνωση της έκβασης — μεταφρασμένη, ποτέ ωμό όνομα αιτίας (N.11). */
function useAnnounce(): (outcome: PromoteVersionOutcome) => void {
  const { t } = useTranslation(['files', 'files-media']);
  const { success, error: showError } = useNotifications();
  return useCallback((outcome: PromoteVersionOutcome) => {
    if (outcome.kind === 'promoted') {
      success(t('versions.promoted'));
      return;
    }
    const reason = outcome.kind === 'refused' ? outcome.why : 'failed';
    showError(t('versions.promotion.refused', { reason: t(`versions.promotion.reason.${reason}`) }));
  }, [success, showError, t]);
}

export function useVersionStack(fileId: string, onPromoted?: () => void) {
  const announce = useAnnounce();
  const [stack, setStack] = useState<FileVersionStackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setStack(await fetchVersionStack(fileId));
    setLoading(false);
  }, [fileId]);

  useEffect(() => { void load(); }, [load]);

  const promote = useCallback(async (version: FileVersionEntry) => {
    if (!stack) return;
    setPromotingId(version.id);
    const outcome = await requestVersionPromotion(version.id, stack.headFileId);
    setPromotingId(null);
    announce(outcome);
    const stale = outcome.kind === 'promoted' || (outcome.kind === 'refused' && outcome.why === 'head-moved');
    if (stale) void load();
    if (outcome.kind === 'promoted') onPromoted?.();
  }, [stack, announce, load, onPromoted]);

  const numbers = useMemo(() => versionNumbers(stack?.versions ?? []), [stack]);

  return { stack, loading, promotingId, numbers, promote } as const;
}
