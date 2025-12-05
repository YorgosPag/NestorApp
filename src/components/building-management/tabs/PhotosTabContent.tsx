
'use client';

import React, { useState } from 'react';
import type { Building } from '@/types/building/contracts';
import { type Photo } from '@/components/generic/utils/PhotoItem';
import { EnterprisePhotoUpload } from '@/components/ui/EnterprisePhotoUpload';
import { PhotoGrid } from './PhotosTabContent/PhotoGrid';

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
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Φωτογραφίες Κτιρίου</h3>
        <EnterprisePhotoUpload
          purpose="photo"
          maxSize={10 * 1024 * 1024} // 10MB για κτίρια
          photoFile={currentFile}
          onFileChange={handleFileChange}
          onUploadComplete={handleUploadComplete}
        />
      </div>
      <PhotoGrid photos={photos} />
    </div>
  );
};

export default PhotosTabContent;
