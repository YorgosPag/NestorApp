'use client';

/**
 * ImportedMeshMeasuredSummary — ADR-683 Φ3.1β: **τι ξέρει η γεωμετρία**, δίπλα στην ερώτηση.
 *
 * Ο χρήστης καλείται να διαλέξει μονάδα μέτρησης· χωρίς τα μετρημένα μεγέθη μπροστά του, η επιλογή
 * είναι στα τυφλά. Ο **όγκος** εμφανίζεται ρητά ως «μη μετρήσιμος» όταν το κέλυφος δεν είναι
 * κλειστό — αυτό είναι και η **εξήγηση** γιατί λείπουν οι μονάδες m³/kg από τη λίστα: το κενό δεν
 * είναι παράλειψη, είναι απάντηση (§10.2, πρακτική Revit DirectShape).
 *
 * Καθαρά παρουσιαστικό: καμία μετατροπή που να μην υπάρχει ήδη — τα mm/m² έρχονται αυτούσια από τα
 * params (`imported-mesh-boq` κρατά τη ΜΙΑ μετατροπή mm→m για την προμέτρηση).
 */

import { useTranslation } from '@/i18n';
import type { ImportedMeshParams } from '../../../bim/entities/imported-mesh/imported-mesh-types';

const K = 'importedMeshBoq.measured';

export interface ImportedMeshMeasuredSummaryProps {
  readonly params: ImportedMeshParams;
}

/** Ακέραια mm — οι μετρημένες διαστάσεις δεν έχουν νόημα σε δέκατα του χιλιοστού. */
function mm(value: number): string {
  return `${Math.round(value)}`;
}

export function ImportedMeshMeasuredSummary({ params }: ImportedMeshMeasuredSummaryProps) {
  const { t } = useTranslation('dxf-viewer-shell');
  const volume = params.measuredVolumeM3;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 px-2 py-2 rounded-md bg-muted/40 text-xs">
      <dt className="text-muted-foreground">{t(`${K}.node`)}</dt>
      <dd className="truncate font-medium">{params.nodeName}</dd>

      <dt className="text-muted-foreground">{t(`${K}.size`)}</dt>
      <dd className="tabular-nums">
        {mm(params.measuredWidthMm)} × {mm(params.measuredDepthMm)} × {mm(params.measuredHeightMm)} mm
      </dd>

      <dt className="text-muted-foreground">{t(`${K}.area`)}</dt>
      <dd className="tabular-nums">{params.measuredSurfaceAreaM2.toFixed(2)} m²</dd>

      <dt className="text-muted-foreground">{t(`${K}.volume`)}</dt>
      <dd className={volume === null ? 'text-muted-foreground italic' : 'tabular-nums'}>
        {volume === null ? t(`${K}.volumeUnmeasurable`) : `${volume.toFixed(3)} m³`}
      </dd>
    </dl>
  );
}
