import type { FileCategory, FileDomain, FileClassification } from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';

export interface PropertyFileMutationPreview {
  readonly title: string;
  readonly description: string;
  readonly variant?: 'default' | 'warning' | 'destructive';
  readonly confirmText?: string;
}

interface PropertyFileMutationPreviewTranslator {
  (key: string, options?: Record<string, unknown>): string;
}

interface BuildPropertyFileDeletePreviewInput {
  readonly category: FileCategory;
  readonly file: FileRecord;
  readonly remainingFiles: readonly FileRecord[];
  readonly t: PropertyFileMutationPreviewTranslator;
}

interface BuildPropertyFileBatchDeletePreviewInput {
  readonly category: FileCategory;
  readonly filesToDelete: readonly FileRecord[];
  readonly remainingFiles: readonly FileRecord[];
  readonly t: PropertyFileMutationPreviewTranslator;
}

interface BuildPropertyFileUnlinkPreviewInput {
  readonly category: FileCategory;
  readonly file: FileRecord;
  readonly t: PropertyFileMutationPreviewTranslator;
}

function isSensitiveFile(file: FileRecord): boolean {
  const classification = file.classification as FileClassification | undefined;
  const domain = file.domain as FileDomain | undefined;

  return classification === 'confidential' || domain === 'legal' || domain === 'accounting' || domain === 'financial';
}

function buildLastFilePreview(
  category: FileCategory,
  t: PropertyFileMutationPreviewTranslator,
): PropertyFileMutationPreview | null {
  switch (category) {
    case 'floorplans':
      return {
        title: t('fileMutationPreview.lastFloorplan.title'),
        description: t('fileMutationPreview.lastFloorplan.description'),
        variant: 'destructive',
        confirmText: t('fileMutationPreview.removeFloorplan'),
      };
    case 'documents':
      return {
        title: t('fileMutationPreview.lastDocument.title'),
        description: t('fileMutationPreview.lastDocument.description'),
        variant: 'destructive',
        confirmText: t('fileMutationPreview.removeDocument'),
      };
    case 'photos':
      return {
        title: t('fileMutationPreview.lastPhoto.title'),
        description: t('fileMutationPreview.lastPhoto.description'),
        variant: 'warning',
        confirmText: t('fileMutationPreview.removePhoto'),
      };
    case 'videos':
      return {
        title: t('fileMutationPreview.lastVideo.title'),
        description: t('fileMutationPreview.lastVideo.description'),
        variant: 'warning',
        confirmText: t('fileMutationPreview.removeVideo'),
      };
    default:
      return null;
  }
}

function buildSensitiveFilePreview(
  file: FileRecord,
  t: PropertyFileMutationPreviewTranslator,
): PropertyFileMutationPreview {
  return {
    title: t('fileMutationPreview.sensitive.title'),
    description: t('fileMutationPreview.sensitive.description', { displayName: file.displayName }),
    variant: 'destructive',
    confirmText: t('fileMutationPreview.removeFile'),
  };
}

export function buildPropertyFileDeletePreview({
  category,
  file,
  remainingFiles,
  t,
}: BuildPropertyFileDeletePreviewInput): PropertyFileMutationPreview | null {
  if (remainingFiles.length === 0) {
    return buildLastFilePreview(category, t);
  }

  if (isSensitiveFile(file)) {
    return buildSensitiveFilePreview(file, t);
  }

  return null;
}

export function buildPropertyFileBatchDeletePreview({
  category,
  filesToDelete,
  remainingFiles,
  t,
}: BuildPropertyFileBatchDeletePreviewInput): PropertyFileMutationPreview | null {
  if (filesToDelete.length === 0) {
    return null;
  }

  if (remainingFiles.length === 0) {
    const lastFilePreview = buildLastFilePreview(category, t);
    if (lastFilePreview) {
      return {
        ...lastFilePreview,
        description: t('fileMutationPreview.batchLast.description', { category }),
        confirmText: t('fileMutationPreview.removeFiles'),
      };
    }
  }

  const sensitiveCount = filesToDelete.filter(isSensitiveFile).length;
  if (sensitiveCount > 0) {
    return {
      title: t('fileMutationPreview.batchSensitive.title'),
      description: t('fileMutationPreview.batchSensitive.description', { count: sensitiveCount }),
      variant: 'destructive',
      confirmText: t('fileMutationPreview.removeFiles'),
    };
  }

  return null;
}

export function buildPropertyFileUnlinkPreview({
  category,
  file,
  t,
}: BuildPropertyFileUnlinkPreviewInput): PropertyFileMutationPreview | null {
  if (category === 'floorplans' || category === 'documents' || isSensitiveFile(file)) {
    return {
      title: t('fileMutationPreview.unlink.title'),
      description: t('fileMutationPreview.unlink.description', { displayName: file.displayName }),
      variant: 'warning',
      confirmText: t('fileMutationPreview.unlinkFile'),
    };
  }

  return null;
}
