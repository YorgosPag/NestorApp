'use client';

/**
 * @fileoverview Shared alert primitives for sales action dialogs
 * @description Τα πλαίσια σφαλμάτων/προειδοποιήσεων ήταν αντιγραμμένα αυτούσια
 *              σε ReserveDialog και SellDialog (CHECK 3.28 / ADR-584 token clones).
 *              Εδώ ζουν μία φορά.
 * @see ADR-197 §2.9 — Sales action dialogs
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import '@/lib/design-system';

// =============================================================================
// PRIMITIVES
// =============================================================================

/** Μία γραμμή σφάλματος: εικονίδιο + κείμενο, σε χρώμα destructive. */
function AlertLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-sm text-destructive">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {children}
    </p>
  );
}

// =============================================================================
// PUBLIC COMPONENTS
// =============================================================================

/**
 * Πλαίσιο σφαλμάτων επικύρωσης — δέχεται έτοιμα i18n keys και τα μεταφράζει.
 * Δεν αποδίδει τίποτα όταν η λίστα είναι κενή.
 */
export function SalesValidationAlert({ i18nKeys }: { i18nKeys: readonly string[] }) {
  const { t } = useTranslation(COMMON_NAMESPACES);

  if (i18nKeys.length === 0) return null;

  return (
    <aside className="space-y-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-3">
      {i18nKeys.map((key) => (
        <AlertLine key={key}>{t(key)}</AlertLine>
      ))}
    </aside>
  );
}

/**
 * Σφάλμα αποθήκευσης — το μήνυμα έρχεται ήδη μεταφρασμένο από τον caller
 * (μέσω `resolveSalesDialogError`), γιατί μπορεί να προέρχεται από τον server.
 */
export function SalesSaveError({ message }: { message: string }) {
  if (!message) return null;

  return (
    <p className="flex items-center gap-1.5 text-sm text-destructive px-1">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}

/**
 * Ήπια προειδοποίηση μέσα στο σώμα του dialog (δεν μπλοκάρει την αποθήκευση).
 */
export function SalesInlineWarning({ i18nKey }: { i18nKey: string }) {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const colors = useSemanticColors();

  return (
    <p className={cn('flex items-center gap-1.5 text-xs', colors.text.warning)}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      {t(i18nKey)}
    </p>
  );
}
