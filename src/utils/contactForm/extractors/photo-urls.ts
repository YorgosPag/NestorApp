// ============================================================================
// PHOTO URL EXTRACTORS - ENTERPRISE MODULE
// ============================================================================
//
// 📸 Photo URL extraction and processing utilities
// Handles Base64 data URLs, Firebase Storage URLs, and multiple photo arrays
// Part of modular Enterprise form data mapping architecture
//
// ============================================================================

import type { ContactFormData } from '@/types/ContactFormTypes';
import { isFirebaseStorageURL } from '../utils/data-cleaning';

/**
 * Extract uploaded photo URLs from form data
 * 🔙 HYBRID SYSTEM: Base64 data URLs support
 *
 * @param formData - Contact form data
 * @returns Multiple photo URLs array (Base64 data URLs)
 */
export function extractMultiplePhotoURLs(formData: ContactFormData): string[] {
  console.log('🚨 EXTRACT MULTIPLE PHOTOS: Starting extraction with formData.multiplePhotos:', {
    length: formData.multiplePhotos?.length || 0,
    isEmpty: (formData.multiplePhotos?.length || 0) === 0,
    photos: formData.multiplePhotos?.map((p, i) => ({
      index: i,
      hasUploadUrl: !!p.uploadUrl,
      uploadUrl: p.uploadUrl?.substring(0, 50) + '...'
    }))
  });

  const urls: string[] = [];

  formData.multiplePhotos.forEach((photoSlot, index) => {
    // 🆕 ΚΡΙΣΙΜΟ: Ελέγχουμε αν το uploadUrl είναι κενό/διαγραμμένο
    if (photoSlot.uploadUrl && photoSlot.uploadUrl.trim() !== '') {
      // 🔙 HYBRID: Accept both Base64 data URLs and Firebase URLs
      if (photoSlot.uploadUrl.startsWith('data:') || photoSlot.uploadUrl.includes('firebasestorage.googleapis.com')) {
        urls.push(photoSlot.uploadUrl);
        const urlType = photoSlot.uploadUrl.startsWith('data:') ? 'Base64' : 'Firebase';
      } else if (photoSlot.uploadUrl.startsWith('blob:')) {
        // 😫 Απορρίπτουμε blob URLs - είναι temporary!
      }
    }
  });

  console.log('🚨 EXTRACT MULTIPLE PHOTOS: Final extracted URLs:', {
    urlCount: urls.length,
    isEmpty: urls.length === 0,
    urls: urls.map((url, i) => `${i}: ${url.substring(0, 50)}...`)
  });

  return urls;
}

/**
 * Extract main photo URL from form data
 * 🔙 HYBRID SYSTEM: Base64 data URLs + multiple photos support
 *
 * @param formData - Contact form data
 * @param contactType - Contact type for logging
 * @returns Photo URL string (Base64 data URL or empty string)
 */
export function extractPhotoURL(formData: ContactFormData, contactType: string): string {
  console.log('🔍 PHOTO EXTRACTOR: extractPhotoURL called for', contactType);
  console.log('🔍 PHOTO EXTRACTOR: formData.photoURL:', formData.photoURL);
  console.log('🔍 PHOTO EXTRACTOR: formData.photoPreview:', formData.photoPreview);
  console.log('🔍 PHOTO EXTRACTOR: formData.multiplePhotos:', formData.multiplePhotos);

  // 🏢 COMPANY SPECIAL CASE: For company representative photo, check photoURL first
  if (contactType.includes('company') || contactType.includes('representative')) {
    console.log('🏢 COMPANY MODE: Checking photoURL for representative photo');

    // Check photoURL first (from UnifiedPhotoManager)
    if (formData.photoURL && formData.photoURL.trim() !== '' && !formData.photoURL.startsWith('blob:')) {
      // Accept both Base64 and Firebase Storage URLs
      if (formData.photoURL.startsWith('data:') || formData.photoURL.includes('firebasestorage.googleapis.com')) {
        console.log('🏢 EXTRACT PHOTO: Using photoURL (company representative):', formData.photoURL.substring(0, 50) + '...');
        return formData.photoURL;
      }
    }

    // Check photoPreview as fallback
    if (formData.photoPreview && formData.photoPreview.trim() !== '' && !formData.photoPreview.startsWith('blob:')) {
      // Accept both Base64 and Firebase Storage URLs
      if (formData.photoPreview.startsWith('data:') || formData.photoPreview.includes('firebasestorage.googleapis.com')) {
        console.log('🏢 EXTRACT PHOTO: Using photoPreview (company representative fallback):', formData.photoPreview.substring(0, 50) + '...');
        return formData.photoPreview;
      }
    }

    console.log('🏢 EXTRACT PHOTO: No company representative photo found');
    return '';
  }

  // 🔥 CRITICAL FIX: Check for intentional deletion vs pending uploads
  // Only consider it deletion if BOTH conditions are met:
  // 1. No uploaded URLs
  // 2. No files with uploading/pending state

  const hasFiles = formData.multiplePhotos && formData.multiplePhotos.length > 0 &&
    formData.multiplePhotos.some(slot => slot.file || slot.isUploading || (slot.uploadProgress && slot.uploadProgress > 0));

  const hasUploadedUrls = formData.multiplePhotos && formData.multiplePhotos.length > 0 &&
    formData.multiplePhotos.some(slot => slot.uploadUrl && slot.uploadUrl.trim() !== '');

  // True deletion: no files AND no URLs
  const isIntentionalDeletion = !hasFiles && !hasUploadedUrls &&
                               (!formData.photoPreview || formData.photoPreview.trim() === '');

  console.log('🔍 PHOTO EXTRACTOR: isIntentionalDeletion check:', {
    isArray: Array.isArray(formData.multiplePhotos),
    length: formData.multiplePhotos?.length,
    hasFiles: hasFiles,
    hasUploadedUrls: hasUploadedUrls,
    photoPreviewEmpty: (!formData.photoPreview || formData.photoPreview.trim() === ''),
    result: isIntentionalDeletion
  });

  if (isIntentionalDeletion) {
    console.log('🛠️ PHOTO EXTRACTOR: 🔥 DETECTED INTENTIONAL PHOTO DELETION - RETURNING EMPTY STRING! 🔥');
    return '';
  }

  // 🚀 UPLOAD IN PROGRESS: If we have files but no URLs yet, wait for upload
  if (hasFiles && !hasUploadedUrls) {
    console.log('⏳ PHOTO EXTRACTOR: Upload in progress - preserving existing photoURL');
    // Return existing photoURL or empty string to preserve state
    return formData.photoURL || '';
  }

  // 🔙 HYBRID PRIORITY 1: Base64 data URLs from multiplePhotos (για individuals)
  if (formData.multiplePhotos && formData.multiplePhotos.length > 0) {
    const firstPhoto = formData.multiplePhotos[0];
    // 🆕 ΚΡΙΣΙΜΟ: Ελέγχουμε αν είναι κενό
    if (firstPhoto.uploadUrl && firstPhoto.uploadUrl.trim() !== '' && firstPhoto.uploadUrl.startsWith('data:')) {
      return firstPhoto.uploadUrl;
    }
  }

  // 🔙 HYBRID PRIORITY 2: Existing Base64 photoPreview
  if (formData.photoPreview && formData.photoPreview.trim() !== '' && formData.photoPreview.startsWith('data:')) {
    return formData.photoPreview;
  }

  // 🔙 HYBRID PRIORITY 2.5: Check photoURL if photoPreview is empty
  if (formData.photoURL && formData.photoURL.trim() !== '' && formData.photoURL.startsWith('data:')) {
    return formData.photoURL;
  }

  // 🔙 HYBRID PRIORITY 3: Extract URLs από multiplePhotoURLs (Base64 OR Firebase)
  const multiplePhotoURLs = extractMultiplePhotoURLs(formData);
  if (multiplePhotoURLs.length > 0) {
    const firstPhoto = multiplePhotoURLs[0];
    // Accept both Base64 and Firebase Storage URLs
    if (firstPhoto.startsWith('data:') || firstPhoto.includes('firebasestorage.googleapis.com')) {
      return firstPhoto;
    }
  }

  // 🔙 HYBRID FALLBACK: Support existing Firebase URLs (from old working contacts)
  if (formData.photoPreview && formData.photoPreview.trim() !== '' && formData.photoPreview.includes('firebasestorage.googleapis.com')) {
    return formData.photoPreview;
  }

  // Also check photoURL for Firebase URLs
  if (formData.photoURL && formData.photoURL.trim() !== '' && formData.photoURL.includes('firebasestorage.googleapis.com')) {
    return formData.photoURL;
  }

  // 🚨 HYBRID RULE: NEVER return blob URLs - they are temporary!
  if (formData.photoPreview && formData.photoPreview.startsWith('blob:')) {
    return ''; // Κενό string αντί blob URL
  }

  return '';
}

/**
 * Extract logo URL from form data
 *
 * @param formData - Contact form data
 * @param contactType - Contact type for logging
 * @returns Logo URL string
 */
export function extractLogoURL(formData: ContactFormData, contactType: string): string {
  console.log('🔍 EXTRACT LOGO: contactType:', contactType);
  console.log('🔍 EXTRACT LOGO: logoURL:', formData.logoURL);
  console.log('🔍 EXTRACT LOGO: logoPreview:', formData.logoPreview);

  // 🏢 COMPANY/SERVICE PRIORITY: Check logoURL first (από UnifiedPhotoManager)
  if (formData.logoURL && formData.logoURL.trim() !== '' && !formData.logoURL.startsWith('blob:')) {
    // Accept both Base64 and Firebase Storage URLs
    if (formData.logoURL.startsWith('data:') || formData.logoURL.includes('firebasestorage.googleapis.com')) {
      console.log('🏢 EXTRACT LOGO: Using logoURL (UnifiedPhotoManager):', formData.logoURL.substring(0, 50) + '...');
      return formData.logoURL;
    }
  }

  // 🔄 FALLBACK: Check logoPreview (legacy EnterprisePhotoUpload system)
  if (formData.logoPreview && formData.logoPreview.trim() !== '' && !formData.logoPreview.startsWith('blob:')) {
    // Accept both Base64 and Firebase Storage URLs
    if (formData.logoPreview.startsWith('data:') || formData.logoPreview.includes('firebasestorage.googleapis.com')) {
      console.log('🔙 EXTRACT LOGO: Using legacy logoPreview:', formData.logoPreview.substring(0, 50) + '...');
      return formData.logoPreview;
    }
  }

  // 🏢 ENTERPRISE CENTRALIZED: Check multiplePhotos[0] (για service logos που χρησιμοποιούν MultiplePhotosUpload)
  const multiplePhotoURLs = extractMultiplePhotoURLs(formData);
  if (multiplePhotoURLs.length > 0) {
    const firstPhoto = multiplePhotoURLs[0];
    // Accept both Base64 and Firebase Storage URLs
    if (firstPhoto.startsWith('data:') || firstPhoto.includes('firebasestorage.googleapis.com')) {
      console.log('🏢 EXTRACT LOGO: Using centralized multiplePhotos[0] (fallback):', firstPhoto.substring(0, 50) + '...');
      return firstPhoto;
    }
  }

  console.log('🔍 EXTRACT LOGO: No logo found, returning empty string');
  return '';
}