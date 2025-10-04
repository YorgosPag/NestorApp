'use client';

import React, { useState } from 'react';
import type { Photo } from './types';
import { UploadZone } from './UploadZone';
import { PhotoGrid } from './PhotoGrid';

const initialPhotos: Photo[] = [
  {
    id: 1,
    src: 'https://placehold.co/400x400.png',
    alt: 'Building progress',
    name: 'Πρόοδος Φεβ 2025',
    aiHint: 'building construction',
  },
];

const PhotosTabContent = () => {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          // Here you would typically add the new photos to your state
          const newPhotos: Photo[] = Array.from(files).map((file, index) => ({
            id: Date.now() + index,
            src: URL.createObjectURL(file), // Create a temporary URL for preview
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
};

export default PhotosTabContent;
