'use client';

/**
 * @fileoverview **Το ένα χειριστήριο σημείων λήψης** — κουμπί + χώρος εργασίας, για **κάθε** φιλοξενούμενο (ADR-897 Φ3).
 * @related CaptureSpotWorkspaceDialog.tsx · focal-point/PhotoFocalPointControl.tsx (το ίδιο σχήμα, για την εστίαση)
 * @module components/listings/capture-spots/CaptureSpotControl
 *
 * 🔑 **Δύο φιλοξενούμενοι, ένα component** (N.0.2): γραφείο (`ListingMediaOrderPanel`) και φάκελος ιδιώτη. Διαφέρουν
 *   **μόνο** στο πού αποθηκεύεται η δήλωση — γι' αυτό το `onSave` είναι του φιλοξενούμενου.
 * 🔴 **ΟΡΙΟ `next/dynamic` (CHECK 3.34 Κ2)**: ο χώρος εργασίας ανοίγει **μόνο με κλικ**, άρα τα κλειδιά του δεν ταξιδεύουν
 *   στο route slice — ίδιο σκεπτικό με το `PhotoFocalPointDialog`.
 * ♿ Απενεργοποιημένο **με λόγο** (όχι σιωπηλά): χωρίς κάτοψη ή χωρίς φωτογραφίες, η εξήγηση είναι ορατή δίπλα.
 */

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { MapPinned } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { CaptureSurvey } from '@/lib/listings/capture-survey';
import type { CustodyKind } from '@/lib/workspace/custody-scope';

import type { CaptureSpotFloorplan, CaptureSpotPhoto } from './capture-spot-types';

const K = 'property-market:photoCaptureSpots';

const CaptureSpotWorkspaceDialog = dynamic(
  () => import('./CaptureSpotWorkspaceDialog').then((m) => m.CaptureSpotWorkspaceDialog),
  { ssr: false },
);

export interface CaptureSpotControlProps {
  readonly photos: readonly CaptureSpotPhoto[];
  readonly floorplans: readonly CaptureSpotFloorplan[];
  /** Σημεία λήψης **και** βορράς κατόψεων — μία αποτύπωση, μία αποθήκευση (ADR-897 Φ5.2). */
  readonly declared: CaptureSurvey;
  readonly onSave: (next: CaptureSurvey) => void;
  /** Σε ποιο διαμέρισμα ζουν τα αρχεία — εταιρεία (γραφείο) ή προσωπικό (φάκελος ιδιώτη). */
  readonly custody: CustodyKind;
  readonly disabled?: boolean;
}

/** Πόσες φωτογραφίες έχουν θέση σε κάτοψη που **είναι** δηλωμένη — ό,τι θα δει ο κόσμος. */
function placedCount(props: CaptureSpotControlProps): number {
  const floorplanIds = new Set(props.floorplans.map((floorplan) => floorplan.id));
  return props.photos.filter((photo) => {
    const spot = props.declared.spots.get(photo.id);
    return spot !== undefined && floorplanIds.has(spot.floorplanFileId);
  }).length;
}

export function CaptureSpotControl(props: CaptureSpotControlProps): React.ReactElement {
  const { t } = useTranslation(['property-market']);
  const [open, setOpen] = useState(false);
  // ⚠️ Κάθε κλειδί γραμμένο **ρητά** (ποτέ `t(μεταβλητή)`): ο αναλυτής του route slice (CHECK 3.34) πρέπει να το δει.
  const reason = props.floorplans.length === 0
    ? t(`${K}.needsFloorplan`)
    : props.photos.length === 0 ? t(`${K}.needsPhotos`) : null;

  return (
    <section className="flex flex-wrap items-center gap-2">
      {/* ♿ Χωρίς `aria-label`: το ορατό κείμενο ΕΙΝΑΙ το όνομα (WCAG 2.5.3 — label in name). */}
      <Button type="button" variant="outline" size="sm" disabled={props.disabled || reason !== null}
        onClick={() => setOpen(true)}>
        <MapPinned aria-hidden="true" />
        {t(`${K}.trigger`)}
        <span className="text-xs text-muted-foreground">
          {t(`${K}.progress`, { placed: placedCount(props), total: props.photos.length })}
        </span>
      </Button>
      {reason !== null && <span className="text-xs text-muted-foreground">{reason}</span>}
      {open && (
        <CaptureSpotWorkspaceDialog open={open} onOpenChange={setOpen} photos={props.photos}
          floorplans={props.floorplans} declared={props.declared} onSave={props.onSave} custody={props.custody} />
      )}
    </section>
  );
}
