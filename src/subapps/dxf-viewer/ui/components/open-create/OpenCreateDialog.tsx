'use client';

/**
 * OpenCreateDialog — το παράθυρο «Άνοιγμα / Δημιουργία» της Παλέτας σχεδίασης (ADR-914).
 *
 * ΜΙΑ οθόνη, τρεις ενότητες (Δημιουργία · Άνοιγμα · Εισαγωγή). Μόνο παρουσίαση: οι κανόνες των
 * καρτών ζουν στο `open-create-cards`, η εκτέλεση στον host (`OpenCreateLauncher`).
 *
 * @module subapps/dxf-viewer/ui/components/open-create/OpenCreateDialog
 */

import React, { useCallback, useMemo, useRef } from 'react';
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
}

const CARD_GRID = 'grid grid-cols-1 sm:grid-cols-2 gap-2 w-full';

export function OpenCreateDialog({ open, onOpenChange, availability, onAction }: OpenCreateDialogProps) {
  const { t } = useTranslation('dxf-viewer-panels');
  const sections = useMemo(() => buildOpenCreateSections(availability, t), [availability, t]);

  // Όταν το παράθυρο κλείνει ΕΠΕΙΔΗ επιλέχθηκε ενέργεια, η εστίαση ανήκει σε ό,τι ανοίγει εκείνη
  // (το πεδίο μετονομασίας του νέου πρόχειρου, ο οδηγός) — όχι πίσω στο κουμπί. Μετρημένο
  // 2026-10-11: η επιστροφή στο κουμπί έκλεβε την εστίαση από το πεδίο μετονομασίας, και ό,τι
  // πληκτρολογούσε ο άνθρωπος πήγαινε στις συντομεύσεις του καμβά. Με Esc/✕ η εστίαση γυρίζει
  // κανονικά στο κουμπί (προεπιλογή Radix).
  const actionTakenRef = useRef(false);
  const handleSelect = useCallback(
    (kind: OpenCreateActionKind) => {
      actionTakenRef.current = true;
      onAction(kind);
    },
    [onAction],
  );
  const handleCloseAutoFocus = useCallback((event: Event) => {
    if (!actionTakenRef.current) return;
    actionTakenRef.current = false;
    event.preventDefault();
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" onCloseAutoFocus={handleCloseAutoFocus}>
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
              className={CARD_GRID}
              ariaLabel={section.title}
            />
          </section>
        ))}
      </DialogContent>
    </Dialog>
  );
}
