'use client';

/**
 * 🔴 ADR-828 Φ4β — **Ο ΕΝΑΣ ΞΕΝΙΣΤΗΣ** του διαχειριστή λιστών, όταν ανοίγει ως διάλογος.
 *
 * Ίδιο μοτίβο με τον `TableFormatCellsDialogHost` (ADR-739 §61), για τον ίδιο λόγο: ο
 * εκκινητής είναι **item μενού**, δηλαδή κάτι που ξεμοντάρει τη στιγμή που το πατάς και δεν
 * μπορεί να ζωγραφίσει τίποτα που το επιβιώνει. Ζει στο `DxfViewerDialogs`, τον τεκμηριωμένο
 * «growth sink» των μόνιμα μονταρισμένων hosts.
 *
 * **Gate-at-mount**: ο ξενιστής ακούει μόνο το ελαφρύ store· ολόκληρο το δέντρο (φόρμα,
 * κατάλογος, συνδρομή στο `UserSettings`) μοντάρεται μόνο όσο υπάρχει αίτημα.
 *
 * 🔑 Το `key={request.id}` δεν είναι διακοσμητικό: η φόρμα σπέρνεται στο mount από τα
 * `seeds`. Χωρίς αυτό, ένα δεύτερο άνοιγμα πάνω σε **άλλα** κελιά θα κρατούσε την
 * προηγούμενη πρόταση — ο άνθρωπος θα έβλεπε ονόματα που δεν μάρκαρε.
 *
 * @module subapps/dxf-viewer/ui/components/auto-fill-lists/AutoFillListsDialogHost
 * @see state/auto-fill-lists-dialog-store.ts — η κατάσταση και οι δύο υποδοχές
 */

import React from 'react';
import { useTranslation } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  closeAutoFillListsDialog,
  useAutoFillListsRequest,
} from '../../../state/auto-fill-lists-dialog-store';
import { AutoFillListsManager } from './AutoFillListsManager';
import { AUTO_FILL_LISTS_KEYS } from './auto-fill-lists-labels';

export function AutoFillListsDialogHost(): React.ReactElement | null {
  const { t } = useTranslation(['dxf-viewer-settings']);
  const request = useAutoFillListsRequest();
  if (request === null) return null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) closeAutoFillListsDialog(); }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t(AUTO_FILL_LISTS_KEYS.title)}</DialogTitle>
          <DialogDescription>{t(AUTO_FILL_LISTS_KEYS.description)}</DialogDescription>
        </DialogHeader>
        <AutoFillListsManager key={request.id} seeds={request.seeds} />
      </DialogContent>
    </Dialog>
  );
}

export default AutoFillListsDialogHost;
