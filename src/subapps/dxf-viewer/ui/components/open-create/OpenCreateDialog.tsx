'use client';

/**
 * OpenCreateDialog — το παράθυρο «Άνοιγμα / Δημιουργία» της Παλέτας σχεδίασης (ADR-914).
 *
 * ΜΙΑ οθόνη, τρεις ενότητες (Δημιουργία · Άνοιγμα · Εισαγωγή). Μόνο παρουσίαση: οι κανόνες των
 * καρτών ζουν στο `open-create-cards`, η εκτέλεση στον host (`OpenCreateLauncher`).
 *
 * @module subapps/dxf-viewer/ui/components/open-create/OpenCreateDialog
 */

import React, { useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChoiceCards } from '@/components/ui/choice-cards';
import {
  buildOpenCreateSections,
  type OpenCreateActionKind,
  type OpenCreateAvailability,
} from './open-create-cards';

interface OpenCreateDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly availability: OpenCreateAvailability;
  readonly onAction: (kind: OpenCreateActionKind) => void;
  /**
   * Μια ενέργεια εκτελείται και το παράθυρο την περιμένει (το πρόχειρο γεννιέται). Οι κάρτες δεν
   * δέχονται δεύτερη επιλογή· η εστίαση μένει μέσα στο παράθυρο.
   */
  readonly busy?: boolean;
  /** Πού πάει η εστίαση όταν κλείσει — ο host ξέρει ΓΙΑΤΙ έκλεισε (Radix `onCloseAutoFocus`). */
  readonly onCloseAutoFocus?: (event: Event) => void;
}

const CARD_GRID = 'grid grid-cols-1 sm:grid-cols-2 gap-2 w-full';
const BUSY_GRID = 'pointer-events-none opacity-60';

export function OpenCreateDialog({
  open,
  onOpenChange,
  availability,
  onAction,
  busy = false,
  onCloseAutoFocus,
}: OpenCreateDialogProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const sections = useMemo(() => buildOpenCreateSections(availability, t), [availability, t]);

  // Όσο μια ενέργεια εκτελείται, δεύτερο κλικ δεν ξεκινά δεύτερη (δύο πρόχειρα από διπλό κλικ).
  // Οι κάρτες ΔΕΝ γίνονται `disabled`: ένα ανενεργό κουμπί χάνει την εστίαση προς το `<body>`.
  const handleSelect = useCallback(
    (kind: OpenCreateActionKind) => {
      if (!busy) onAction(kind);
    },
    [busy, onAction],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" onCloseAutoFocus={onCloseAutoFocus} aria-busy={busy}>
        <DialogHeader>
          <DialogTitle>{t('panels.openCreate.title')}</DialogTitle>
          <DialogDescription>{t('panels.openCreate.description')}</DialogDescription>
        </DialogHeader>

        {sections.map((section) => (
          <section key={section.id} className="space-y-2" aria-labelledby={`open-create-${section.id}`}>
            <h3
              id={`open-create-${section.id}`}
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {section.title}
            </h3>
            <ChoiceCards
              options={section.cards}
              onSelect={handleSelect}
              className={busy ? `${CARD_GRID} ${BUSY_GRID}` : CARD_GRID}
              ariaLabel={section.title}
            />
          </section>
        ))}
      </DialogContent>
    </Dialog>
  );
}
