
'use client';

import React, { useState } from 'react';
import type { Building } from '@/types/building/contracts';
import { type Photo } from '@/components/generic/utils/PhotoItem';
import { EnterprisePhotoUpload } from '@/components/ui/EnterprisePhotoUpload';
import { PhotoItem } from '@/components/generic/utils/PhotoItem';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface PhotosTabContentProps {
  building?: Building;
}

const initialPhotos: Photo[] = [
  {
    id: 1,
    src: 'https://placehold.co/400x400.png',
    alt: 'Building progress',
    name: 'Πρόοδος Φεβ 2025',
    aiHint: 'building construction',
  },
];

const PhotosTabContent = ({ building }: PhotosTabContentProps) => {
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();
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
        alt: currentFile.name,
        name: currentFile.name,
        aiHint: 'newly uploaded',
      };
      setPhotos(prevPhotos => [...prevPhotos, newPhoto]);
      setCurrentFile(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${colors.bg.primary} ${quick.card} p-6`}>
        <h3 className="text-lg font-semibold mb-4">Φωτογραφίες Κτιρίου</h3>
        <EnterprisePhotoUpload
          purpose="photo"
          maxSize={10 * 1024 * 1024} // 10MB για κτίρια
          photoFile={currentFile}
          onFileChange={handleFileChange}
          onUploadComplete={handleUploadComplete}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <PhotoItem key={photo.id} photo={photo} />
        ))}
      </div>
    </div>
  );
};

export default PhotosTabContent;
