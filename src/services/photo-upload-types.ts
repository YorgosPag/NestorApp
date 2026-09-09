/**
 * photo-upload-types — Shared types, loggers, and utility functions for photo upload.
 * ADR-065 SRP split from photo-upload.service.ts.
 *
 * Related files:
 * - photo-upload.service.ts (main service class)
 */

import type { FileUploadProgress, FileUploadResult } from '@/hooks/useFileUploadState';
import type { UsageContext } from '@/config/photo-compression-config';
import type { ContactFormData } from '@/types/ContactFormTypes';
import {
  PHOTO_PURPOSES,
  type PhotoPurpose,
  type EntityType,
  type FileDomain,
  type FileCategory,
} from '@/config/domain-constants';
import { generateFileId } from '@/services/upload/utils/storage-path';
import { createModuleLogger } from '@/lib/telemetry';

// ============================================================================
// MODULE LOGGERS
// ============================================================================

/** 🏢 ENTERPRISE: Logger for canonical file storage flows */
export const canonicalLogger = createModuleLogger('CANONICAL_UPLOAD');

/** 🏢 ENTERPRISE: Logger for legacy photo upload methods */
export const legacyLogger = createModuleLogger('PHOTO_UPLOAD');

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PhotoUploadOptions {
  /** Folder path in Firebase Storage — ONLY for legacy pipeline (omit when using canonical fields) */
  folderPath?: string;
  /** Optional custom filename (will use original if not provided) */
  fileName?: string;
  /** Progress callback */
  onProgress?: (progress: FileUploadProgress) => void;
  /** Enable automatic compression (default: true) */
  enableCompression?: boolean;
  /** Compression usage context for smart compression */
  compressionUsage?: UsageContext;
  /** Maximum file size before compression is forced (default: 500KB) */
  maxSizeKB?: number;
  /** Contact data for FileNamingService (optional) */
  contactData?: ContactFormData | { type?: string; name?: string; id?: string; [key: string]: unknown };
  /** Upload purpose for FileNamingService (optional) */
  purpose?: string;
  /** Photo index for FileNamingService (optional) */
  photoIndex?: number;

  // 🏢 CANONICAL PIPELINE FIELDS (ADR-031)
  /** 🏢 CANONICAL: Contact ID for FileRecord linkage (legacy alias for entityId) */
  contactId?: string;
  /** 🏢 CANONICAL: Company ID for multi-tenant isolation (REQUIRED for canonical) */
  companyId?: string;
  /** 🏢 CANONICAL: User ID who is uploading */
  createdBy?: string;
  /** 🏢 CANONICAL: Contact name for display name generation (legacy alias for entityLabel) */
  contactName?: string;

  // 🏢 ADR-293 Phase 5 — ENTITY-POLYMORPHIC PIPELINE (Batch 29)
  /** Target entity type (property, building, contact, floor, parking, storage, project). Defaults to CONTACT when absent (backward compat). */
  entityType?: EntityType;
  /** Target entity ID (propertyId, buildingId, etc.). Supersedes contactId when provided. */
  entityId?: string;
  /** File domain (sales, construction, admin, etc.). Defaults to ADMIN when absent. */
  domain?: FileDomain;
  /** File category (photos, floorplans, etc.). Defaults to PHOTOS. */
  category?: FileCategory;
  /** Human-readable entity label for display name (propertyName, buildingName). Supersedes contactName when provided. */
  entityLabel?: string;
}

export interface PhotoUploadResult extends FileUploadResult {
  /** Firebase Storage reference path */
  storagePath: string;
  /** Compression information (if compression was applied) */
  compressionInfo?: {
    wasCompressed: boolean;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    strategy?: string;
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generates a unique filename for Firebase Storage
 * 🏢 ENTERPRISE: Using centralized ID generation (crypto-secure)
 */
export function generateUniqueFileName(originalName: string, prefix?: string): string {
  const fileId = generateFileId();
  const extension = originalName.substring(originalName.lastIndexOf('.'));
  const baseName = originalName.substring(0, originalName.lastIndexOf('.'))
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 50);

  return prefix
    ? `${prefix}_${baseName}_${fileId}${extension}`
    : `${baseName}_${fileId}${extension}`;
}

/**
 * 🏢 ENTERPRISE: Type-safe contact name resolution
 */
export function resolveContactName(
  contactName: string | undefined,
  contactData: { name?: string } | undefined
): string | undefined {
  if (contactName && typeof contactName === 'string' && contactName.trim()) {
    return contactName.trim();
  }
  if (contactData?.name && typeof contactData.name === 'string' && contactData.name.trim()) {
    return contactData.name.trim();
  }
  return undefined;
}

/**
 * **Ο σκοπός που γράφεται στο {@link FileRecord.purpose} — προεπιλογή, ΠΟΤΕ φίλτρο**
 * *(ADR-841 §7 Α21.8)*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΕΚΑΝΕ ΠΡΙΝ, ΚΑΙ ΓΙΑΤΙ ΗΤΑΝ ΛΑΘΟΣ — ΜΕΤΡΗΜΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Έλεγχε την τιμή έναντι του {@link PHOTO_PURPOSES} *(**τρεις** τιμές:
 * `profile` · `id` · `other`)* και **σιωπηλά** επέστρεφε `PROFILE` για οτιδήποτε άλλο.
 *
 * 🔑 **Ο φρουρός φύλαγε ΛΑΘΟΣ ΣΥΝΟΛΟ.** Το πεδίο που γεμίζει είναι
 * `FileRecord.purpose?: string` — **ανοιχτό**, και το γράφουν **έξι** διαφορετικά
 * λεξιλόγια *(μετρημένα 09/09)*:
 *
 * | Λεξιλόγιο | Πού | Πλήθος | ξέρει `'logo'`; |
 * |---|---|---|---|
 * | `PHOTO_PURPOSES` | `config/domain-constants.ts` | 3 | **ΟΧΙ** |
 * | `UPLOAD_PURPOSE` | `config/domain-constants.ts` | 5 | ναι |
 * | `UploadPurpose` *(ομώνυμο!)* | `config/file-upload-config.ts` | 7 | ναι |
 * | `PhotoUploadPurpose` | `photo-system/config/photos-tab-types.ts` | 6 | ναι |
 * | `servicePurpose` | `api/upload/photo/route.ts` | 3 | ναι |
 * | `UploadEntryPoint.purpose` | `config/upload-entry-points/` | **~180** *(`string`)* | ΟΧΙ |
 *
 * ⇒ **Πέντε στα έξι ξέρουν το `'logo'`· το μόνο που δεν το ήξερε ήταν αυτό που
 * φύλαγε την πόρτα.** Και η γενική διαδρομή *(`useFileUpload` →
 * `createPendingFileRecordWithPolicy`)* γράφει τις ~180 τιμές **ωμές**, χωρίς να
 * περάσει από εδώ — άρα ο φρουρός δεν επέβαλλε καν συνέπεια: **μόνο** τη
 * φωτογραφική πόρτα ξέπλενε.
 *
 * 🔴 **Το κόστος, μετρημένο σε πραγματικά δεδομένα**: το λογότυπο του γραφείου
 * *(`wordmark-tight.png`)* αποθηκεύτηκε με `purpose: 'profile'` και
 * `displayName: «Φωτογραφίες Προφίλ»` — δηλαδή **ως πορτρέτο φυσικού προσώπου**.
 *
 * ⚠️ **ΓΙΑΤΙ ΔΕΝ ΜΠΗΚΕ ΑΠΛΩΣ `LOGO: 'logo'` ΣΤΟ `PHOTO_PURPOSES`**: θα θεράπευε το
 * **δείγμα** και θα άφηνε την **κλάση** — τα `photo` · `avatar` · `business-card` ·
 * `document` · `floorplan` · `id-document` · `representative` και οι ~180 θα
 * συνέχιζαν να ξεπλένονται. Και θα γεννούσε **έβδομη** παραλλαγή του ίδιου
 * λεξιλογίου *(N.0.2)*.
 *
 * ✅ **Καμία επιφάνεια ασφαλείας**: το `purpose` **δεν** μπαίνει στο μονοπάτι του
 * κάδου *(`buildStoragePath` δεν το δέχεται)* και **δεν** αναφέρεται πουθενά στο
 * `storage.rules` — επαληθευμένο με grep.
 *
 * ⚠️ **Η ΣΥΝΕΠΕΙΑ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΞΕΡΕΙΣ**: ο σκοπός πλέον **επιβιώνει**, άρα
 * *(α)* το `useFileDisplayName` ζητά `t('purposes.<σκοπός>')` — **κλειδί που λείπει
 * δείχνει το ωμό string**· *(β)* το `buildPurposeFilter` συγκρίνει **ακριβώς**, άρα
 * αρχείο με σκοπό `'logo'` δεν εμφανίζεται σε καρτέλα που ζητά `'profile'`.
 *
 * 🔒 **Η ΕΝΟΠΟΙΗΣΗ ΤΩΝ ΕΞΙ ΛΕΞΙΛΟΓΙΩΝ ΜΕΝΕΙ ΑΝΟΙΧΤΗ** — δες ADR-841 §7 Α21.8.
 * Αυτή η συνάρτηση **σταματά την απώλεια**· δεν αποφασίζει ποιο είναι το ένα σύνολο.
 *
 * @param purpose ο σκοπός που **δήλωσε** ο καλών, ή `undefined`
 * @returns τον **δηλωμένο** σκοπό· την προεπιλογή **μόνο** όταν δεν δηλώθηκε
 */
export function resolvePhotoPurpose(purpose: string | undefined): string {
  const declared = purpose?.trim() ?? '';
  return declared === '' ? DEFAULT_PHOTO_PURPOSE : declared;
}

/**
 * 🔑 **Η προεπιλογή ΟΦΕΙΛΕΙ να ανήκει στο κλειστό φωτογραφικό λεξιλόγιο.** Ο τύπος
 * {@link PhotoPurpose} δεν φυλάει πια την **είσοδο** *(σωστά — δες παραπάνω)*, αλλά
 * φυλάει ακόμη αυτό που έχει νόημα να φυλάει: ότι η τιμή που γράφουμε **εμείς**,
 * όταν ο καλών δεν δήλωσε τίποτα, είναι αναγνωρισμένη — όχι επινοημένη.
 */
const DEFAULT_PHOTO_PURPOSE: PhotoPurpose = PHOTO_PURPOSES.PROFILE;
