'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, User, Camera } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { EnterprisePhotoUpload } from './EnterprisePhotoUpload';
import { MultiplePhotosUpload } from './MultiplePhotosUpload';
import type { ContactType, Contact } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import type { PhotoSlot } from './MultiplePhotosUpload';
import { FILE_TYPE_CONFIG } from '@/config/file-upload-config';


import { openGalleryPhotoModal } from '@/core/modals/usePhotoPreviewModal';
import { useGlobalPhotoPreview } from '@/providers/PhotoPreviewProvider';
import { asDate } from '@/lib/firestore/utils';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('UnifiedPhotoManager');

const normalizeContactTimestamp = (value?: Date | string | { toDate: () => Date }): Date => {
  const date = asDate(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface UnifiedPhotoManagerProps {
  /** Τύπος επαφής που καθορίζει ποια photo components θα εμφανιστούν */
  contactType: ContactType;
  /** Τρέχοντα δεδομένα της φόρμας */
  formData: ContactFormData;
  /** Handlers για διαφορετικούς τύπους αρχείων */
  handlers: {
    // Για Individual: φωτογραφία προφίλ
    handleFileChange?: (file: File | null) => void;
    handleUploadedPhotoURL?: (photoURL: string) => void;

    // Για Company: λογότυπο
    handleLogoChange?: (file: File | null) => void;
    handleUploadedLogoURL?: (logoURL: string) => void;

    // Για Multiple Photos (Individual - 6 photos)
    handleMultiplePhotosChange?: (photos: PhotoSlot[]) => void;
    handleMultiplePhotoUploadComplete?: (index: number, result: FileUploadResult) => void;

    // Για Profile Selection (Individual - ποια φωτογραφία είναι η κύρια)
    handleProfilePhotoSelection?: (index: number) => void;

    // Για επειγόντα state updates
    setFormData?: (data: ContactFormData) => void;
  };
  /** Upload handlers για διαφορετικούς σκοπούς */
  uploadHandlers: {
    photoUploadHandler?: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>;
    logoUploadHandler?: (file: File, onProgress: (progress: FileUploadProgress) => void) => Promise<FileUploadResult>;
  };
  /** Disabled state */
  disabled?: boolean;
  /** Custom CSS classes */
  className?: string;
}

// ============================================================================
// INDIVIDUAL PHOTO MANAGER (👤 6 φωτογραφίες + profile selector)
// ============================================================================

function IndividualPhotoManager({
  formData,
  handlers,
  uploadHandlers,
  disabled,
  iconSizes
}: {
  formData: ContactFormData;
  handlers: UnifiedPhotoManagerProps['handlers'];
  uploadHandlers: UnifiedPhotoManagerProps['uploadHandlers'];
  disabled?: boolean;
  iconSizes: ReturnType<typeof useIconSizes>;
}) {
  // 🏢 ENTERPRISE: Global PhotoPreviewModal για gallery functionality
  const photoPreviewModal = useGlobalPhotoPreview();

  // 🎯 Photo click handler για το gallery modal
  const handlePhotoClick = React.useCallback((photoIndex: number) => {
    logger.info('IndividualPhotoManager: Photo clicked', { photoIndex });

    // Δημιουργούμε το gallery photos array από τα multiplePhotos
    const galleryPhotos = (formData.multiplePhotos || []).map(photo =>
      photo.uploadUrl || photo.preview || null
    );

    // 🏢 ENTERPRISE: Μετατρέπουμε το formData σε Contact-compatible object για το modal
    // Using type assertion to Partial<Contact> since modal only uses specific fields
    const contactLike: Partial<Contact> & { multiplePhotoURLs: string[] } = {
      id: formData.id,
      type: (formData.type || 'individual') as ContactType,
      status: formData.status || 'active',
      isFavorite: formData.isFavorite || false,
      createdAt: normalizeContactTimestamp(formData.createdAt),
      updatedAt: normalizeContactTimestamp(formData.updatedAt),
      multiplePhotoURLs: galleryPhotos.filter((url): url is string => url !== null)
    };

    logger.info('IndividualPhotoManager: Opening gallery modal', {
      photoIndex,
      totalPhotos: galleryPhotos.length,
      photoUrl: galleryPhotos[photoIndex],
      contact: formData.firstName + ' ' + formData.lastName
    });

    // 🏢 ENTERPRISE: Cast to Contact since openGalleryPhotoModal expects Contact type
    // The modal primarily uses multiplePhotoURLs for gallery navigation
    openGalleryPhotoModal(photoPreviewModal, contactLike as Contact, photoIndex, galleryPhotos);
  }, [formData, photoPreviewModal]);
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Camera className={iconSizes.sm} />
          📸 Φωτογραφίες Προσώπου (6)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Multiple Photos Upload - 6 slots */}
        <MultiplePhotosUpload
          maxPhotos={6}
          photos={formData.multiplePhotos}
          onPhotosChange={handlers.handleMultiplePhotosChange}
          onPhotoUploadComplete={handlers.handleMultiplePhotoUploadComplete}
          uploadHandler={uploadHandlers.photoUploadHandler}
          disabled={disabled}
          compact
          showProgress
          purpose="photo"
          contactData={formData} // 🏢 ENTERPRISE: Pass contact data for FileNamingService
          className="w-full"
          showProfileSelector
          selectedProfilePhotoIndex={formData.selectedProfilePhotoIndex}
          onProfilePhotoSelection={handlers.handleProfilePhotoSelection}
          onPhotoClick={handlePhotoClick} // 🏢 ENTERPRISE: Photo click handler για gallery modal
        />

      </CardContent>

      {/* ✅ PhotoPreviewModal τώρα global - δεν χρειάζεται εδώ */}
    </Card>
  );
}

// ============================================================================
// COMPANY PHOTO MANAGER (🏢 Λογότυπο + Εκπρόσωπος)
// ============================================================================

function CompanyPhotoManager({
  formData,
  handlers,
  uploadHandlers,
  disabled,
  iconSizes
}: {
  formData: ContactFormData;
  handlers: UnifiedPhotoManagerProps['handlers'];
  uploadHandlers: UnifiedPhotoManagerProps['uploadHandlers'];
  disabled?: boolean;
  iconSizes: ReturnType<typeof useIconSizes>;
}) {
  const handleLogoChange = handlers.handleLogoChange ?? (() => {});


  // 🔍 DEBUG: Log formData photo fields
  React.useEffect(() => {
    logger.info('CompanyPhotoManager formData', {
      logoFile: formData.logoFile,
      logoPreview: formData.logoPreview,
      logoURL: formData.logoURL,
      photoFile: formData.photoFile,
      photoPreview: formData.photoPreview,
      photoURL: formData.photoURL
    });
  }, [formData.logoFile, formData.logoPreview, formData.logoURL, formData.photoFile, formData.photoPreview, formData.photoURL]);

  return (
    <div className="mt-4">
      {/* Grid layout για δύο containers δίπλα-δίπλα (πανομοιότυπα με Individual) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Λογότυπο Εταιρείας */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className={iconSizes.sm} />
              Λογότυπο Εταιρείας
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EnterprisePhotoUpload
              purpose="logo"
              maxSize={FILE_TYPE_CONFIG.image.maxSize}
              photoFile={formData.logoFile}
              photoPreview={formData.logoPreview}
              onFileChange={handleLogoChange}
              uploadHandler={uploadHandlers.logoUploadHandler}
              onUploadComplete={(result) => {
                logger.info('Logo upload completed', { url: result.url, hasHandler: !!handlers.handleUploadedLogoURL });
                handlers.handleUploadedLogoURL?.(result.url);
              }}
              disabled={disabled}
              contactData={formData} // 🏷️ Pass contact data for filename generation
              compact
              showProgress
              className="w-full"
            />
          </CardContent>
        </Card>

        {/* Φωτογραφία Εκπροσώπου */}
        {/* 🔥✅ CRITICAL SUCCESS: Representative photo upload ΛΕΙΤΟΥΡΓΕΙ ΤΕΛΕΙΑ! - 2025-12-05
             🎯 FIXED: Stale closure race condition στο validation retry loop
             🏗️ SOLUTION: formDataRef για fresh state access στο useContactSubmission
             ⚠️ ΜΥΔΕΝΙΚΗ ΑΝΟΧΗ: ΜΗΝ ΑΛΛΑΞΕΙΣ ΤΙΠΟΤΑ σε αυτό το component!
             📊 STATUS: WORKING PERFECTLY - Same as Logo upload functionality
             🔗 Related files: useContactForm.ts, useContactSubmission.ts, validation.ts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <User className={iconSizes.sm} />
              Φωτογραφία Εκπροσώπου
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EnterprisePhotoUpload
              purpose="representative"
              maxSize={FILE_TYPE_CONFIG.image.maxSize}
              photoFile={formData.photoFile}
              photoPreview={formData.photoPreview}
              onFileChange={(file) => {
                logger.info('REPRESENTATIVE: onFileChange called', { hasFile: !!file, fileName: file?.name });
                handlers.handleFileChange?.(file);
              }}
              uploadHandler={uploadHandlers.photoUploadHandler}
              onUploadComplete={(result) => {
                logger.info('Representative photo onUploadComplete called', {
                  hasResult: !!result,
                  url: result?.url?.substring(0, 80),
                  hasUrl: !!result?.url,
                  hasHandler: !!handlers.handleUploadedPhotoURL,
                });

                if (result?.url) {
                  logger.info('Representative photo URL found, calling handleUploadedPhotoURL', { url: result.url });
                  handlers.handleUploadedPhotoURL?.(result.url);
                  logger.info('handleUploadedPhotoURL call completed');
                } else {
                  logger.error('No URL in representative photo upload result', {
                    resultKeys: Object.keys(result || {}),
                    resultType: typeof result
                  });
                }
              }}
              disabled={disabled}
              contactData={formData} // 🏷️ Pass contact data for filename generation
              compact
              showProgress
              className="w-full"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// SERVICE PHOTO MANAGER (🏛️ Μόνο λογότυπο)
// ============================================================================

function ServicePhotoManager({
  formData,
  handlers,
  uploadHandlers,
  disabled,
  iconSizes
}: {
  formData: ContactFormData;
  handlers: UnifiedPhotoManagerProps['handlers'];
  uploadHandlers: UnifiedPhotoManagerProps['uploadHandlers'];
  disabled?: boolean;
  iconSizes: ReturnType<typeof useIconSizes>;
}) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Building2 className={iconSizes.sm} />
          🏛️ Λογότυπο Δημόσιας Υπηρεσίας
        </CardTitle>
      </CardHeader>
      <CardContent>
        <EnterprisePhotoUpload
          purpose="logo"
          maxSize={FILE_TYPE_CONFIG.image.maxSize}
          photoFile={formData.logoFile || null}
          photoPreview={formData.logoPreview || undefined}
          contactData={formData}
          onFileChange={(file) => {
            handlers.handleLogoChange?.(file);

            // Καθαρισμός state κατά την αφαίρεση
            if (file === null) {
              // Ασύνχρονος καθαρισμός του state για force re-render
              setTimeout(() => {
                handlers.setFormData?.({
                  ...formData,
                  logoFile: null,
                  logoPreview: '',
                  logoURL: '',
                  _forceDeleteLogo: Date.now()
                } as ContactFormData);
              }, 10);
            }
          }}
          onUploadComplete={(result) => {
            handlers.handleUploadedLogoURL?.(result.url || '');
          }}
          disabled={disabled}
          compact
          showProgress
        />
      </CardContent>
    </Card>
  );
}

// ============================================================================
// UNIFIED PHOTO MANAGER - MAIN COMPONENT
// ============================================================================

/**
 * 🎯 Κεντρικοποιημένο Photo Management Component
 *
 * Εμφανίζει τα κατάλληλα photo upload components ανάλογα με τον τύπο επαφής:
 * - 👤 Individual: 6 φωτογραφίες + profile selector
 * - 🏢 Company: Λογότυπο + Εκπρόσωπος (μόνο αυτά τα 2)
 * - 🏛️ Service: Μόνο λογότυπο
 */
export function UnifiedPhotoManager({
  contactType,
  formData,
  handlers,
  uploadHandlers,
  disabled = false,
  className
}: UnifiedPhotoManagerProps) {
  // 🎯 ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΑ ICON SIZES - ΣΩΣΤΗ ΧΡΗΣΗ
  const iconSizes = useIconSizes();

  // Photo management component for unified contact forms

  return (
    <div className={className}>
      {/* Render appropriate photo manager based on contact type */}
      {contactType === 'individual' && (
        <IndividualPhotoManager
          formData={formData}
          handlers={handlers}
          uploadHandlers={uploadHandlers}
          disabled={disabled}
          iconSizes={iconSizes}
        />
      )}

      {contactType === 'company' && (
        <CompanyPhotoManager
          formData={formData}
          handlers={handlers}
          uploadHandlers={uploadHandlers}
          disabled={disabled}
          iconSizes={iconSizes}
        />
      )}

      {contactType === 'service' && (
        <ServicePhotoManager
          formData={formData}
          handlers={handlers}
          uploadHandlers={uploadHandlers}
          disabled={disabled}
          iconSizes={iconSizes}
        />
      )}

    </div>
  );
}

export default UnifiedPhotoManager;
