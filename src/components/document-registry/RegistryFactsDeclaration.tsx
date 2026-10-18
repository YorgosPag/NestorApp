'use client';

/**
 * @fileoverview **«Συμπλήρωση στοιχείων»** — το κουμπί και ο διάλογος για αρχείο που υπόσχεται παρακολουθούμενο είδος
 *   αλλά δεν έχει ημερομηνίες (ADR-915 §33 — η ΥΔΕ πρώτη).
 * @related lib/document-validity/facts-declaration.ts (`factsDeclarationOf` — πότε προσφέρεται) ·
 *   RegistryFactsDeclarationForm.tsx (η φόρμα, `next/dynamic`)
 * @module components/document-registry/RegistryFactsDeclaration
 *
 * 🔑 Εδώ μένουν **μόνο** κουμπί, τίτλος και περιγραφή· η φόρμα φορτώνεται όταν ανοίξει ο διάλογος (ιδίωμα
 *    `RegistryIssuanceDialogs` — όριο της κλειστότητας του route slice, CHECK 3.34).
 * 🔑 Χωρίς δικαίωμα (`canAct`) ⇒ κανένα κουμπί: εργονομία, όχι ασφάλεια — ο διακομιστής κρίνει ξανά (ADR-801).
 * 🔑 Χωρίς αντικείμενο (`storagePath`) ⇒ κανένα κουμπί: χωρίς CAS καμία δήλωση «στα τυφλά».
 */

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { RegistryDocument } from '@/lib/document-validity/document-registry';
import { factsDeclarationOf } from '@/lib/document-validity/facts-declaration';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { useIssuanceAssignmentActions } from '@/components/document-registry/issuance-assignment-context';
import { FACTS_DECLARATION_KEYS, REGISTRY_NS } from '@/components/document-registry/document-registry-labels';

const FactsDeclarationForm = dynamic(
  () => import('./RegistryFactsDeclarationForm').then((mod) => mod.FactsDeclarationForm),
  { ssr: false },
);

export interface RegistryFactsDeclarationProps {
  readonly document: RegistryDocument;
  readonly registry: Pick<DocumentRegistryResponse, 'files' | 'properties'>;
}

export function RegistryFactsDeclaration({ document, registry }: RegistryFactsDeclarationProps): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const [open, setOpen] = useState(false);
  const mode = factsDeclarationOf(document);
  if (mode === null || actions === null || !actions.canAct || document.origin.kind !== 'file') return null;
  const { fileId } = document.origin;
  // Χωρίς αντικείμενο δεν υπάρχει CAS — καμία δήλωση «στα τυφλά».
  const storagePath = registry.files[fileId]?.storagePath ?? null;
  if (storagePath === null) return null;
  const propertyClass = document.propertyId === null ? null : registry.properties[document.propertyId]?.propertyClass ?? null;
  return (
    <>
      <Button type="button" size="sm" variant={mode === 'declare' ? 'default' : 'outline'} className="self-start" onClick={() => setOpen(true)}>
        {t(mode === 'declare' ? FACTS_DECLARATION_KEYS.declare : FACTS_DECLARATION_KEYS.correct)}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(FACTS_DECLARATION_KEYS.title)}</DialogTitle>
            <DialogDescription>{t(FACTS_DECLARATION_KEYS.description)}</DialogDescription>
          </DialogHeader>
          {/* Μόνο όσο είναι ανοιχτό ⇒ κάθε άνοιγμα ξεκινά από τα τρέχοντα στοιχεία, ποτέ από εγκαταλειμμένη πληκτρολόγηση. */}
          {open ? (
            <FactsDeclarationForm
              document={document} fileId={fileId} storagePath={storagePath} propertyClass={propertyClass}
              revalidate={actions.revalidate} onClose={() => setOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
