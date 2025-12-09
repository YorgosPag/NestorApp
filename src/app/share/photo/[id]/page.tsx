import { Metadata } from 'next';
import Image from 'next/image';

type Props = {
  params: { id: string };
  searchParams: { [key: string]: string | undefined };
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const dataParam = searchParams.data;
  let title = 'Φωτογραφία από Nestor Construct';
  let description = 'Δείτε τη φωτογραφία στο Nestor Construct!';
  let imageUrl = 'https://nestor-app.vercel.app/default-photo.jpg'; // Default fallback

  if (dataParam) {
    try {
      const decodedData = decodeURIComponent(dataParam);
      const data = JSON.parse(decodedData);
      title = data.title || title;
      description = data.description || description;
      imageUrl = data.url || imageUrl;
    } catch (e) {
      console.error('Parse error:', e);
    }
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
      url: `https://nestor-app.vercel.app/share/photo/${params.id}`,
      type: 'article',
      siteName: 'Nestor Construct',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function PhotoSharePage({ params, searchParams }: Props) {
  const dataParam = searchParams.data;
  let photoUrl = 'https://nestor-app.vercel.app/default-photo.jpg'; // Default
  let photoTitle = 'Φωτογραφία';
  let photoDescription = 'Δείτε τη φωτογραφία στο Nestor Construct!';

  if (dataParam) {
    try {
      const decodedData = decodeURIComponent(dataParam);
      const data = JSON.parse(decodedData);
      photoUrl = data.url || photoUrl;
      photoTitle = data.title || photoTitle;
      photoDescription = data.description || photoDescription;
    } catch (e) {
      console.error('Parse error:', e);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-8">
      <h1 className="mb-6 text-3xl font-bold text-center">{photoTitle}</h1>
      <div className="max-w-3xl overflow-hidden rounded-xl shadow-2xl">
        <Image
          src={photoUrl}
          alt={photoTitle}
          width={1200}
          height={630}
          className="w-full object-cover"
          priority
        />
      </div>
      <p className="mt-6 text-center text-gray-600 max-w-md">
        {photoDescription}
      </p>
      <p className="mt-2 text-center text-sm text-gray-500">
        Κοινοποιήθηκε από το <strong>Nestor Construct</strong>
      </p>
    </div>
  );
}