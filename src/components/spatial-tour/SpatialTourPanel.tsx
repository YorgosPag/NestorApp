'use client';

/**
 * @fileoverview **ΤΟ ΠΑΝΕΛ «ΠΕΡΙΗΓΗΣΗ 360°» ΤΗΣ ΚΑΡΤΕΛΑΣ ΑΓΓΕΛΙΑΣ** — ποιος βλέπει (ρυθμίσεις · αιτήματα · σύνδεσμοι,
 * Κ3β) + φωτογράφοι + εισερχόμενα λήψεων.
 * @related ADR-884 §4.5 (Κ3α) · Φ0.3 · `OwnerPropertyDetailContent.tsx` · `PropertyDetailPageContent.tsx`
 * @module components/spatial-tour/SpatialTourPanel
 *
 * 🔑 **ΕΝΑ συστατικό για ιδιώτη ΚΑΙ γραφείο** (όπως το `MarketingAudienceControl` δίπλα του): αλλάζει μόνο η **ρίζα**
 * (`owner-property` · `company-property`). Ποιος διαχειρίζεται το κρίνει ο διακομιστής (`mayManageTour`) — το πάνελ
 * δεν κρύβει τίποτα «για ασφάλεια»· αν ο δράστης δεν διαχειρίζεται, οι λίστες απαντούν με όνομα.
 * ⚠️ Ο θεατής και ο συντάκτης γράφου (τοποθέτηση στην κάτοψη) είναι Φ1/Φ2 — εδώ ζουν η ροή λήψης και η πρόσβαση.
 * 🔑 `companyId` μόνο στην πλευρά **γραφείου**: οι σύνδεσμοι ανά παραλήπτη (ADR-315) είναι εμβέλειας μισθωτή.
 */

import { useId, useMemo } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TourSubject } from '@/types/spatial-tour';

import { PANEL_KEYS } from './spatial-tour-labels';
import { SPATIAL_TOUR_NS } from './spatial-tour-namespace';
import { TourAccessRequestsSection } from './TourAccessRequestsSection';
import { TourCaptureInbox } from './TourCaptureInbox';
import { TourPhotographersSection } from './TourPhotographersSection';
import { TourSettingsSection } from './TourSettingsSection';

export function SpatialTourPanel({ subject, companyId = null }: { readonly subject: TourSubject; readonly companyId?: string | null }) {
  const { t } = useTranslation(SPATIAL_TOUR_NS);
  const headingId = useId();
  // 🔴 **Σταθερή ταυτότητα της ρίζας**: τα hooks φόρτωσης εξαρτώνται από αυτήν — ένα νέο αντικείμενο σε κάθε render του
  //    γονέα (ζωντανός listener του ακινήτου) θα ξαναζητούσε τις λίστες σε κάθε render.
  const stable = useMemo<TourSubject>(() => ({ kind: subject.kind, id: subject.id }), [subject.kind, subject.id]);
  return (
    // 🔑 Ένα πλαίσιο ΑΝΑ υποενότητα (ADR-777 §8.87.4), όχι ένα γύρω από όλες: τέσσερις ανεξάρτητες δουλειές σε ένα
    //    `Card` διαβάζονταν ως μία μακριά φόρμα. Το πλαίσιο το φορά η ίδια η υποενότητα (`TourPanelSection`).
    <section aria-labelledby={headingId} className="space-y-4">
      <header className="space-y-1">
        <h2 id={headingId} className="text-xl font-semibold leading-none tracking-tight">{t(PANEL_KEYS.title)}</h2>
        <p className="text-sm text-muted-foreground">{t(PANEL_KEYS.description)}</p>
      </header>
      <TourSettingsSection subject={stable} companyId={companyId} />
      <TourAccessRequestsSection subject={stable} />
      <TourPhotographersSection subject={stable} />
      <TourCaptureInbox subject={stable} />
    </section>
  );
}
