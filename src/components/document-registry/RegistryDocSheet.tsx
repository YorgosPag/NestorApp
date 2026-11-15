'use client';

/**
 * @fileoverview ADR-915 §41.5 — **το πλαϊνό πάνελ ενός εγγράφου**: η πλήρης κάρτα της γραμμής, με δικό της σύνδεσμο `?doc=`.
 * @related RegistryDocCard.tsx (η κάρτα — χωριστό κομμάτι κώδικα) · registry-surfaces.tsx (το όριο) ·
 *   lib/document-validity/document-registry-view.ts (`registryRowOfDocParam`) · hooks/document-registry/useRegistryAddress.ts
 * @module components/document-registry/RegistryDocSheet
 *
 * 🏆 Linear · Gmail: η λεπτομέρεια ανοίγει **δίπλα** στη λίστα, η λίστα μένει στη θέση της, ο σύνδεσμος μοιράζεται και το
 *    «Πίσω» την κλείνει. Εδώ ο **ίδιος** σύνδεσμος ανοίγει από τη γραμμή «Ανέλαβε» μιας επαφής (κλειδί υποκειμένου).
 * 🔑 **Το πρώτο καρέ ΔΕΝ κουβαλά την κάρτα** (CHECK 3.34): τίτλος + περιγραφή αποδίδονται αμέσως (από το slice), η κάρτα
 *    κατεβαίνει ως επιφάνεια (κώδικας + κείμενα) με ορατή «Φόρτωση…» — συνήθως ήδη προθερμασμένη από την πρόθεση.
 * 🔑 Ζει **μέσα** στους παρόχους `ObligorDesignationProvider` / `IssuanceAssignmentProvider`: οι πράξεις της κάρτας
 *    (υπεύθυνος · ανάθεση) δουλεύουν όπως πριν· το context περνά και από το portal του Radix.
 * 🔑 Άγνωστο `?doc=` ⇒ **κλειστό** — καμία ψευδής κάρτα.
 */

import React, { useMemo } from 'react';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { registryRowKindOf } from '@/lib/document-validity/document-registry';
import { registryRowOfDocParam } from '@/lib/document-validity/document-registry-view';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { RegistrySurfaces } from '@/components/document-registry/registry-surfaces';
import { LAYOUT_KEYS } from '@/components/document-registry/registry-layout-labels';
import {
  CONVEYANCE_NS,
  DOCUMENT_KIND_LABEL_KEYS,
  LEGALITY_NS,
  REGISTRY_NS,
} from '@/components/document-registry/document-registry-labels';

export interface RegistryDocSheetProps {
  readonly registry: DocumentRegistryResponse;
  /** Η ωμή τιμή του `?doc=`. */
  readonly doc: string | null;
  readonly onClose: () => void;
}

export function RegistryDocSheet({ registry, doc, onClose }: RegistryDocSheetProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const row = useMemo(() => registryRowOfDocParam(registry.rows, doc), [registry.rows, doc]);
  return (
    <Sheet open={row !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-xl">
        {row !== null ? (
          <>
            <SheetHeader>
              <SheetTitle>{t(DOCUMENT_KIND_LABEL_KEYS[registryRowKindOf(row)])}</SheetTitle>
              <SheetDescription>{t(LAYOUT_KEYS.sheetDescription)}</SheetDescription>
            </SheetHeader>
            <RegistrySurfaces.RegistryDocCard row={row} registry={registry} />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
