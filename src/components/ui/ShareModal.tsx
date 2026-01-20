// ============================================================================
// 🔗 SHARE MODAL COMPONENT - ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΗ ENTERPRISE ARCHITECTURE
// ============================================================================
//
// 🎯 PURPOSE: Refactored share modal με centralized components & design system
// 🔗 USES: SharePlatformGrid, EmailShareForm, CopyActionsSection
// 🏢 STANDARDS: Enterprise modular architecture, centralized design system
//
// ============================================================================

'use client';

import React from 'react';
import { Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { designSystem } from '@/lib/design-system';
import { getSocialShareUrls, getPhotoSocialShareUrls, trackShareEvent } from '@/lib/share-utils';
// 🏢 ENTERPRISE: Centralized API client with automatic authentication
import { apiClient } from '@/lib/api/enterprise-api-client';

// 🏢 ENTERPRISE: Import centralized components
import { SharePlatformGrid } from '@/components/ui/social-sharing/SharePlatformGrid';
import { EmailShareForm } from '@/components/ui/email-sharing/EmailShareForm';
import { CopyActionsSection } from '@/components/ui/social-sharing/CopyActionsSection';
import type { ShareData, EmailShareData } from '@/components/ui/email-sharing/EmailShareForm';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareData: ShareData & {
    isPhoto?: boolean;
  };
  onCopySuccess?: () => void;
  onShareSuccess?: (platform: string) => void;
  onShareError?: (platform: string, error: string) => void;
}

// ============================================================================
// ENTERPRISE SHARE MODAL COMPONENT
// ============================================================================

export function ShareModal({
  isOpen,
  onClose,
  shareData,
  onCopySuccess,
  onShareSuccess,
  onShareError
}: ShareModalProps) {
  // ============================================================================
  // STATE MANAGEMENT - Simplified με κεντρικοποιημένα components
  // ============================================================================

  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const [showEmailForm, setShowEmailForm] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setShowEmailForm(false);
      setLoading(false);
    }
  }, [isOpen]);

  // ============================================================================
  // PHOTO DETECTION & URL HANDLING
  // ============================================================================

  const isDirectPhotoUrl = shareData.url.includes('firebasestorage.googleapis.com') ||
                           shareData.url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
  const isWebpagePhotoShare = shareData.isPhoto && shareData.url.includes('/share/photo/');
  const socialUrls = isDirectPhotoUrl && !isWebpagePhotoShare
    ? getPhotoSocialShareUrls(shareData.url, shareData.text || shareData.title)
    : getSocialShareUrls(shareData.url, shareData.text || shareData.title);

  // ============================================================================
  // PLATFORM SHARING HANDLERS
  // ============================================================================

  /**
   * 🔗 Handle Platform Share με enhanced logic
   */
  const handlePlatformShare = async (platformId: string) => {
    if (platformId === 'email') {
      setShowEmailForm(true);
      return;
    }

    setLoading(true);
    onClose();

    try {
      let url = socialUrls[platformId as keyof typeof socialUrls];

      // Special Facebook handling για photos
      if (platformId === 'facebook' && shareData.url.includes('/share/photo/')) {
        const urlObj = new URL(shareData.url);
        const dataParam = urlObj.searchParams.get('data');

        if (dataParam) {
          try {
            const singleDecoded = decodeURIComponent(dataParam);
            const doubleDecoded = decodeURIComponent(singleDecoded);
            const data = JSON.parse(doubleDecoded);
            const directUrl = data.url.replace(/\?alt=media&token=.*$/, '?alt=media');
            url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(directUrl)}&quote=${encodeURIComponent(shareData.title + '\n' + shareData.text)}`;
          } catch (e) {
            console.error('Error parsing data for Facebook:', e);
            url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`;
          }
        } else {
          url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`;
        }
      }

      if (url) {
        // Enhanced sharing logic
        if (isDirectPhotoUrl && !isWebpagePhotoShare) {
          if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
            window.location.href = url;
          } else {
            const shareWindow = window.open(url, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes,noopener=yes,noreferrer=yes');
            if (!shareWindow) {
              await navigator.clipboard.writeText(url);
            }
          }
        } else {
          if (navigator.share && platformId !== 'facebook' && platformId !== 'twitter' && platformId !== 'linkedin') {
            try {
              await navigator.share({
                title: shareData.title,
                text: shareData.text,
                url: shareData.url,
              });
            } catch (shareError) {
              const shareWindow = window.open(url, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes,noopener=yes,noreferrer=yes');
              if (!shareWindow) {
                await navigator.clipboard.writeText(url);
              }
            }
          } else {
            const shareWindow = window.open(url, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes,noopener=yes,noreferrer=yes');
            if (!shareWindow) {
              await navigator.clipboard.writeText(url);
            }
          }
        }

        trackShareEvent(platformId, 'property', shareData.url);
        setTimeout(() => {
          onShareSuccess?.(platformId);
        }, 1500);
      }
    } catch (error) {
      onShareError?.(platformId, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 📧 Handle Email Share με centralized EmailShareForm
   */
  const handleEmailShare = async (emailData: EmailShareData) => {
    setLoading(true);

    try {
      // 🏢 ENTERPRISE: Use centralized API client with automatic authentication
      interface PropertyShareEmailResponse {
        success: boolean;
        error?: string;
      }

      await apiClient.post<PropertyShareEmailResponse>('/api/communications/email/property-share/', emailData);

      onShareSuccess?.(`email (${emailData.recipients.length} recipients, ${emailData.templateType} template)`);
      setShowEmailForm(false);
      onClose();

    } catch (error) {
      throw error; // Let EmailShareForm handle the error
    } finally {
      setLoading(false);
    }
  };

  /**
   * 📋 Handle Copy Success
   */
  const handleCopySuccess = (type: 'url' | 'text') => {
    onCopySuccess?.();
  };

  /**
   * 🚨 Handle Copy Error
   */
  const handleCopyError = (type: 'url' | 'text', error: string) => {
    console.error(`Failed to copy ${type}:`, error);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={designSystem.cn(
        "sm:max-w-lg backdrop-blur-xl border-0 shadow-2xl",
        designSystem.colorScheme.responsive.card
      )}>

        {/* HEADER με Design System */}
        <DialogHeader className="text-center space-y-3" role="banner">
          <figure className={designSystem.cn(
            `mx-auto ${iconSizes['2xl']} rounded-full flex items-center justify-center`,
            designSystem.getStatusColor('info', 'bg')
          )} role="img" aria-label="Share Icon">
            <Share2 className={`${iconSizes.lg} ${colors.text.inverse}`} />
          </figure>

          <DialogTitle className={designSystem.cn(
            designSystem.presets.text.title,
            "bg-gradient-to-r bg-clip-text text-transparent",
            "from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400"
          )}>
            Κοινοποίηση Ακινήτου
          </DialogTitle>

          <p className={designSystem.cn(
            designSystem.presets.text.muted,
            "leading-relaxed"
          )}>
            {shareData.title}
          </p>
        </DialogHeader>

        {/* CONTENT με Centralized Components */}
        <main className="space-y-6 py-4" role="main">
          {!showEmailForm ? (
            <>
              {/* 🏢 ENTERPRISE: Centralized Platform Grid */}
              <SharePlatformGrid
                onPlatformSelect={handlePlatformShare}
                loading={loading}
                gridConfig={{
                  columns: 3,
                  buttonVariant: 'default',
                  iconSize: 'md',
                  showLabels: true,
                  spacing: 'normal'
                }}
              />

              {/* 🏢 ENTERPRISE: Centralized Copy Actions */}
              <CopyActionsSection
                copyData={shareData}
                onCopySuccess={handleCopySuccess}
                onCopyError={handleCopyError}
                loading={loading}
              />
            </>
          ) : (
            /* 🏢 ENTERPRISE: Centralized Email Form */
            <EmailShareForm
              shareData={shareData}
              onEmailShare={handleEmailShare}
              onBack={() => setShowEmailForm(false)}
              loading={loading}
            />
          )}
        </main>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// CUSTOM HOOK - useShareModal
// ============================================================================

/**
 * ✅ ENTERPRISE: Custom hook για share modal state management
 * 🎯 PURPOSE: Centralized modal state με proper TypeScript types
 */
export function useShareModal() {
  const [isOpen, setIsOpen] = React.useState(false);

  const openModal = React.useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeModal = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    openModal,
    closeModal,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ShareModal;