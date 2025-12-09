'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';

interface PhotoData {
  id: string;
  url: string;
  title: string;
  description: string;
  contact?: { name: string; type: string };
  metadata: { uploadedAt: string; photoType: string };
}

const PhotoSharePage = () => {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const [photoData, setPhotoData] = useState<PhotoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const dataParam = searchParams.get('data');
    if (dataParam) {
      try {
        // Triple decode for heavy encoding
        let decoded = decodeURIComponent(dataParam);
        decoded = decodeURIComponent(decoded);
        decoded = decodeURIComponent(decoded);
        const data = JSON.parse(decoded);
        setPhotoData(data);
      } catch (e) {
        console.error('Parse error:', e);
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
      const ogTags = [
        { property: 'og:title', content: photoData.title },
        { property: 'og:description', content: photoData.description },
        { property: 'og:image', content: photoData.url },
        { property: 'og:url', content: `https://nestor-app.vercel.app/share/photo/${id}` },
        { property: 'og:type', content: 'article' },
        { property: 'og:site_name', content: 'Nestor Construct' },
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

  if (loading) return <div className="flex min-h-screen items-center justify-center">Φόρτωση...</div>;

  if (!photoData) return <div className="flex min-h-screen items-center justify-center">Η φωτογραφία δεν βρέθηκε</div>;

  const { url, title, description } = photoData;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-8">
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
      <p className="mt-6 text-center text-gray-600 max-w-md">
        {description}
      </p>
      <p className="mt-2 text-center text-sm text-gray-500">
        Κοινοποιήθηκε από το <strong>Nestor Construct</strong>
      </p>
    </div>
  );
};

export default PhotoSharePage;