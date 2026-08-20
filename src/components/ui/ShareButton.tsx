'use client';

/**
 * 🏢 ENTERPRISE ShareButton with i18n support
 * ZERO HARDCODED STRINGS - All labels from centralized translations
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { ShareModal, useShareModal } from '@/components/ui/ShareModal';
import { type ShareData } from '@/lib/share-utils';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

export interface ShareButtonProps {
  /** Data to share */
  shareData: ShareData;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Custom className */
  className?: string;
  /** Show text label */
  showLabel?: boolean;
  /** Custom label text */
  label?: string;
  /** Callback when share is successful */
  onShareSuccess?: () => void;
  /** Callback when share fails */
  onShareError?: (error: string) => void;
}

export function ShareButton({
  shareData,
  variant = 'outline',
  size = 'default',
  className,
  showLabel = true,
  label,
  onShareSuccess,
  onShareError,
}: ShareButtonProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation(COMMON_NAMESPACES);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();
  const [justCopied, setJustCopied] = useState(false);
  const { isOpen, openModal, closeModal } = useShareModal();

  const handleButtonClick = () => {
    openModal();
  };

  const handleCopySuccess = () => {
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2000);
    onShareSuccess?.();
  };

  const handleShareSuccess = (_platform: string) => {
    onShareSuccess?.();
    // Keep modal open briefly to show success, then close
    setTimeout(() => closeModal(), 1500);
  };

  const handleShareError = (platform: string, error: string) => {
    onShareError?.(t('share.shareError', { platform, error }));
  };

  const buttonLabel = label || t('share.share');
  const icon = justCopied ? Check : Share2;
  
  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn(
          'transition-all duration-200',
          justCopied && `${colors.text.success} ${quick.success}`,  // ✅ SEMANTIC: text-[hsl(var(--text-success))] -> success
          className
        )}
        onClick={handleButtonClick}
      >
        {React.createElement(icon, { 
          className: cn(
            'transition-all duration-200',
            iconSizes.sm,
            showLabel && 'mr-2'
          )
        })}
        {showLabel && (
          <span className={cn('transition-all duration-200')}>
            {justCopied ? t('share.copied') : buttonLabel}
          </span>
        )}
      </Button>

      <ShareModal
        isOpen={isOpen}
        onClose={closeModal}
        shareData={shareData}
        onCopySuccess={handleCopySuccess}
        onShareSuccess={handleShareSuccess}
        onShareError={handleShareError}
      />
    </>
  );
}

/*
 * 🗑️ ΔΙΑΓΡΑΦΗΚΑΝ (ADR-777 §8.30): `generatePropertyShareText` +
 * `generatePropertyShareUrl` — **μηδέν καλούντες**, μετρημένο σε όλο το `src/`.
 *
 * Δεν ήταν ακίνδυνος νεκρός κώδικας. Το σχόλιο του `/properties/[id]/page.tsx`
 * ονόμαζε το «ShareButton» ως **ζωντανό καταναλωτή** της διαδρομής, και η
 * ανάλυση της ανακατεύθυνσης βασίστηκε πάνω του. Ένα σχόλιο που περιγράφει
 * κώδικα ο οποίος **δεν εκτελείται** είναι χειρότερο από κανένα σχόλιο: διαβάζεται
 * ως μέτρηση.
 *
 * Η πραγματική κοινοποίηση περνά από το `UnifiedShareDialog` (σύνδεσμος με
 * κλειδί, `/shared/<token>`), και τη διατύπωση του κειμένου την κατέχει ήδη το
 * `SharingService.generatePropertyShareText` — που το **δηλώνει** γραπτά
 * («REPLACES: generatePropertyShareText από ShareButton.tsx»).
 */
