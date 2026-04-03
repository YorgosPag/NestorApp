import type { FileCategory, FileDomain, FileClassification } from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';

export interface PropertyFileMutationPreview {
  readonly title: string;
  readonly description: string;
  readonly variant?: 'default' | 'warning' | 'destructive';
  readonly confirmText?: string;
}

interface PropertyFileMutationPreviewTranslator {
  (key: string, options?: { defaultValue?: string }): string;
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
        title: t('fileMutationPreview.lastFloorplan.title', { defaultValue: 'Confirm last floorplan removal' }),
        description: t('fileMutationPreview.lastFloorplan.description', {
          defaultValue: 'This will remove the last floorplan linked to the property. Floorplan coverage and downstream floorplan workflows will be affected.',
        }),
        variant: 'destructive',
        confirmText: t('fileMutationPreview.confirmDelete', { defaultValue: 'Remove floorplan' }),
      };
    case 'documents':
      return {
        title: t('fileMutationPreview.lastDocument.title', { defaultValue: 'Confirm last document removal' }),
        description: t('fileMutationPreview.lastDocument.description', {
          defaultValue: 'This will remove the last document linked to the property. Documentation completeness and downstream review workflows will be affected.',
        }),
        variant: 'destructive',
        confirmText: t('fileMutationPreview.confirmDelete', { defaultValue: 'Remove document' }),
      };
    case 'photos':
      return {
        title: t('fileMutationPreview.lastPhoto.title', { defaultValue: 'Confirm last photo removal' }),
        description: t('fileMutationPreview.lastPhoto.description', {
          defaultValue: 'This will remove the last photo linked to the property. Media coverage for the property will drop to zero.',
        }),
        variant: 'warning',
        confirmText: t('fileMutationPreview.confirmDelete', { defaultValue: 'Remove photo' }),
      };
    case 'videos':
      return {
        title: t('fileMutationPreview.lastVideo.title', { defaultValue: 'Confirm last video removal' }),
        description: t('fileMutationPreview.lastVideo.description', {
          defaultValue: 'This will remove the last video linked to the property. Confirm that this media removal is intentional.',
        }),
        variant: 'warning',
        confirmText: t('fileMutationPreview.confirmDelete', { defaultValue: 'Remove video' }),
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
    title: t('fileMutationPreview.sensitive.title', { defaultValue: 'Confirm sensitive file removal' }),
    description: t('fileMutationPreview.sensitive.description', {
      defaultValue: `The file "${file.displayName}" is classified as sensitive or belongs to a regulated domain. Removing it may affect legal, accounting, or compliance workflows.`,
    }),
    variant: 'destructive',
    confirmText: t('fileMutationPreview.confirmDelete', { defaultValue: 'Remove file' }),
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
        description: t('fileMutationPreview.batchLast.description', {
          defaultValue: `This batch action will remove all remaining ${category} files linked to the property.`,
        }),
        confirmText: t('fileMutationPreview.confirmBatchDelete', { defaultValue: 'Remove files' }),
      };
    }
  }

  const sensitiveCount = filesToDelete.filter(isSensitiveFile).length;
  if (sensitiveCount > 0) {
    return {
      title: t('fileMutationPreview.batchSensitive.title', { defaultValue: 'Confirm sensitive batch removal' }),
      description: t('fileMutationPreview.batchSensitive.description', {
        defaultValue: `This batch action includes ${sensitiveCount} sensitive or regulated files. Confirm that this removal is intentional.`,
      }),
      variant: 'destructive',
      confirmText: t('fileMutationPreview.confirmBatchDelete', { defaultValue: 'Remove files' }),
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
      title: t('fileMutationPreview.unlink.title', { defaultValue: 'Confirm file unlink' }),
      description: t('fileMutationPreview.unlink.description', {
        defaultValue: `Unlinking "${file.displayName}" removes it from this property without deleting the underlying file. Confirm that the property should lose access to it.`,
      }),
      variant: 'warning',
      confirmText: t('fileMutationPreview.confirmUnlink', { defaultValue: 'Unlink file' }),
    };
  }

  return null;
}
