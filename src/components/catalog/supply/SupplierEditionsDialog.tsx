'use client';

/**
 * @fileoverview **«Κατάλογοι» ενός προμηθευτή, για τον αγοραστή** (ADR-923 §5.15.3) — το ράφι των εντύπων που βλέπει **αυτός ο
 *   χώρος** μέσω της σχέσης του: τα ανώνυμα της βιτρίνας **και** της ομάδας του, με το ισχύον του για κάθε ράφι μπροστά.
 * @module components/catalog/supply/SupplierEditionsDialog
 *
 * 🔒 Το κοινό το κρίνει ο διακομιστής από τη σύνδεση και τη σχέση (`/api/catalog/suppliers/<σχέση>/editions`), ποτέ από εδώ·
 *    ξένη ή ανενεργή σχέση ⇒ κενή λίστα, όχι σφάλμα που μαρτυρά κάτι.
 * 🔑 Ο αναγνώστης παίρνει άδεια από την πόρτα **του αγοραστή** — κάθε ανανέωση ξαναρωτά τη σχέση, άρα η αποσύνδεση κλείνει και
 *    το ανοιχτό έντυπο.
 */

import React, { useCallback, useMemo, useState } from 'react';

import { CatalogEditionReaderDialog } from '@/components/catalog/editions/CatalogEditionReaderDialog';
import { CatalogEditionShelf, type CatalogEditionOpener } from '@/components/catalog/editions/CatalogEditionShelf';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useBuyerCatalogEditions } from '@/hooks/catalog/useCatalogEditions';
import { catalogEditionLicenseIssuer } from '@/services/catalog/catalog-editions-api.client';
import { CATALOG_API } from '@/subapps/catalog/catalog-routes';
import type { CatalogEditionView } from '@/subapps/catalog/types/catalog-edition';
import type { SupplierEditionsDialogProps } from '../editions/edition-surface-props';
import { usePublicCatalogText } from '@/components/public-catalog/public-catalog-text';

export function SupplierEditionsDialog({ relationshipId, supplierName, onClose }: SupplierEditionsDialogProps) {
  // Κείμενα μόνο από το `public-catalog`: η επιφάνεια αναμένει ΕΝΑ namespace (ADR-744 §27), όχι και το `catalog`.
  const { t } = usePublicCatalogText();
  const api = useBuyerCatalogEditions(relationshipId);
  const [reading, setReading] = useState<CatalogEditionView | null>(null);
  const opener = useMemo<CatalogEditionOpener>(() => ({ kind: 'action', onOpen: setReading }), []);
  const issueOf = useCallback((editionId: string) => catalogEditionLicenseIssuer(CATALOG_API.suppliers.editionFile(relationshipId, editionId), 'signedIn'), [relationshipId]);
  const editions = api.current.state === 'ready' ? api.current.editions : null;
  return (
    <>
      <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>{t('editions.supplierTitle', { name: supplierName })}</SheetTitle></SheetHeader>
          {editions === null ? (
            <p className="m-0 text-sm text-muted-foreground" role="status">{t(api.current.state === 'failed' ? 'editions.unavailable' : 'editions.loading')}</p>
          ) : (
            <CatalogEditionShelf editions={editions} opener={opener} />
          )}
        </SheetContent>
      </Sheet>
      {reading !== null && editions !== null ? (
        <CatalogEditionReaderDialog edition={reading} editions={editions} issueOf={issueOf} onClose={() => setReading(null)} />
      ) : null}
    </>
  );
}
