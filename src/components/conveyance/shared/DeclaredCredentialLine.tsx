'use client';

/**
 * «ΑΜ 1234 · ΔΣΑ (δηλωμένο)» — η ΜΙΑ απόδοση της δηλωμένης ιδιότητας (ADR-901 Ε-4), για **κάθε** θεατή:
 * τον οικοδεσπότη (θέσεις επαγγελματιών) και τους άλλους επαγγελματίες (Συμμετέχοντες, Φ4).
 *
 * Ποτέ «επαληθευμένο» μέχρι τη φάση επαλήθευσης μητρώου. Αποδίδεται ως **`<span>`**, ώστε να μπαίνει σε γραμμή
 * κειμένου (`<p>`) χωρίς άκυρο HTML (`<p>` μέσα σε `<p>`).
 *
 * @module components/conveyance/shared/DeclaredCredentialLine
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { DeclaredCredential } from '@/types/engagement';

export function DeclaredCredentialLine({ credential }: { readonly credential: DeclaredCredential }) {
  const { t } = useTranslation(['conveyance']);
  const colors = useSemanticColors();
  return (
    <span className={cn('text-xs', colors.text.muted)}>
      {credential.chapter
        ? t('engagement.credential.declared', { number: credential.number, chapter: credential.chapter })
        : t('engagement.credential.declaredNoChapter', { number: credential.number })}
    </span>
  );
}
