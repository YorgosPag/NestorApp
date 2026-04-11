/**
 * =============================================================================
 * 🏢 ENTERPRISE: PlatformShareController — User-Auth Platform Share Logic
 * =============================================================================
 *
 * Extracted hook that owns the platform-share handler + photo-picker confirm
 * logic from the legacy ShareModal. Keeps UserAuthPermissionPanel focused on
 * view switching and splits the 100-line handler into smaller functions
 * (SOS N.7.1 compliance).
 *
 * @module components/ui/sharing/panels/user-auth/PlatformShareController
 * @see ADR-147 Unified Share Surface (Phase B)
 */

'use client';

import { useCallback } from 'react';
import { safeJsonParse } from '@/lib/json-utils';
import {
  copyImageToClipboard,
  getPhotoSocialShareUrls,
  getSocialShareUrls,
  trackShareEvent,
} from '@/lib/share-utils';
import { createModuleLogger } from '@/lib/telemetry';
import type { ShareData } from '@/components/ui/email-sharing/EmailShareForm';

const logger = createModuleLogger('PlatformShareController');

const APP_PLATFORMS = new Set(['messenger', 'telegram', 'instagram', 'whatsapp']);
const PLATFORM_NAMES: Record<string, string> = {
  telegram: 'Telegram',
  messenger: 'Messenger',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
};

function appDeepLink(platformId: string, url: string, caption: string): string | undefined {
  const map: Record<string, string> = {
    telegram: `tg://msg_url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(caption)}`,
    whatsapp: 'https://web.whatsapp.com/',
    instagram: 'https://www.instagram.com/direct/new/',
    messenger: 'https://www.messenger.com/new',
  };
  return map[platformId];
}

function openAppWindow(platformId: string, url: string | undefined): void {
  if (!url) return;
  if (platformId === 'telegram') {
    window.location.href = url;
  } else {
    window.open(
      url,
      '_blank',
      'width=600,height=500,scrollbars=yes,resizable=yes,noopener=yes,noreferrer=yes',
    );
  }
}

async function copyCaptionOrImage(photoUrl: string | null, caption: string): Promise<void> {
  if (photoUrl) {
    const ok = await copyImageToClipboard(photoUrl);
    if (!ok) await navigator.clipboard.writeText(caption);
    return;
  }
  await navigator.clipboard.writeText(caption);
}

function resolveFacebookUrl(shareData: ShareData): string {
  if (!shareData.url.includes('/share/photo/')) {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`;
  }
  try {
    const urlObj = new URL(shareData.url);
    const dataParam = urlObj.searchParams.get('data');
    if (!dataParam) throw new Error('no data param');
    const doubleDecoded = decodeURIComponent(decodeURIComponent(dataParam));
    const parsed = safeJsonParse<{ url: string }>(doubleDecoded, null as unknown as { url: string });
    if (parsed === null) throw new Error('parse failed');
    const directUrl = parsed.url.replace(/\?alt=media&token=.*$/, '?alt=media');
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(directUrl)}&quote=${encodeURIComponent(shareData.title + '\n' + shareData.text)}`;
  } catch (err) {
    logger.error('Error resolving Facebook share url', { error: err });
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareData.url)}`;
  }
}

export interface PlatformShareControllerOptions {
  shareData: ShareData & { isPhoto?: boolean };
  effectivePhotoUrl: string | null;
  onEmailRequest: () => void;
  onPhotoPickerRequest: (platformId: string, initialPhoto: string) => void;
  onClose: () => void;
  onShareSuccess?: (platform: string) => void;
  onShareError?: (platform: string, error: string) => void;
  setLoading: (loading: boolean) => void;
  notifyPhotoCopied: (platformName: string) => void;
}

export interface PlatformShareController {
  handlePlatformShare: (platformId: string) => Promise<void>;
  handlePhotoPickerConfirm: (platformId: string, photo: string, caption: string) => Promise<void>;
}

export function usePlatformShareController(
  options: PlatformShareControllerOptions,
): PlatformShareController {
  const {
    shareData,
    effectivePhotoUrl,
    onEmailRequest,
    onPhotoPickerRequest,
    onClose,
    onShareSuccess,
    onShareError,
    setLoading,
    notifyPhotoCopied,
  } = options;

  const isDirectPhotoUrl =
    shareData.url.includes('firebasestorage.googleapis.com') ||
    /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(shareData.url);

  const socialUrls = effectivePhotoUrl
    ? getPhotoSocialShareUrls(effectivePhotoUrl, shareData.text || shareData.title, shareData.url)
    : isDirectPhotoUrl
      ? getPhotoSocialShareUrls(shareData.url, shareData.text || shareData.title)
      : getSocialShareUrls(shareData.url, shareData.text || shareData.title);

  const shareToAppDirect = useCallback(
    async (platformId: string): Promise<void> => {
      const photoUrl = effectivePhotoUrl ?? shareData.photoUrl ?? null;
      const caption = shareData.text || shareData.title;
      await copyCaptionOrImage(photoUrl, caption);
      notifyPhotoCopied(PLATFORM_NAMES[platformId] ?? platformId);
      openAppWindow(platformId, appDeepLink(platformId, photoUrl ?? shareData.url, caption));
      trackShareEvent(platformId, 'photo', photoUrl ?? shareData.url);
      onShareSuccess?.(platformId);
    },
    [effectivePhotoUrl, shareData, notifyPhotoCopied, onShareSuccess],
  );

  const shareToSocialWindow = useCallback(
    (platformId: string): void => {
      let url = socialUrls[platformId as keyof typeof socialUrls];
      if (platformId === 'facebook') {
        url = resolveFacebookUrl(shareData);
      }
      if (!url) return;
      const shareWindow = window.open(
        url,
        '_blank',
        'width=600,height=400,scrollbars=yes,resizable=yes,noopener=yes,noreferrer=yes',
      );
      if (!shareWindow) {
        void navigator.clipboard.writeText(shareData.text || shareData.url);
      }
      trackShareEvent(platformId, 'contact', shareData.url);
      setTimeout(() => onShareSuccess?.(platformId), 1500);
    },
    [socialUrls, shareData, onShareSuccess],
  );

  const handlePlatformShare = useCallback(
    async (platformId: string): Promise<void> => {
      if (platformId === 'email') {
        onEmailRequest();
        return;
      }
      const hasGallery =
        shareData.isPhoto &&
        shareData.galleryPhotos &&
        shareData.galleryPhotos.length > 1;
      if (hasGallery && APP_PLATFORMS.has(platformId)) {
        const initial = shareData.photoUrl ?? shareData.galleryPhotos?.[0] ?? '';
        onPhotoPickerRequest(platformId, initial);
        return;
      }
      setLoading(true);
      onClose();
      try {
        if (APP_PLATFORMS.has(platformId)) {
          await shareToAppDirect(platformId);
          return;
        }
        shareToSocialWindow(platformId);
      } catch (error) {
        onShareError?.(
          platformId,
          error instanceof Error ? error.message : 'Unknown error',
        );
      } finally {
        setLoading(false);
      }
    },
    [
      shareData,
      onEmailRequest,
      onPhotoPickerRequest,
      setLoading,
      onClose,
      shareToAppDirect,
      shareToSocialWindow,
      onShareError,
    ],
  );

  const handlePhotoPickerConfirm = useCallback(
    async (platformId: string, photo: string, caption: string): Promise<void> => {
      await copyCaptionOrImage(photo, caption);
      notifyPhotoCopied(PLATFORM_NAMES[platformId] ?? platformId);
      openAppWindow(platformId, appDeepLink(platformId, photo, caption));
      trackShareEvent(platformId, 'photo', photo);
      onShareSuccess?.(platformId);
    },
    [notifyPhotoCopied, onShareSuccess],
  );

  return { handlePlatformShare, handlePhotoPickerConfirm };
}
