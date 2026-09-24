export interface ShareData {
  title: string;
  text?: string;
  url: string;
  files?: File[];
  isPhoto?: boolean;
}

export interface UTMParams {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
}

export interface PropertyShareData {
  id: string;
  title: string;
  description?: string;
  price?: number;
  area?: number;
  location?: string;
  imageUrl?: string;
  propertyType?: string;
}

/**
 * Check if Web Share API is supported
 */
export function isWebShareSupported(): boolean {
  return typeof navigator !== 'undefined' && 'share' in navigator;
}

/**
 * Share content using Web Share API or fallback to clipboard
 */
export async function shareContent(data: ShareData): Promise<boolean> {
  if (isWebShareSupported()) {
    try {
      await navigator.share(data);
      return true;
    } catch (error) {
      // Debug logging removed
      // Fall through to clipboard fallback
    }
  }

  // Fallback: copy URL to clipboard
  return copyToClipboard(data.url);
}

/** Τι έγινε με μια κοινοποίηση συνδέσμου — τέσσερα αποτελέσματα, το καθένα με άλλη απάντηση στην οθόνη. */
export type LinkShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * **Φύλλο κοινοποίησης στην αφή, αντιγραφή στο ποντίκι** (ADR-777 §8.78).
 *
 * 🏆 Google Maps (επιφάνεια εργασίας): «Share → **Copy link**». Κινητό (Airbnb, Zillow): το
 * **φύλλο του λειτουργικού** — εκεί ζουν WhatsApp/Viber/Messages. Στην επιφάνεια εργασίας το
 * `navigator.share` υπάρχει (Chrome/Edge σε Windows) αλλά ανοίγει τον διάλογο του λειτουργικού,
 * που δεν είναι αυτό που ζητά κάποιος στο γραφείο — ζητά τον σύνδεσμο στο πρόχειρο, με **ένα** κλικ.
 * Γι' αυτό η απόφαση ρωτά τον **δείκτη** (`pointer: coarse`), όχι την ύπαρξη του API.
 *
 * 🔴 **Η ακύρωση ΔΕΝ είναι αποτυχία**: `AbortError` ⇒ `'cancelled'`, **χωρίς** αντιγραφή
 * (MDN: «User canceled the share operation»). Το `shareContent` πιο πάνω αντιγράφει και τότε — ο
 * άνθρωπος πατά «Άκυρο» και του λέμε «αντιγράφηκε». Εδώ, **μόνο** άρνηση του φύλλου (όχι ακύρωση)
 * πέφτει στην αντιγραφή.
 */
export async function shareOrCopyLink(data: { readonly title: string; readonly url: string }): Promise<LinkShareOutcome> {
  if (prefersNativeShare(data)) {
    try {
      await navigator.share({ title: data.title, url: data.url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyToClipboard(data.url)) ? 'copied' : 'failed';
}

function prefersNativeShare(data: { readonly title: string; readonly url: string }): boolean {
  if (!isWebShareSupported() || typeof window.matchMedia !== 'function') return false;
  if (!window.matchMedia('(pointer: coarse)').matches) return false;
  return typeof navigator.canShare !== 'function' || navigator.canShare(data);
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    }
  } catch (error) {
    // Error logging removed
    return false;
  }
}

/**
 * Copy an image from URL to clipboard as PNG.
 * Uses blob URL to avoid canvas CORS taint.
 */
export async function copyImageToClipboard(imageUrl: string): Promise<boolean> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();

  const blobUrl = URL.createObjectURL(blob);
  const img = new Image();
  img.crossOrigin = 'anonymous';

  return new Promise<boolean>((resolve) => {
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(false); return; }
        ctx.drawImage(img, 0, 0);

        const pngBlob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
        if (!pngBlob) { resolve(false); return; }

        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': pngBlob })
        ]);
        resolve(true);
      } catch {
        resolve(false);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(false); };
    img.src = blobUrl;
  });
}

/**
 * Generate shareable URL with UTM parameters
 */
import { publicOrigin } from '@/lib/http/public-origin';
export function generateShareableURL(
  baseUrl: string,
  utmParams: UTMParams,
  additionalParams?: Record<string, string>
): string {
  // 🔴 ADR-853 §19 Θ6 — ΕΔΩ ΗΤΑΝ Η ΧΕΙΡΟΤΕΡΗ ΑΝΑΦΟΡΑ ΤΟΥ ΝΕΚΡΟΥ HOST, και ήταν **δημόσια**:
  //    κάθε κοινοποίηση σε κοινωνικό δίκτυο έδειχνε σε `nestor-app.vercel.app`, domain που
  //    δεν ελέγχουμε από το πάγωμα του Vercel (2026-05-09). Ένα ελεύθερο υποdomain τρίτου
  //    μπορεί να διεκδικηθεί από οποιονδήποτε ⇒ **subdomain takeover**: ξένος σερβίρει
  //    περιεχόμενο κάτω από το όνομά μας, σε σύνδεσμο που **εμείς** δημοσιεύσαμε.
  const origin = publicOrigin() ?? (typeof window !== 'undefined' ? window.location.origin : '');

  const url = new URL(baseUrl, origin);
  
  // Add UTM parameters
  url.searchParams.set('utm_source', utmParams.source);
  url.searchParams.set('utm_medium', utmParams.medium);
  url.searchParams.set('utm_campaign', utmParams.campaign);
  
  if (utmParams.content) {
    url.searchParams.set('utm_content', utmParams.content);
  }
  
  if (utmParams.term) {
    url.searchParams.set('utm_term', utmParams.term);
  }
  
  // Add additional parameters
  if (additionalParams) {
    Object.entries(additionalParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  
  return url.toString();
}

/**
 * Social media platform URLs for manual sharing
 */
export function getSocialShareUrls(url: string, text: string) {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);

  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    messenger: `https://www.messenger.com/new`,
    instagram: `https://www.instagram.com/`,
    whatsapp: `https://wa.me/?text=${encodedText}${url ? ' ' + encodedUrl : ''}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    email: `mailto:?subject=${encodedText}&body=${encodedText}${url ? '%0A%0A' + encodedUrl : ''}`
  };
}

/**
 * Enhanced social sharing URLs for photos with better Facebook handling
 */
export function getPhotoSocialShareUrls(photoUrl: string, text: string, pageUrl?: string) {
  const encodedPhotoUrl = encodeURIComponent(photoUrl);
  const encodedText = encodeURIComponent(text);

  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedPhotoUrl}&quote=${encodedText}`,
    messenger: `https://www.messenger.com/new`,
    instagram: `https://www.instagram.com/`,
    whatsapp: `https://wa.me/?text=${encodedText} ${encodedPhotoUrl}`,
    telegram: `https://t.me/share/url?url=${encodedPhotoUrl}&text=${encodedText}`,
    email: `mailto:?subject=${encodedText}&body=${encodedText}%0A%0A${encodedPhotoUrl}`
  };
}

/**
 * Track share event (for analytics)
 */
export function trackShareEvent(
  platform: string,
  contentType: string,
  contentId: string
): void {
  // This would integrate with your analytics service
  // Debug logging removed
  // platform,
  // contentType,
  // contentId,
  // timestamp: new Date().toISOString()

  // Example: Google Analytics 4 event
  // if (typeof gtag !== 'undefined') {
  //   gtag('event', 'share', {
  //     method: platform,
  //     content_type: contentType,
  //     item_id: contentId
  //   });
  // }
}
