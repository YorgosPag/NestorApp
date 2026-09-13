/* eslint-disable custom/no-hardcoded-strings */
'use client';

/**
 * Photo Share Page Content — Public photo share view
 *
 * @module components/shared/pages/PhotoSharePageContent
 * @enterprise ADR-294 Batch 7 — extracted from app/share/photo/[id]/page.tsx
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { publicUrl } from '@/lib/http/public-origin';
import { PRODUCT_NAME } from '@/constants/product-identity';
import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { safeJsonParse } from '@/lib/json-utils';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';
const logger = createModuleLogger('PhotoSharePage');

interface PhotoData {
  id: string;
  url: string;
  title: string;
  description: string;
  contact?: { name: string; type: string };
  metadata: { uploadedAt: string; photoType: string };
}

export function PhotoSharePageContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const [photoData, setPhotoData] = useState<PhotoData | null>(null);
  const [loading, setLoading] = useState(true);
  const colors = useSemanticColors();
  const { t } = useTranslation(COMMON_NAMESPACES);

  useEffect(() => {
    const dataParam = searchParams.get('data');
    if (dataParam) {
      try {
        // Triple decode for heavy encoding
        let decoded = decodeURIComponent(dataParam);
        decoded = decodeURIComponent(decoded);
        decoded = decodeURIComponent(decoded);
        const data = safeJsonParse<PhotoData>(decoded, null as unknown as PhotoData);
        if (data !== null) {
          setPhotoData(data);
        } else {
          logger.error('Failed to parse photo data JSON');
        }
      } catch (e) {
        logger.error('Parse error', { error: e });
      }
    }
    setLoading(false);
  }, [searchParams]);

  useEffect(() => {
    if (photoData) {
      // Manual OG tags
      const head = document.head;
      // Remove existing
      const existing = head.querySelectorAll('meta[property^="og:"]');
      existing.forEach(tag => tag.remove());
      // Add new
      const shareUrl = publicUrl(`/share/photo/${id}`);
      const ogTags = [
        { property: 'og:title', content: photoData.title },
        { property: 'og:description', content: photoData.description },
        { property: 'og:image', content: photoData.url },
        // ADR-851 Φ5 — από το ΕΝΑ SSoT. Ήταν `NEXT_PUBLIC_BASE_URL` (δεν ορίζεται πουθενά) με
        // εφεδρεία το ΝΕΚΡΟ Vercel: κάθε κοινοποίηση δήλωνε ως κανονική διεύθυνση ένα υποdomain
        // που μπορεί να διεκδικήσει τρίτος. Χωρίς διεύθυνση ⇒ ΚΑΝΕΝΑ `og:url`, ποτέ μαντεμένο.
        ...(shareUrl === null ? [] : [{ property: 'og:url', content: shareUrl }]),
        { property: 'og:type', content: 'article' },
        // ADR-857 Φ7 — **ίδια οικογένεια με το σχόλιο παραπάνω**: η εφεδρεία δήλωνε
        // «Nestor Construct», εταιρεία που δεν αντιστοιχεί σε κανέναν ένοικο. Το
        // `og:site_name` είναι **δεδομένα ενοίκου** (κλάση Γ) και μένει· αλλάζει μόνο
        // η τιμή για όταν δεν υπάρχει ένοικος να ονομάσεις.
        { property: 'og:site_name', content: process.env.NEXT_PUBLIC_COMPANY_NAME || PRODUCT_NAME },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
      ];
      ogTags.forEach(tag => {
        const meta = document.createElement('meta');
        meta.setAttribute('property', tag.property);
        meta.setAttribute('content', tag.content);
        head.appendChild(meta);
      });
      document.title = photoData.title;
    }
  }, [photoData, id]);

  if (loading) return <div className="flex min-h-screen items-center justify-center">{t('loading.message')}</div>;

  if (!photoData) return <div className="flex min-h-screen items-center justify-center">{t('photos.notFound')}</div>;

  const { url, title, description } = photoData;

  return (
    <div className={`flex min-h-screen flex-col items-center justify-center ${colors.bg.secondary} p-8`}>
      <h1 className="mb-6 text-3xl font-bold text-center">{title}</h1>
      <div className="max-w-3xl overflow-hidden rounded-xl shadow-2xl">
        <Image
          src={url}
          alt={title}
          width={1200}
          height={630}
          className="w-full object-cover"
          priority
        />
      </div>
      <p className="mt-6 text-center text-muted-foreground max-w-md">
        {description}
      </p>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Κοινοποιήθηκε από το <strong>{PRODUCT_NAME}</strong>
      </p>
    </div>
  );
}
