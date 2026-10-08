'use client';

/**
 * @fileoverview **Ο ΚΟΙΝΟΣ ΞΕΝΙΣΤΗΣ ΤΩΝ ΔΙΑΛΟΓΩΝ ΔΗΜΟΣΙΕΥΣΗΣ** — ακούει ένα σήμα του ribbon και στήνει τον διάλογο μόνο όσο είναι ανοιχτός.
 * @related ../PublishModelHost (ADR-845 Φ4.2β) · ../PublishFloorplanHost (ADR-909 Β2.5) · ./useExportDeps
 * @module subapps/dxf-viewer/app/dialog-hosts/PublishDialogHost
 *
 * Εξήχθη από τον `PublishModelHost` όταν απέκτησε δεύτερο προορισμό: «άκου σήμα → άνοιξε → δώσε τα ζωντανά
 * υλικά → κλείσε» είναι **η ίδια** συναρμολόγηση για 3D και για κάτοψη, και δύο αντίγραφα θα σήμαιναν ότι οι
 * δύο δημοσιεύσεις μπορούν να δουν **άλλο ενεργό κτήριο** για τον ίδιο άνθρωπο, σιωπηλά.
 *
 * ADR-040: μηδέν canvas subscriptions.
 */

import * as React from 'react';

import type { ExportDeps } from '../../export/types';
import { useEventGatedDialog } from './useEventGatedDialog';
import { useExportDeps } from './useExportDeps';

/** Ό,τι παίρνει **κάθε** διάλογος δημοσίευσης από τον ξενιστή του. */
export interface PublishDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  /** Το κτήριο του ενεργού επιπέδου — ορίζει **ποια** ακίνητα προσφέρονται. */
  readonly activeBuildingId: string | null;
  /** Συλλέγει τα ζωντανά υλικά τη **στιγμή** που χρειάζονται. */
  readonly collectDeps: () => ExportDeps;
}

type PublishRequestEvent = 'dxf:publish-model-requested' | 'dxf:publish-floorplan-requested';

export interface PublishDialogHostProps {
  readonly event: PublishRequestEvent;
  readonly Dialog: React.ComponentType<PublishDialogProps>;
  /** Ενεργό κτήριο του ξενιστή — **εφεδρεία** όταν το ενεργό επίπεδο δεν φέρει δικό του. */
  readonly buildingId?: string;
}

export function PublishDialogHost({ event, Dialog, buildingId }: PublishDialogHostProps): React.ReactElement | null {
  const { open, close } = useEventGatedDialog(event);
  if (!open) return null;
  return <PublishDialogBody Dialog={Dialog} buildingId={buildingId} onClose={close} />;
}

/**
 * ⚠️ **Χωριστό σώμα, όπως στον `ExportHost`**: το `useExportDeps` ανοίγει συνδρομές Firestore,
 * και ένας always-mounted host θα τις κρατούσε ζωντανές **πάντα**. Το gate είναι πάνω από τα
 * hooks, όχι μέσα τους.
 */
function PublishDialogBody({ Dialog, buildingId, onClose }: {
  readonly Dialog: React.ComponentType<PublishDialogProps>;
  readonly buildingId?: string;
  readonly onClose: () => void;
}): React.JSX.Element {
  const { activeBuildingId, collect } = useExportDeps(buildingId);

  const handleOpenChange = React.useCallback(
    (next: boolean) => { if (!next) onClose(); },
    [onClose],
  );

  return <Dialog open onOpenChange={handleOpenChange} activeBuildingId={activeBuildingId} collectDeps={collect} />;
}
