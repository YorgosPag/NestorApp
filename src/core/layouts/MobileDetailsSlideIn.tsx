'use client';

import React from 'react';
import { X } from 'lucide-react';
import { componentSizes, canvasUtilities } from '@/styles/design-tokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

interface MobileDetailsSlideInProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  actionButtons?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * 📱 MOBILE DETAILS SLIDE-IN - Κεντρικοποιημένο mobile slide-in pattern
 *
 * ΕΞΑΓΜΕΝΟ από το existing ContactsPageContent pattern (γραμμές 651-704).
 *
 * Χρησιμοποιείται σε:
 * - Contacts (existing)
 * - Projects
 * - Buildings
 * - Units
 *
 * Architecture (από existing pattern):
 * - Fixed inset-0 z-50 overlay
 * - slide-in-from-right animation με duration-300
 * - Minimal header με FIXED HEIGHT 48px
 * - Close button (32x32px) + title + action buttons
 * - Content area με calc(100vh - 48px) height
 */
export function MobileDetailsSlideIn({
  isOpen,
  onClose,
  title,
  actionButtons,
  children
}: MobileDetailsSlideInProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  if (!isOpen) return null;

  return (
    <div className={cn('md:hidden fixed inset-0 z-50 flex flex-col animate-in slide-in-from-right duration-300', colors.bg.primary)}>
      {/* 📱 MINIMAL Mobile header - FIXED HEIGHT (existing pattern) */}
      <div className={cn(canvasUtilities.geoInteractive.mobileSlideHeaderClass, colors.bg.primary)}>
        {/* Close Button (existing pattern) */}
        <button
          onClick={onClose}
          className={cn('p-1 rounded-md', componentSizes.icon.xl)}
        >
          <X className={iconSizes.sm} />
        </button>

        {/* Title (existing pattern) */}
        <h2 className="text-sm font-medium truncate flex-1">
          {title}
        </h2>

        {/* Action Buttons (existing pattern) */}
        {actionButtons && (
          <div className="flex items-center gap-1">
            {actionButtons}
          </div>
        )}
      </div>

      {/* 📱 Content - FULL REMAINING HEIGHT (existing pattern) */}
      <div data-details-sheet="" className={cn(canvasUtilities.geoInteractive.mobileSlideContentClass, colors.bg.primary)}>
        {children}
      </div>
    </div>
  );
}
