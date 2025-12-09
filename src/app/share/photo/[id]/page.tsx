import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface PhotoShareData {
  id: string;
  url: string;
  title: string;
  description?: string;
  contact?: {
    name: string;
    type: 'individual' | 'company' | 'service';
  };
  metadata?: {
    uploadedAt: string;
    size?: number;
    dimensions?: { width: number; height: number };
    photoType?: string;
  };
}

// ============================================================================
// SERVER-SIDE METADATA GENERATION
// ============================================================================

/**
 * Decode photo share data from URL parameters (server-side compatible)
 */
function decodePhotoDataFromParams(searchParams: { [key: string]: string | undefined }): PhotoShareData | null {
  try {
    const encodedData = searchParams.data;
    if (encodedData) {
      const decodedData = JSON.parse(decodeURIComponent(encodedData));
      return decodedData;
    }
    return null;
  } catch (error) {
    console.error('Error decoding photo data from params:', error);
    return null;
  }
}

/**
 * Generate metadata for Facebook/Twitter scrapers (server-side)
 */
export async function generateMetadata({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams: { [key: string]: string | undefined }
}): Promise<Metadata> {
  // Try to decode photo data from URL params
  const photoData = decodePhotoDataFromParams(searchParams);

  // Default values
  const title = photoData?.title || '📸 Φωτογραφία από Nestor Construct';
  const description = photoData?.description || 'Δείτε αυτή την όμορφη φωτογραφία στο Nestor Construct!';
  const imageUrl = photoData?.url || '/favicon.ico'; // Fallback to favicon

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: imageUrl,
          width: photoData?.metadata?.dimensions?.width || 1200,
          height: photoData?.metadata?.dimensions?.height || 630,
          alt: title,
        },
      ],
      type: 'article',
      siteName: 'Nestor Construct',
      url: `/share/photo/${params.id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
      site: '@NestorConstruct',
    },
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Decode photo share data from URL parameters or localStorage (client-side)
 */
function decodePhotoData(photoId: string, searchParams: URLSearchParams): PhotoShareData | null {
  try {
    // First try URL search params
    const encodedData = searchParams.get('data');
    if (encodedData) {
      const decodedData = JSON.parse(decodeURIComponent(encodedData));
      return decodedData;
    }

    // Fallback: Try to reconstruct from localStorage or sessionStorage
    if (typeof window !== 'undefined') {
      const localData = localStorage.getItem(`photo_share_${photoId}`);
      if (localData) {
        return JSON.parse(localData);
      }

      const sessionData = sessionStorage.getItem(`photo_share_${photoId}`);
      if (sessionData) {
        return JSON.parse(sessionData);
      }

      // Last resort: Basic data from photoId (if it contains info)
      if (photoId.includes('_')) {
        const parts = photoId.split('_');
        return {
          id: photoId,
          url: '', // Will be set by parent
          title: `📸 ${decodeURIComponent(parts[0] || 'Φωτογραφία')}`,
          description: 'Δείτε τη φωτογραφία στο Nestor Construct!'
        };
      }
    }

    // Default fallback
    return {
      id: photoId,
      url: '',
      title: '📸 Φωτογραφία από Nestor Construct',
      description: 'Δείτε την εκπληκτική φωτογραφία μας!'
    };
  } catch (error) {
    console.error('Error decoding photo data:', error);
    return null;
  }
}

// ============================================================================
// CLIENT COMPONENT
// ============================================================================

function PhotoSharePageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const photoId = params?.id as string;

  const [photoData, setPhotoData] = useState<PhotoShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!photoId) {
      setError('Invalid photo ID');
      setLoading(false);
      return;
    }

    try {
      const decoded = decodePhotoData(photoId, searchParams);
      if (!decoded) {
        setError('Could not load photo data');
        setLoading(false);
        return;
      }

      // If no URL in decoded data, try to reconstruct Firebase URL from ID
      if (!decoded.url && photoId) {
        // This is a simplified approach - you might need to adjust based on your Firebase structure
        const baseFirebaseUrl = 'https://firebasestorage.googleapis.com/v0/b/pagonis-87766.firebasestorage.app/o/contacts%2Fphotos%2F';
        decoded.url = `${baseFirebaseUrl}${encodeURIComponent(photoId)}.jpg?alt=media`;
      }

      setPhotoData(decoded);

    } catch (err) {
      console.error('Error loading photo:', err);
      setError('Failed to load photo');
    } finally {
      setLoading(false);
    }
  }, [photoId, searchParams]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Φόρτωση φωτογραφίας...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !photoData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-6xl mb-4">📸</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Η φωτογραφία δεν βρέθηκε
          </h1>
          <p className="text-gray-600 mb-6">
            {error || 'Δεν ήταν δυνατή η φόρτωση της φωτογραφίας.'}
          </p>
          <Link href="/">
            <Button className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Επιστροφή στην Αρχική
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Nestor Construct
                </Button>
              </Link>
              <div className="text-gray-300">•</div>
              <h1 className="text-lg font-semibold text-gray-800">
                Κοινοποίηση Φωτογραφίας
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {photoData.url && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.open(photoData.url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                  Άνοιγμα Φωτογραφίας
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Photo Display */}
          <div className="aspect-video bg-gray-100 relative">
            {photoData.url ? (
              <Image
                src={photoData.url}
                alt={photoData.title}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                priority
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-6xl mb-4">📸</div>
                  <p className="text-gray-500">Η φωτογραφία φορτώνεται...</p>
                </div>
              </div>
            )}
          </div>

          {/* Photo Info */}
          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {photoData.title}
            </h2>

            {photoData.description && (
              <p className="text-gray-600 mb-4">
                {photoData.description}
              </p>
            )}

            {photoData.contact && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">
                  Σχετικό Άτομο:
                </h3>
                <p className="text-gray-800">{photoData.contact.name}</p>
                <p className="text-sm text-gray-500 capitalize">
                  {photoData.contact.type === 'individual' ? 'Άτομο' :
                   photoData.contact.type === 'company' ? 'Εταιρεία' : 'Υπηρεσία'}
                </p>
              </div>
            )}

            {photoData.metadata && (
              <div className="text-sm text-gray-500 space-y-1">
                {photoData.metadata.uploadedAt && (
                  <p>
                    <strong>Ημερομηνία:</strong> {new Date(photoData.metadata.uploadedAt).toLocaleDateString('el-GR')}
                  </p>
                )}
                {photoData.metadata.dimensions && (
                  <p>
                    <strong>Διαστάσεις:</strong> {photoData.metadata.dimensions.width} × {photoData.metadata.dimensions.height} pixels
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-8 text-center">
          <Link href="/">
            <Button className="gap-2" size="lg">
              <ExternalLink className="w-5 h-5" />
              Δείτε Περισσότερα στο Nestor Construct
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-500">
            <p>© {new Date().getFullYear()} Nestor Construct. Όλα τα δικαιώματα διατηρούνται.</p>
            <p className="text-sm mt-1">
              Επισκεφθείτε μας στο{' '}
              <Link href="/" className="text-blue-600 hover:underline">
                nestor-construct.gr
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT WITH SUSPENSE
// ============================================================================

export default function PhotoSharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Φόρτωση φωτογραφίας...</p>
        </div>
      </div>
    }>
      <PhotoSharePageContent />
    </Suspense>
  );
}