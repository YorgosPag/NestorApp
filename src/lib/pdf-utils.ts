import { storage, db } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { doc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

/**
 * PDF Utils Library για τη διαχείριση PDF κατόψεων
 * 
 * Παρέχει λειτουργίες για:
 * - Upload PDF στο Firebase Storage
 * - Διαχείριση PDF metadata στο Firestore
 * - Διαγραφή παλιών PDF
 * - Validation PDF αρχείων
 * - Error handling
 */

export interface PDFUploadResult {
  url: string;
  path: string;
  metadata: {
    originalName: string;
    size: number;
    uploadedAt: string;
    floorId: string;
    buildingId: string;
  };
}

export interface PDFValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export interface PDFUploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  progress: number;
  state: 'running' | 'paused' | 'success' | 'error';
}

export type PDFUploadCallback = (progress: PDFUploadProgress) => void;

/**
 * Validates a PDF file before upload
 */
export function validatePDFFile(file: File): PDFValidationResult {
  const result: PDFValidationResult = { isValid: true, warnings: [] };

  // Check file type
  if (file.type !== 'application/pdf') {
    return {
      isValid: false,
      error: 'Μόνο αρχεία PDF επιτρέπονται'
    };
  }

  // Check file size (50MB limit)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'Το αρχείο είναι πολύ μεγάλο (μέγιστο 50MB)'
    };
  }

  // Check file size warnings
  const warningSize = 10 * 1024 * 1024; // 10MB
  if (file.size > warningSize) {
    result.warnings?.push('Το αρχείο είναι μεγάλο και μπορεί να χρειαστεί περισσότερος χρόνος για upload');
  }

  // Check filename
  const validNamePattern = /^[a-zA-Z0-9._-]+\.pdf$/i;
  if (!validNamePattern.test(file.name)) {
    result.warnings?.push('Το όνομα του αρχείου περιέχει ειδικούς χαρακτήρες που μπορεί να προκαλέσουν προβλήματα');
  }

  return result;
}

/**
 * Generates a unique file path for PDF storage
 */
export function generatePDFPath(buildingId: string, floorId: string, originalName: string): string {
  const timestamp = Date.now();
  const sanitizedName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `floor-plans/${buildingId}/${floorId}/${timestamp}_${sanitizedName}`;
}

/**
 * Uploads a PDF file to Firebase Storage with progress tracking
 */
export async function uploadPDFToStorage(
  file: File,
  buildingId: string,
  floorId: string,
  onProgress?: PDFUploadCallback
): Promise<PDFUploadResult> {
  // Validate file first
  const validation = validatePDFFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid PDF file');
  }

  const filePath = generatePDFPath(buildingId, floorId, file.name);
  const storageRef = ref(storage, filePath);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress: PDFUploadProgress = {
          bytesTransferred: snapshot.bytesTransferred,
          totalBytes: snapshot.totalBytes,
          progress: (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          state: snapshot.state as PDFUploadProgress['state']
        };
        
        onProgress?.(progress);
      },
      (error) => {
        console.error('PDF upload error:', error);
        
        // Provide user-friendly error messages
        let errorMessage = 'Σφάλμα κατά την αποστολή του αρχείου';
        
        if (error.code === 'storage/unauthorized') {
          errorMessage = 'Δεν έχετε δικαίωμα να ανεβάσετε αρχεία';
        } else if (error.code === 'storage/canceled') {
          errorMessage = 'Η αποστολή ακυρώθηκε';
        } else if (error.code === 'storage/quota-exceeded') {
          errorMessage = 'Δεν υπάρχει αρκετός χώρος αποθήκευσης';
        }
        
        reject(new Error(errorMessage));
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          const result: PDFUploadResult = {
            url: downloadURL,
            path: filePath,
            metadata: {
              originalName: file.name,
              size: file.size,
              uploadedAt: new Date().toISOString(),
              floorId,
              buildingId
            }
          };
          
          resolve(result);
        } catch (error) {
          reject(new Error('Σφάλμα κατά τη λήψη URL αρχείου'));
        }
      }
    );
  });
}

/**
 * Updates floor document in Firestore with new PDF data
 */
export async function updateFloorPDFInFirestore(
  floorId: string,
  pdfResult: PDFUploadResult
): Promise<void> {
  try {
    const floorDocRef = doc(db, 'floors', floorId);
    
    await updateDoc(floorDocRef, {
      pdfUrl: pdfResult.url,
      pdfPath: pdfResult.path,
      pdfMetadata: pdfResult.metadata,
      pdfUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Firestore update error:', error);
    throw new Error('Σφάλμα κατά την ενημέρωση βάσης δεδομένων');
  }
}

/**
 * Retrieves the current PDF URL for a floor
 */
export async function getFloorPDFUrl(floorId: string): Promise<string | null> {
  try {
    const floorDocRef = doc(db, 'floors', floorId);
    const floorDoc = await getDoc(floorDocRef);
    
    if (floorDoc.exists()) {
      const data = floorDoc.data();
      return data?.pdfUrl || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting floor PDF URL:', error);
    return null;
  }
}

/**
 * Deletes old PDF from storage
 */
export async function deleteOldPDFFromStorage(floorId: string): Promise<boolean> {
  try {
    const floorDocRef = doc(db, 'floors', floorId);
    const floorDoc = await getDoc(floorDocRef);
    
    if (!floorDoc.exists()) {
      return false;
    }
    
    const data = floorDoc.data();
    const oldPdfPath = data?.pdfPath;
    
    if (oldPdfPath && typeof oldPdfPath === 'string') {
      const oldRef = ref(storage, oldPdfPath);
      await deleteObject(oldRef);
      console.log('Old PDF deleted successfully:', oldPdfPath);
      return true;
    }
    
    return false;
  } catch (error) {
    // Don't throw error for deletion failures - just log and continue
    console.warn('Could not delete old PDF:', error);
    return false;
  }
}

/**
 * Lists all PDFs for a specific building
 */
export async function listBuildingPDFs(buildingId: string): Promise<string[]> {
  try {
    const buildingStorageRef = ref(storage, `floor-plans/${buildingId}`);
    const result = await listAll(buildingStorageRef);
    
    const pdfUrls: string[] = [];
    for (const itemRef of result.items) {
      const url = await getDownloadURL(itemRef);
      pdfUrls.push(url);
    }
    
    return pdfUrls;
  } catch (error) {
    console.error('Error listing building PDFs:', error);
    return [];
  }
}

/**
 * Batch delete PDFs for a building (cleanup utility)
 */
export async function deleteBuildingPDFs(buildingId: string): Promise<number> {
  try {
    const buildingStorageRef = ref(storage, `floor-plans/${buildingId}`);
    const result = await listAll(buildingStorageRef);
    
    let deletedCount = 0;
    for (const itemRef of result.items) {
      try {
        await deleteObject(itemRef);
        deletedCount++;
      } catch (error) {
        console.warn('Could not delete PDF:', itemRef.fullPath, error);
      }
    }
    
    return deletedCount;
  } catch (error) {
    console.error('Error deleting building PDFs:', error);
    return 0;
  }
}

/**
 * Gets PDF metadata for a floor
 */
export async function getFloorPDFMetadata(floorId: string): Promise<PDFUploadResult['metadata'] | null> {
  try {
    const floorDocRef = doc(db, 'floors', floorId);
    const floorDoc = await getDoc(floorDocRef);
    
    if (floorDoc.exists()) {
      const data = floorDoc.data();
      return data?.pdfMetadata || null;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting PDF metadata:', error);
    return null;
  }
}

/**
 * Validates PDF URL accessibility
 */
export async function validatePDFUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.error('PDF URL validation failed:', error);
    return false;
  }
}

/**
 * Complete PDF upload workflow
 */
export async function uploadFloorPDF(
  file: File,
  buildingId: string,
  floorId: string,
  onProgress?: PDFUploadCallback
): Promise<PDFUploadResult> {
  // Step 1: Validate file
  const validation = validatePDFFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid PDF file');
  }

  // Step 2: Delete old PDF (optional - don't fail if it doesn't work)
  await deleteOldPDFFromStorage(floorId);

  // Step 3: Upload new PDF
  const uploadResult = await uploadPDFToStorage(file, buildingId, floorId, onProgress);

  // Step 4: Update Firestore
  await updateFloorPDFInFirestore(floorId, uploadResult);

  return uploadResult;
}

/**
 * Error handling utility for PDF operations
 */
export function handlePDFError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return 'Άγνωστο σφάλμα κατά τη διαχείριση του PDF';
}