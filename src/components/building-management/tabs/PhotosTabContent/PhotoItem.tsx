'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Download } from 'lucide-react';
import type { Photo } from './types';

interface PhotoItemProps {
  photo: Photo;
}

export function PhotoItem({ photo }: PhotoItemProps) {
  return (
    <div className="relative group">
      <div className="aspect-square bg-muted rounded-lg overflow-hidden">
        <img 
          data-ai-hint={photo.aiHint}
          src={photo.src}
          alt={photo.alt}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all rounded-lg flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 flex gap-2">
          <Button size="sm" variant="secondary">
            <Eye className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="secondary">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
        {photo.name}
      </div>
    </div>
  );
}
