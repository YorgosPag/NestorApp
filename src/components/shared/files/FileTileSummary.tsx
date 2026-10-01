/**
 * @fileoverview **Η περίληψη ενός αρχείου σε πλακίδιο**: μικρογραφία, όνομα, μέγεθος.
 * @module components/shared/files/FileTileSummary
 *
 * Ζούσε δύο φορές, με τις ίδιες κλάσεις: στην κάρτα της γκαλερί του διαχειριστή αρχείων
 * (`file-manager/FileManagerPageContent`) και στην γκαλερί των αρχείων οντότητας
 * (`EntityFilesContent`). Το CHECK 3.28 το μέτρησε ως κλώνο 10 γραμμών όταν και τα δύο
 * πέρασαν στον ΕΝΑ αναγνώστη εμφάνισης (ADR-899 §4.1). Το κέλυφος (κάρτα, κλικ, σήματα)
 * μένει στον καλούντα· εδώ μόνο το περιεχόμενο.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatFileSize } from '@/utils/file-validation';
import type { FileRecord } from '@/types/file-record';
import { FileThumbnail } from './FileThumbnail';

interface FileTileSummaryProps {
  readonly file: FileRecord;
}

export function FileTileSummary({ file }: FileTileSummaryProps) {
  const colors = useSemanticColors();
  return (
    <>
      <FileThumbnail file={file} displayName={file.displayName || ''} size="md" />
      <p className="text-sm font-medium truncate w-full">
        {file.displayName || file.originalFilename}
      </p>
      <p className={cn('text-xs', colors.text.muted)}>
        {formatFileSize(file.sizeBytes || 0)}
      </p>
    </>
  );
}
