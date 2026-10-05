'use client';

/**
 * EntityLinkOptionsError — «οι επιλογές δεν φόρτωσαν» μέσα σε κάρτα σύνδεσης (ADR-898 §21.6 Ε6-β).
 *
 * Ως τις 2026-10-05 μια αποτυχημένη φόρτωση έδινε **άδειο επιλογέα**: ο άνθρωπος διάβαζε «δεν υπάρχουν κτίρια» ενώ απλώς
 * δεν είχαν έρθει. Η άδεια λίστα και η αποτυχία είναι δύο διαφορετικές καταστάσεις και δείχνονται διαφορετικά.
 *
 * @module components/shared/EntityLinkOptionsError
 * @see hooks/useEntityLink — ο ιδιοκτήτης της κατάστασης (`optionsFailed` + `retryOptions`)
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';

export interface EntityLinkOptionsFailure {
  /** Ξαναδιάβασε τις επιλογές. */
  readonly onRetry: () => void;
}

interface EntityLinkOptionsErrorProps extends EntityLinkOptionsFailure {
  /** `true` όταν δίπλα στο σφάλμα μένει η τελευταία γνωστή λίστα — το μήνυμα το λέει. */
  readonly stale: boolean;
}

export function EntityLinkOptionsError({ onRetry, stale }: EntityLinkOptionsErrorProps) {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const iconSizes = useIconSizes();

  return (
    <p role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
      <AlertCircle className={iconSizes.sm} aria-hidden="true" />
      <span>{t(stale ? 'entityLink.optionsStale' : 'entityLink.optionsError')}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t('entityLink.retry')}
      </Button>
    </p>
  );
}
