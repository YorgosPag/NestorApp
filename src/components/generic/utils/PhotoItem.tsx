'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Download } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import {
  PHOTO_COLORS,
  PHOTO_COMBINED_EFFECTS,
  PHOTO_TEXT_COLORS
} from '../config/photo-config';
import { GROUP_HOVER_PATTERNS } from '@/components/ui/effects';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface Photo {
  id: string;
  src: string;
  alt: string;
  name: string;
  aiHint?: string;
}

export interface PhotoItemProps {
  photo: Photo;
}

// ============================================================================
// 🔥 UNIFIED PHOTO ITEM COMPONENT
// ============================================================================

/**
 * UNIFIED Photo Item Component
 *
 * Εξαλείφει τα διπλότυπα από:
 * - src/components/projects/photos/PhotoItem.tsx ❌
 * - src/components/building-management/tabs/PhotosTabContent/PhotoItem.tsx ❌
 *
 * Single component για όλα τα photo item displays με:
 * - Consistent styling και hover effects
 * - Unified Photo interface
 * - Eye και Download action buttons
 * - Photo name overlay
 * - Zero code duplication
 *
 * Features:
 * - Aspect square layout με responsive design
 * - Group hover effects με opacity transitions
 * - Action buttons (Eye, Download) with secondary variant
 * - Photo name badge με semi-transparent background
 * - AI hint support για accessibility
 */
export function PhotoItem({ photo }: PhotoItemProps) {
  const iconSizes = useIconSizes();

  return (
    <div className="relative group">
      <div className={`aspect-square ${PHOTO_COLORS.PHOTO_BACKGROUND} rounded overflow-hidden shadow-sm ${PHOTO_COMBINED_EFFECTS.INTERACTIVE_CARD}`}>
        <img
          data-ai-hint={photo.aiHint}
          src={photo.src}
          alt={photo.alt}
          className="w-full h-full object-cover"
        />
      </div>
      <div className={`absolute inset-0 bg-black bg-opacity-0 transition-all duration-300 ease-in-out flex items-center justify-center opacity-0 ${GROUP_HOVER_PATTERNS.OVERLAY_ON_GROUP}`}>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary">
            <Eye className={iconSizes.sm} />
          </Button>
          <Button size="sm" variant="secondary">
            <Download className={iconSizes.sm} />
          </Button>
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 right-0 ${PHOTO_COLORS.PHOTO_BACKGROUND} bg-opacity-75 p-2 ${PHOTO_TEXT_COLORS.FOREGROUND} text-sm font-medium`}>
        {photo.name}
      </div>
    </div>
  );
}

export default PhotoItem;