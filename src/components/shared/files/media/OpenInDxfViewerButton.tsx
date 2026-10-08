'use client';

/**
 * @fileoverview **«ΑΝΟΙΓΜΑ ΣΤΟ DXF»** — από την κάτοψη που βλέπεις, στο επίπεδό της μέσα στον DXF viewer (ADR-400).
 * @related hooks/useSceneFileLevelId (ποιο επίπεδο) · lib/dxf-viewer/dxf-viewer-routes (ποια διεύθυνση) · FloorplanGallery (ο κάτοχος)
 * @module components/shared/files/media/OpenInDxfViewerButton
 *
 * 🔑 **Σύνδεσμος, όχι κουμπί με `onClick`**: είναι **πλοήγηση** σε άλλη σελίδα, άρα δουλεύει και το μεσαίο κλικ /
 * «άνοιγμα σε νέα καρτέλα». Το πρόθεμα χώρου το βάζει το σύνορο (`@/lib/workspace/navigation`).
 *
 * ⚠️ **Σιωπά όταν δεν έχει πού να πάει** — αρχείο χωρίς επίπεδο, χρήστης χωρίς δικαίωμα στα επίπεδα, ανώνυμος
 * επισκέπτης δημόσιας σελίδας: σε όλες τις περιπτώσεις αποδίδει **τίποτα**, ποτέ ανενεργό κουμπί χωρίς εξήγηση.
 */

import type { ReactElement } from 'react';
import { PencilRuler } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSceneFileLevelId } from '@/hooks/useSceneFileLevelId';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { dxfViewerLevelHref } from '@/lib/dxf-viewer/dxf-viewer-routes';
import { Link } from '@/lib/workspace/navigation';

export interface OpenInDxfViewerButtonProps {
  /** Το αρχείο σκηνής που προβάλλεται **τώρα** — `null` όταν η τρέχουσα κάτοψη δεν είναι σχέδιο DXF. */
  readonly fileId: string | null;
}

export function OpenInDxfViewerButton({ fileId }: OpenInDxfViewerButtonProps): ReactElement | null {
  const { t } = useTranslation(['files-media']);
  const iconSizes = useIconSizes();
  const levelId = useSceneFileLevelId(fileId);

  if (levelId === null) return null;

  const label = t('files-media:floorplan.openInDxf');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="ghost" size="sm">
          <Link href={dxfViewerLevelHref(levelId)} aria-label={label}>
            <PencilRuler className={iconSizes.sm} aria-hidden="true" />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
