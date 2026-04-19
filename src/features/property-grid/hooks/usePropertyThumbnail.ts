'use client';

import { useState, useEffect } from 'react';
import { FileRecordService } from '@/services/file-record.service';
import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import { useCompanyId } from '@/hooks/useCompanyId';

export function usePropertyThumbnail(propertyId: string): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const { companyId } = useCompanyId() ?? {};

  useEffect(() => {
    if (!companyId || !propertyId) return;
    let cancelled = false;

    FileRecordService.getFilesByEntity(ENTITY_TYPES.PROPERTY, propertyId, {
      companyId,
      category: FILE_CATEGORIES.PHOTOS,
    })
      .then(files => {
        if (cancelled) return;
        const first = files.find(f => f.downloadUrl);
        if (first?.downloadUrl) setUrl(first.downloadUrl);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [propertyId, companyId]);

  return url;
}
