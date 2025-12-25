'use client';

import React, { useState } from 'react';
import type { Photo } from './photos/types';
import { EnterprisePhotoUpload } from '@/components/ui/EnterprisePhotoUpload';
// ✅ ENTERPRISE FIX: Using centralized PhotosPreview instead of duplicate PhotoGrid
import { PhotosPreview } from '@/components/generic/utils/PhotosPreview';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import type { FileUploadResult } from '@/hooks/useEnterpriseFileUpload';

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
  const { quick } = useBorderTokens();
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFileChange = (file: File | null) => {
    if (file) {
      setSelectedFiles([file]);
    } else {
      setSelectedFiles([]);
    }
  };

  const handleUploadComplete = (result: FileUploadResult) => {
    if (selectedFiles.length > 0) {
      const newPhotos: Photo[] = selectedFiles.map((file, index) => ({
        id: Date.now() + index,
        src: URL.createObjectURL(file),
        alt: file.name,
        name: file.name,
        aiHint: 'newly uploaded',
      }));
      setPhotos(prevPhotos => [...prevPhotos, ...newPhotos]);
      setSelectedFiles([]);
    }
  };

  // Custom upload handler for multiple files
  const handleMultipleFileUpload = async (file: File, onProgress: (progress: any) => void) => {
    // Simulate upload progress
    return new Promise<FileUploadResult>((resolve) => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 20;
        onProgress({ progress, phase: progress < 100 ? 'upload' : 'complete' });

        if (progress >= 100) {
          clearInterval(interval);
          resolve({
            url: URL.createObjectURL(file),
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type
          });
        }
      }, 200);
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Φωτογραφίες Έργου</h3>
        <EnterprisePhotoUpload
          purpose="photo"
          maxSize={10 * 1024 * 1024} // 10MB
          photoFile={selectedFiles[0] || null}
          onFileChange={handleFileChange}
          onUploadComplete={handleUploadComplete}
          uploadHandler={handleMultipleFileUpload}
          compact={false}
          showProgress={true}
        />
      </div>
      {/* ✅ ENTERPRISE FIX: Simple photo grid using centralized border tokens */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <div key={photo.id} className={`aspect-square bg-muted ${quick.card} overflow-hidden`}>
            <img
              src={photo.src}
              alt={photo.alt}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
