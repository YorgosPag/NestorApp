'use client';

import React, { useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  subscribeRegionPerimeterPreview,
  getRegionPerimeterPreview,
} from '../../systems/region-preview/RegionPerimeterPreviewStore';
// ADR-040 Phase XXII.B — δικό του transform subscription (leaf), όχι prop από τον shell.
import { useTransformValue } from '../../systems/cursor/ImmediateTransformStore';
import type { Viewport } from '../../rendering/types/Types';
import { PreviewZoneShape } from './preview-zone/PreviewZoneShape';

interface Props {
  viewport: Viewport;
}

/**
 * ADR-419 Layer 3 — SVG overlay που δείχνει το ανιχνευμένο περίγραμμα κάτω από τον
 * κέρσορα όταν είναι ενεργό εργαλείο «σε περιοχή / από περίγραμμα» (κολώνες +
 * τοίχοι), Revit «Finish Sketch» feedback. Πράσινο = έγκυρο μέλος· κόκκινο =
 * πολύ μεγάλο (εξωτερικό περίγραμμα → δεν θα δημιουργηθεί). Δείχνει διαστάσεις.
 *
 * ADR-911 Φ3β — η ζωγραφική κάθε ζώνης ζει στο κοινό `PreviewZoneShape` (ένα λεξιλόγιο
 * όψης με τον βοηθό «Μοντέλο από το σχέδιο»)· εδώ μένει μόνο η απόφαση «ποιος τόνος».
 *
 * ADR-040 compliant: standalone subscriber (useSyncExternalStore στο leaf, όχι στο
 * shell). Mirror του `AutoAreaPreviewOverlay`.
 */
export function RegionPerimeterPreviewOverlay({ viewport }: Props) {
  const { t } = useTranslation('dxf-viewer-shell');
  const preview = useSyncExternalStore(
    subscribeRegionPerimeterPreview,
    getRegionPerimeterPreview,
    getRegionPerimeterPreview,
  );
  // ADR-040 Phase XXII.B — leaf-level transform (κοστίζει μόνο όσο υπάρχει preview).
  const transform = useTransformValue();

  if (!preview || preview.zones.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 size-full pointer-events-none z-10"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ADR-419 §thickness-zones — ΚΑΘΕ ζώνη σταθερού πάχους ξεχωριστό περίγραμμα +
          ετικέτα (ένας τοίχος ανά ζώνη), ώστε η preview να δείχνει ΑΚΡΙΒΩΣ ό,τι θα
          δημιουργήσει το κλικ (preview ≡ commit). */}
      {preview.zones.map((zone, zi) => {
        // ADR-419 Layer 4 (oversized) + ADR-567 (occupied) + v2.4 (reason: κοντός/χοντρός/
        // κατειλημμένος) → απόρριψη ανά ζώνη· αλλιώς αποδοχή.
        const rejected = preview.oversized || zone.occupied === true || zone.reason !== undefined;
        // Rejected ζώνη → δείξε τον ΛΟΓΟ (Giorgio επιλογή Α)· αλλιώς τις διαστάσεις.
        const reasonText = zone.reason ? t(zone.reason) : undefined;
        return (
          <PreviewZoneShape
            key={zi}
            pieces={[zone.polygon]}
            tone={rejected ? 'reject' : 'accept'}
            label={reasonText ?? zone.label}
            title={reasonText}
            transform={transform}
            viewport={viewport}
          />
        );
      })}
    </svg>
  );
}
