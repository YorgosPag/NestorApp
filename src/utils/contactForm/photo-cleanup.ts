/**
 * 📸 Photo Cleanup — Orphaned file detection and deletion
 *
 * Compares old vs new photo/logo URLs and deletes orphaned Firebase Storage files.
 * Non-blocking — contact update continues even if cleanup fails.
 *
 * @module utils/contactForm/photo-cleanup
 * @enterprise Enterprise Cleanup Pattern
 */

import type { Contact } from '@/types/contacts';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('PhotoCleanup');

// ============================================================================
// TYPES
// ============================================================================

interface ContactDataWithPhotos {
  photoURL?: string;
  logoURL?: string;
  multiplePhotoURLs?: string[];
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Clean up orphaned photo/logo files from Firebase Storage.
 * Compares old contact URLs with new contact data and deletes any removed files.
 * Non-blocking — failures are logged but don't prevent the contact update.
 */
export async function cleanupOrphanedPhotos(
  editContact: Contact,
  newContactData: ContactDataWithPhotos
): Promise<void> {
  try {
    // Collect old photo URLs
    const oldPhotoUrls: string[] = [];
    if (editContact.photoURL) oldPhotoUrls.push(editContact.photoURL);
    if (editContact.multiplePhotoURLs) oldPhotoUrls.push(...editContact.multiplePhotoURLs);
    if ('logoURL' in editContact && editContact.logoURL) oldPhotoUrls.push(editContact.logoURL);

    // Collect new photo URLs
    const newPhotoUrls: string[] = [];
    if (newContactData.photoURL) newPhotoUrls.push(newContactData.photoURL);
    if (newContactData.logoURL) newPhotoUrls.push(newContactData.logoURL);
    if (newContactData.multiplePhotoURLs) newPhotoUrls.push(...newContactData.multiplePhotoURLs);

    // Find orphaned URLs (in old but not in new)
    const orphanedUrls = oldPhotoUrls.filter(
      (oldUrl) => oldUrl && oldUrl.trim() !== '' && !newPhotoUrls.includes(oldUrl)
    );

    logger.info('Photo comparison result', {
      contactType: editContact.type,
      oldPhotosCount: oldPhotoUrls.length,
      newPhotosCount: newPhotoUrls.length,
      orphanedCount: orphanedUrls.length,
    });

    if (orphanedUrls.length > 0) {
      const { PhotoUploadService } = await import('@/services/photo-upload.service');
      const cleanupPromises = orphanedUrls.map(async (url) => {
        try {
          await PhotoUploadService.deletePhotoByURL(url);
          logger.info('Deleted orphaned file');
        } catch (error) {
          logger.warn('Failed to delete orphaned file', { error });
        }
      });
      await Promise.allSettled(cleanupPromises);
      logger.info('Completed cleanup', { count: orphanedUrls.length });
    }
  } catch (cleanupError) {
    logger.warn('Photo cleanup failed, continuing with contact update', { error: cleanupError });
  }
}
