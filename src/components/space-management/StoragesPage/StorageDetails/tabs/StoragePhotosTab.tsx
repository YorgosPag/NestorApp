'use client';

import React, { useState } from 'react';
import type { Storage } from '@/types/storage/contracts';
import { type Photo } from '@/components/generic/utils/PhotoItem';
import { EnterprisePhotoUpload } from '@/components/ui/EnterprisePhotoUpload';
import { PhotoItem } from '@/components/generic/utils/PhotoItem';
import { Camera, Image, Upload, Calendar } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface StoragePhotosTabProps {
  storage: Storage;
}

export function StoragePhotosTab({ storage }: StoragePhotosTabProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  // Γεννάμε πραγματικές φωτογραφίες βάση των στοιχείων της αποθήκης
  const initialPhotos: Photo[] = [
    {
      id: 1,
      src: 'https://placehold.co/400x300/4F46E5/FFFFFF?text=Εξωτερική+Όψη',
      alt: `Εξωτερική όψη αποθήκης ${storage.name}`,
      name: `${storage.name}_Εξωτερική_Όψη.jpg`,
      aiHint: `storage exterior view ${storage.type}`,
    },
    {
      id: 2,
      src: 'https://placehold.co/400x300/059669/FFFFFF?text=Εσωτερικός+Χώρος',
      alt: `Εσωτερικός χώρος αποθήκης ${storage.name}`,
      name: `${storage.name}_Εσωτερικός_Χώρος.jpg`,
      aiHint: `storage interior ${storage.area}sqm ${storage.type}`,
    },
    {
      id: 3,
      src: 'https://placehold.co/400x300/DC2626/FFFFFF?text=Πόρτα+Εισόδου',
      alt: `Πόρτα εισόδου αποθήκης ${storage.name}`,
      name: `${storage.name}_Πόρτα_Εισόδου.jpg`,
      aiHint: `storage entrance door ${storage.building} ${storage.floor}`,
    },
    ...(storage.type === 'large' ? [{
      id: 4,
      src: 'https://placehold.co/400x300/7C2D12/FFFFFF?text=Χώρος+Φόρτωσης',
      alt: `Χώρος φόρτωσης αποθήκης ${storage.name}`,
      name: `${storage.name}_Χώρος_Φόρτωσης.jpg`,
      aiHint: `large storage loading area ${storage.area}sqm`,
    }] : []),
    ...(storage.status === 'occupied' ? [{
      id: 5,
      src: 'https://placehold.co/400x300/1D4ED8/FFFFFF?text=Τρέχουσα+Χρήση',
      alt: `Τρέχουσα χρήση αποθήκης ${storage.name}`,
      name: `${storage.name}_Τρέχουσα_Χρήση_${new Date().getFullYear()}.jpg`,
      aiHint: `occupied storage current use ${storage.area}sqm`,
    }] : []),
    ...(storage.status === 'maintenance' ? [{
      id: 6,
      src: 'https://placehold.co/400x300/EA580C/FFFFFF?text=Εργασίες+Συντήρησης',
      alt: `Εργασίες συντήρησης αποθήκης ${storage.name}`,
      name: `${storage.name}_Συντήρηση_${new Date().toISOString().slice(0, 7)}.jpg`,
      aiHint: `storage maintenance work in progress`,
    }] : []),
  ];

  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const handleFileChange = (file: File | null) => {
    setCurrentFile(file);
  };

  const handleUploadComplete = (result: any) => {
    if (currentFile) {
      // Add the new photo to state
      const newPhoto: Photo = {
        id: Date.now(),
        src: URL.createObjectURL(currentFile),
        alt: `${storage.name} - ${currentFile.name}`,
        name: currentFile.name,
        aiHint: `storage ${storage.name} newly uploaded ${storage.type}`,
      };
      setPhotos(prevPhotos => [...prevPhotos, newPhoto]);
      setCurrentFile(null);
    }
  };

  const photosByCategory = {
    all: photos,
    exterior: photos.filter(p => p.name.includes('Εξωτερική') || p.name.includes('Πόρτα')),
    interior: photos.filter(p => p.name.includes('Εσωτερικός') || p.name.includes('Χρήση')),
    maintenance: photos.filter(p => p.name.includes('Συντήρηση') || p.name.includes('Φόρτωσης'))
  };

  return (
    <div className="space-y-6">
      {/* Στατιστικά Φωτογραφιών */}
      <section className="p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Camera className={iconSizes.md} />
          Επισκόπηση Φωτογραφιών
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{photos.length}</div>
            <div className="text-sm text-muted-foreground">Συνολικές Φωτογραφίες</div>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{photosByCategory.exterior.length}</div>
            <div className="text-sm text-muted-foreground">Εξωτερικές</div>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">{photosByCategory.interior.length}</div>
            <div className="text-sm text-muted-foreground">Εσωτερικές</div>
          </div>
          <div className="bg-card border rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{photosByCategory.maintenance.length}</div>
            <div className="text-sm text-muted-foreground">Συντήρηση</div>
          </div>
        </div>
      </section>

      {/* Upload Περιοχή */}
      <div className={`${colors.bg.primary} rounded-lg border p-6`}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Upload className={iconSizes.md} />
          Φωτογραφίες Αποθήκης {storage.name}
        </h3>
        <div className="mb-4 p-4 bg-accent/50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Αποθήκη:</span>
              <span className="ml-2">{storage.name}</span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Επιφάνεια:</span>
              <span className="ml-2">{storage.area} m²</span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Κατάσταση:</span>
              <span className="ml-2">
                {storage.status === 'available' ? 'Διαθέσιμη' :
                 storage.status === 'occupied' ? 'Κατειλημμένη' :
                 storage.status === 'reserved' ? 'Κρατημένη' :
                 storage.status === 'maintenance' ? 'Συντήρηση' : 'Άγνωστη'}
              </span>
            </div>
          </div>
        </div>

        <EnterprisePhotoUpload
          purpose="photo"
          maxSize={10 * 1024 * 1024} // 10MB για αποθήκες
          photoFile={currentFile}
          onFileChange={handleFileChange}
          onUploadComplete={handleUploadComplete}
        />
      </div>

      {/* Κατηγορίες Φωτογραφιών */}
      <div className="space-y-6">
        {/* Όλες οι Φωτογραφίες */}
        <section>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Image className={iconSizes.md} />
            Όλες οι Φωτογραφίες ({photos.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <PhotoItem key={photo.id} photo={photo} />
            ))}
          </div>
        </section>

        {/* Εξωτερικές Φωτογραφίες */}
        {photosByCategory.exterior.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Image className={`${iconSizes.md} text-blue-600`} />
              Εξωτερικές Φωτογραφίες ({photosByCategory.exterior.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photosByCategory.exterior.map((photo) => (
                <PhotoItem key={photo.id} photo={photo} />
              ))}
            </div>
          </section>
        )}

        {/* Εσωτερικές Φωτογραφίες */}
        {photosByCategory.interior.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Image className={`${iconSizes.md} text-green-600`} />
              Εσωτερικές Φωτογραφίες ({photosByCategory.interior.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photosByCategory.interior.map((photo) => (
                <PhotoItem key={photo.id} photo={photo} />
              ))}
            </div>
          </section>
        )}

        {/* Φωτογραφίες Συντήρησης */}
        {photosByCategory.maintenance.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Image className={`${iconSizes.md} text-orange-600`} />
              Συντήρηση & Εργασίες ({photosByCategory.maintenance.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photosByCategory.maintenance.map((photo) => (
                <PhotoItem key={photo.id} photo={photo} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Πληροφορίες Φωτογραφιών */}
      <section className="bg-card border rounded-lg p-4">
        <h4 className="font-medium mb-3">Πληροφορίες</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div>
            <span className="font-medium">Προτεινόμενες φωτογραφίες:</span>
            <ul className="mt-1 space-y-1 ml-4">
              <li>• Εξωτερική όψη και είσοδος</li>
              <li>• Εσωτερικός χώρος (άδειος)</li>
              <li>• Συστήματα ασφαλείας</li>
            </ul>
          </div>
          <div>
            <span className="font-medium">Τεχνικές προδιαγραφές:</span>
            <ul className="mt-1 space-y-1 ml-4">
              <li>• Μέγιστο μέγεθος: 10MB</li>
              <li>• Υποστηριζόμενοι τύποι: JPG, PNG, WebP</li>
              <li>• Προτεινόμενη ανάλυση: 1920x1080</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}