'use client';

/**
 * ADR-909 Β2.5 — lifecycle owner του διαλόγου **«Δημοσίευση κάτοψης»**.
 *
 * Αδελφός του `PublishModelHost`: ακούει το σήμα του ribbon (`dxf:publish-floorplan-requested`) και στήνει
 * τον διάλογο **μόνο** όσο είναι ανοιχτός. Η συναρμολόγηση είναι του κοινού `PublishDialogHost` — το ίδιο
 * `useExportDeps`, άρα το **ίδιο** ενεργό επίπεδο και κτήριο με το «Δημοσίευση 3D» και την «Εξαγωγή».
 *
 * Mounted ως `React.Suspense` leaf στο `DxfViewerDialogs`. ADR-040: μηδέν canvas subscriptions.
 *
 * @see ../ui/components/publish-floorplan/PublishFloorplanDialog — το σώμα του διαλόγου
 */

import * as React from 'react';

import { PublishDialogHost } from './dialog-hosts/PublishDialogHost';
import { PublishFloorplanDialog } from '../ui/components/publish-floorplan/PublishFloorplanDialog';

export interface PublishFloorplanHostProps {
  /** Ενεργό κτήριο του ξενιστή — **εφεδρεία** όταν το ενεργό επίπεδο δεν φέρει δικό του. */
  readonly buildingId?: string;
}

export function PublishFloorplanHost({ buildingId }: PublishFloorplanHostProps): React.ReactElement {
  return (
    <PublishDialogHost event="dxf:publish-floorplan-requested" Dialog={PublishFloorplanDialog} buildingId={buildingId} />
  );
}
