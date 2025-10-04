'use client';

import React, { useState } from 'react';
import type { Photo } from './photos/types';
import { UploadZone } from './photos/UploadZone';
import { PhotoGrid } from './photos/PhotoGrid';

const initialPhotos: Photo[] = [
  {
    id: 1,
    src: 'https://placehold.co/400x400.png',
    alt: 'Project progress photo',
    name: 'Πρόοδος Έργου - Μάρτιος',
    aiHint: 'construction site progress',
  },
   {
    id: 2,
    src: 'https://placehold.co/400x400.png',
    alt: 'Completed facade',
    name: 'Ολοκληρωμένη πρόσοψη',
    aiHint: 'building facade modern',
  },
];

export function PhotosTab() {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          const newPhotos: Photo[] = Array.from(files).map((file, index) => ({
            id: Date.now() + index,
            src: URL.createObjectURL(file),
            alt: file.name,
            name: file.name,
            aiHint: 'newly uploaded',
          }));
          setPhotos(prevPhotos => [...prevPhotos, ...newPhotos]);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  return (
    <div className="space-y-6">
      <UploadZone 
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        onFileUpload={handleFileUpload}
      />
      <PhotoGrid photos={photos} />
    </div>
  );
}
