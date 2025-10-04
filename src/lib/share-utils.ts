// /home/user/studio/src/lib/share-utils.ts

export interface ShareData {
  title: string;
  text?: string;
  url: string;
  files?: File[];
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

export interface LeadShareData {
  leadId: string;
  propertyId?: string;
  searchCriteria?: Record<string, any>;
  customMessage?: string;
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
      console.log('Web Share cancelled or failed:', error);
      // Fall through to clipboard fallback
    }
  }

  // Fallback: copy URL to clipboard
  return copyToClipboard(data.url);
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
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Generate shareable URL with UTM parameters
 */
export function generateShareableURL(
  baseUrl: string,
  utmParams: UTMParams,
  additionalParams?: Record<string, string>
): string {
  const url = new URL(baseUrl, window.location.origin);
  
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
 * Share property with tracking
 */
export async function shareProperty(
  property: PropertyShareData,
  source: string = 'property_details',
  customMessage?: string
): Promise<boolean> {
  const utmParams: UTMParams = {
    source,
    medium: 'social_share',
    campaign: 'property_sharing',
    content: property.id
  };
  
  const shareUrl = generateShareableURL(
    `/properties/${property.id}`,
    utmParams,
    { shared: 'true' }
  );
  
  const shareText = customMessage || generatePropertyShareText(property);
  
  const shareData: ShareData = {
    title: property.title,
    text: shareText,
    url: shareUrl
  };
  
  return shareContent(shareData);
}

/**
 * Share search results or lead inquiry
 */
export async function shareSearchResults(
  shareData: LeadShareData,
  source: string = 'search_results'
): Promise<boolean> {
  const utmParams: UTMParams = {
    source,
    medium: 'social_share',
    campaign: 'search_sharing',
    content: shareData.leadId
  };
  
  const additionalParams: Record<string, string> = {
    shared: 'true',
    lead_ref: shareData.leadId
  };
  
  if (shareData.propertyId) {
    additionalParams.property_ref = shareData.propertyId;
  }
  
  const shareUrl = generateShareableURL(
    '/properties',
    utmParams,
    additionalParams
  );
  
  const shareText = shareData.customMessage || 
    'Δείτε αυτά τα ενδιαφέροντα ακίνητα από την Nestor Construct!';
  
  const shareData_obj: ShareData = {
    title: 'Nestor Construct - Ακίνητα',
    text: shareText,
    url: shareUrl
  };
  
  return shareContent(shareData_obj);
}

/**
 * Generate property share text
 */
function generatePropertyShareText(property: PropertyShareData): string {
  let text = `🏠 ${property.title}`;
  
  if (property.location) {
    text += `\n📍 ${property.location}`;
  }
  
  if (property.price) {
    text += `\n💰 €${property.price.toLocaleString()}`;
  }
  
  if (property.area) {
    text += `\n📐 ${property.area} τ.μ.`;
  }
  
  if (property.description) {
    text += `\n\n${property.description}`;
  }
  
  text += '\n\nΔείτε περισσότερα στο Nestor Construct!';
  
  return text;
}

/**
 * Generate Open Graph meta tags for sharing
 */
export function generateOGTags(data: {
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  siteName?: string;
  type?: string;
}): Record<string, string> {
  const tags: Record<string, string> = {
    'og:title': data.title,
    'og:description': data.description,
    'og:url': data.url,
    'og:type': data.type || 'website',
    'og:site_name': data.siteName || 'Nestor Construct'
  };
  
  if (data.imageUrl) {
    tags['og:image'] = data.imageUrl;
    tags['og:image:alt'] = data.title;
  }
  
  // Twitter Card tags
  tags['twitter:card'] = 'summary_large_image';
  tags['twitter:title'] = data.title;
  tags['twitter:description'] = data.description;
  
  if (data.imageUrl) {
    tags['twitter:image'] = data.imageUrl;
  }
  
  return tags;
}

/**
 * Social media platform URLs for manual sharing
 */
export function getSocialShareUrls(url: string, text: string) {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedText} ${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    email: `mailto:?subject=${encodedText}&body=${encodedText}%0A%0A${encodedUrl}`
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
  console.log('📊 Share event:', {
    platform,
    contentType,
    contentId,
    timestamp: new Date().toISOString()
  });
  
  // Example: Google Analytics 4 event
  if (typeof gtag !== 'undefined') {
    gtag('event', 'share', {
      method: platform,
      content_type: contentType,
      item_id: contentId
    });
  }
}
