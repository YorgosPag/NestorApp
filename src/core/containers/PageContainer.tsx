'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

/**
 * 🏢 ENTERPRISE PAGE CONTAINER COMPONENT
 *
 * Κεντρικοποιημένο container για όλες τις σελίδες της εφαρμογής.
 * Παρέχει semantic HTML (<main>) και consistent styling.
 *
 * Pattern που κεντρικοποιείται:
 * <main className={`h-full flex flex-col overflow-hidden ${colors.bg.primary}`}>
 *
 * 🔒 OVERFLOW BEHAVIOR:
 * - Default: overflow-hidden (scroll γίνεται μέσα στα inner components)
 * - Το ListContainer και ScrollArea χειρίζονται το internal scrolling
 * - Αυτό εξασφαλίζει ταυτόσιμη συμπεριφορά σε όλα τα pages
 *
 * Χρησιμοποιείται από:
 * - ContactsPageContent
 * - BuildingsPageContent
 * - ProjectsPageContent
 * - Units page
 * - Parking page
 * - Storage page
 *
 * @example
 * <PageContainer ariaLabel="Διαχείριση Επαφών">
 *   {children}
 * </PageContainer>
 */

export interface PageContainerProps {
  /** Περιεχόμενο της σελίδας */
  children: React.ReactNode;
  /** Aria label για accessibility - περιγραφή της σελίδας */
  ariaLabel?: string;
  /** Custom className για επέκταση του styling */
  className?: string;
  /** Εάν true, χρησιμοποιεί h-screen αντί για h-full (default: false) */
  fullScreen?: boolean;
}

export function PageContainer({
  children,
  ariaLabel,
  className,
  fullScreen = false,
}: PageContainerProps) {
  const colors = useSemanticColors();

  const heightClass = fullScreen ? 'h-screen' : 'h-full';

  return (
    <section
      className={cn(
        heightClass,
        'flex flex-col',
        'overflow-hidden', // 🔒 CENTRALIZED: Prevents page-level scroll, inner components handle scrolling
        colors.bg.primary,
        className
      )}
      aria-label={ariaLabel}
    >
      {children}
    </section>
  );
}
