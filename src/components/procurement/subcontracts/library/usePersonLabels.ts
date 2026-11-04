'use client';

/**
 * Ο προτείνων / αποφασίσας ως **όνομα** — «Προτεινόμενη βιβλιοθήκη» για το σύστημα, το όνομα του ανθρώπου (με το
 * υπάρχον `useUserDisplayNames`), «άγνωστος χρήστης» όσο δεν βρέθηκε. Ποτέ ωμό uid στην οθόνη (ADR-928 Φ3γ-0).
 */

import { useCallback, useMemo } from 'react';
import { useUserDisplayNames } from '@/hooks/useUserDisplayNames';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { humanUidsOf, isSystemProposer } from './library-labels';

export function usePersonLabels(uids: readonly (string | null)[]): (uid: string | null) => string {
  const { t } = useTranslation('procurement');
  const key = uids.join('|');
  const humans = useMemo(() => humanUidsOf(key.split('|')), [key]);
  const names = useUserDisplayNames(humans);
  return useCallback(
    (uid: string | null) => {
      if (uid === null || uid.length === 0) return '—';
      if (isSystemProposer(uid)) return t('subcontracts.library.person.system');
      return names.get(uid) ?? t('subcontracts.editor.deviations.unknownUser');
    },
    [names, t],
  );
}
