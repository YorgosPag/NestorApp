'use client';

/**
 * =============================================================================
 * IkaTabStatusCards — οι κοινές κάρτες κατάστασης των καρτελών ΙΚΑ
 * =============================================================================
 *
 * Φόρτωση · σφάλμα · προειδοποίηση. Ζούσαν γραμμένες με το χέρι σε κάθε καρτέλα
 * (Εργαζόμενοι, Παρουσιολόγιο, ΕΦΚΑ, Ένσημα) — εδώ είναι η μία τους μορφή.
 *
 * @module components/projects/ika/components/IkaTabStatusCards
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 */

import React from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent } from '@/components/ui/card';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { cn } from '@/lib/utils';

/** Η καρτέλα φορτώνει τα δεδομένα της. */
export function IkaTabLoadingCard() {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-12">
        <Spinner size="large" />
      </CardContent>
    </Card>
  );
}

interface IkaTabErrorCardProps {
  /** Το μήνυμα σφάλματος, ήδη μεταφρασμένο από τον καλούντα. */
  readonly message: ReactNode;
}

/** Η καρτέλα δεν μπόρεσε να φορτώσει. */
export function IkaTabErrorCard({ message }: IkaTabErrorCardProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  return (
    <Card>
      <CardContent className="flex items-center justify-center gap-2 py-12">
        <AlertCircle className={cn(iconSizes.md, colors.text.error)} />
        <p className={typography.special.secondary}>{message}</p>
      </CardContent>
    </Card>
  );
}

interface IkaIssueWarningCardProps {
  /** Το κείμενο της προειδοποίησης. */
  readonly children: ReactNode;
}

/** Μία προειδοποίηση πάνω από το περιεχόμενο της καρτέλας (ένα ζήτημα ανά κάρτα). */
export function IkaIssueWarningCard({ children }: IkaIssueWarningCardProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacing = useSpacingTokens();
  const borderTokens = useBorderTokens();
  return (
    <Card className={borderTokens.quick.warning}>
      <CardContent className={cn('flex items-center', spacing.padding.md)}>
        <AlertTriangle className={cn(iconSizes.md, colors.text.warning, spacing.margin.right.sm)} />
        <p className={cn(typography.body.sm, colors.text.warning)}>{children}</p>
      </CardContent>
    </Card>
  );
}
