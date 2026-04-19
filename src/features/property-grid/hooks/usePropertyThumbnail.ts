'use client';

import { useState, useEffect } from 'react';

export function usePropertyThumbnail(propertyId: string): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/properties/${propertyId}/photos`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data?.data?.photos?.[0]?.url) {
          setUrl(data.data.photos[0].url);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [propertyId]);

  return url;
}
