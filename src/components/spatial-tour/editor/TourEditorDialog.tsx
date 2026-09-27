'use client';

/**
 * @fileoverview **ΤΟ ΠΑΡΑΘΥΡΟ ΤΗΣ ΟΘΟΝΗΣ ΤΟΠΟΘΕΤΗΣΗΣ** — κουμπί στα εισερχόμενα → πλήρης οθόνη (ADR-884 Φ2δ · §4.10).
 * @related `../TourCaptureInbox.tsx` (το ανοίγει, μόνο για τον υπεύθυνο) · `TourEditor.tsx`
 * @module components/spatial-tour/editor/TourEditorDialog
 *
 * 🔑 **Παράθυρο, όχι νέα σελίδα**: ο υπεύθυνος μένει στο ακίνητό του (πρότυπο Matterport — το συρτάρι ανοίγει πάνω από
 *   τον χώρο)· καμία νέα διαδρομή κάτω από το πρόθεμα χώρου (πύλες 3.52/3.60/3.63) για κάτι που ζει μέσα σε μία σελίδα.
 * 🔑 **Το `three` κατεβαίνει μόνο όταν ανοίξει** (`next/dynamic`, `ssr: false`) — η σελίδα του ακινήτου δεν το πληρώνει.
 * 🔑 **Και αυτό το ίδιο φορτώνεται πίσω από `next/dynamic`** (`TourCaptureInbox`): τα εισερχόμενα τα δείχνει ΚΑΙ η σελίδα του
 *   φωτογράφου, που δεν βλέπει ποτέ το κουμπί — οι λέξεις `editor.*` δεν μπαίνουν στο slice της (ΜΕΤΡΗΜΕΝΟ 2026-09-27:
 *   στο `panel.*` ανέβαζαν το `/tour-captures` πάνω από το ταβάνι του, ADR-744 §15).
 * 🔑 Στο κλείσιμο τα εισερχόμενα ξαναφορτώνονται (`onClosed`) — τα σήματα «ατοποθέτητη» άλλαξαν.
 */

import dynamic from 'next/dynamic';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TourSubject } from '@/types/spatial-tour';

import { SPATIAL_TOUR_NS } from '../spatial-tour-namespace';
import { TOUR_EDITOR_KEYS } from './tour-editor-labels';

const TourEditor = dynamic(() => import('./TourEditor').then((m) => m.TourEditor), { ssr: false });

export function TourEditorDialog({ subject, onClosed }: { readonly subject: TourSubject; readonly onClosed: () => void }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const [open, setOpen] = useState(false);
  const change = (next: boolean) => {
    setOpen(next);
    if (!next) onClosed();
  };
  return (
    <Dialog open={open} onOpenChange={change}>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>{t(TOUR_EDITOR_KEYS.open)}</Button>
      <DialogContent size="fullscreen" className="flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle>{t(TOUR_EDITOR_KEYS.title)}</DialogTitle>
          <DialogDescription>{t(TOUR_EDITOR_KEYS.description)}</DialogDescription>
        </DialogHeader>
        {open && <TourEditor subject={subject} />}
      </DialogContent>
    </Dialog>
  );
}
