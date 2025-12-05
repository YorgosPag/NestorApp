'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Download } from 'lucide-react';
import { PHOTO_STYLES } from '../config/photo-dimensions';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface Photo {
  id: number;
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
  return (
    <div className="relative group">
      <div className={`aspect-square ${PHOTO_STYLES.PLACEHOLDER} overflow-hidden`}>
        <img
          data-ai-hint={photo.aiHint}
          src={photo.src}
          alt={photo.alt}
          className="w-full h-full object-cover"
        />
      </div>
      <div className={PHOTO_STYLES.HOVER_OVERLAY}>
        <div className={PHOTO_STYLES.OVERLAY_CONTENT}>
          <Button size="sm" variant="secondary">
            <Eye className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="secondary">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className={PHOTO_STYLES.PHOTO_LABEL}>
        {photo.name}
      </div>
    </div>
  );
}

export default PhotoItem;