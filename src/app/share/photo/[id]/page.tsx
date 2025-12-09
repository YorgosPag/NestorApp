'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Head from 'next/head';

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
        // Double decode for double-encoded data
        const singleDecoded = decodeURIComponent(dataParam);
        const doubleDecoded = decodeURIComponent(singleDecoded);
        const data = JSON.parse(doubleDecoded);
        setPhotoData(data);

        // Add meta tags dynamically for Facebook
        const head = document.head;

        // Remove existing og tags
        const existingOgTags = head.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]');
        existingOgTags.forEach(tag => tag.remove());

        // Add new og tags
        const ogTags = [
          { property: 'og:title', content: data.title || 'Φωτογραφία από Nestor Construct' },
          { property: 'og:description', content: data.description || 'Δείτε τη φωτογραφία στο Nestor Construct!' },
          { property: 'og:image', content: data.url },
          { property: 'og:url', content: `https://nestor-app.vercel.app/share/photo/${id}` },
          { property: 'og:type', content: 'article' },
          { property: 'og:site_name', content: 'Nestor Construct' },
          { property: 'og:image:width', content: '1200' },
          { property: 'og:image:height', content: '630' },
          { name: 'twitter:card', content: 'summary_large_image' },
          { name: 'twitter:title', content: data.title || 'Φωτογραφία από Nestor Construct' },
          { name: 'twitter:description', content: data.description || 'Δείτε τη φωτογραφία στο Nestor Construct!' },
          { name: 'twitter:image', content: data.url }
        ];

        ogTags.forEach(tag => {
          const meta = document.createElement('meta');
          if (tag.property) meta.setAttribute('property', tag.property);
          if (tag.name) meta.setAttribute('name', tag.name);
          meta.setAttribute('content', tag.content);
          head.appendChild(meta);
        });

        // Update title
        document.title = data.title || 'Φωτογραφία από Nestor Construct';

      } catch (e) {
        console.error('Parse error:', e);
      }
    }
    setLoading(false);
  }, [searchParams, id]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Φόρτωση...</div>;
  }

  if (!photoData) {
    return <div className="flex min-h-screen items-center justify-center">Η φωτογραφία δεν βρέθηκε</div>;
  }

  const { url, title, description } = photoData;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
      </Head>
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
    </>
  );
};

export default PhotoSharePage;