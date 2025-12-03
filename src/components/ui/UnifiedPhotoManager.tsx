'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, User, Camera, Star, StarIcon, X } from 'lucide-react';
import { EnterprisePhotoUpload } from './EnterprisePhotoUpload';
import { MultiplePhotosUpload } from './MultiplePhotosUpload';
import type { ContactType } from '@/types/contacts';
import type { ContactFormData } from '@/types/ContactFormTypes';
import type { FileUploadProgress, FileUploadResult } from '@/hooks/useEnterpriseFileUpload';
import type { PhotoSlot } from './MultiplePhotosUpload';

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
  disabled
}: {
  formData: ContactFormData;
  handlers: UnifiedPhotoManagerProps['handlers'];
  uploadHandlers: UnifiedPhotoManagerProps['uploadHandlers'];
  disabled?: boolean;
}) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Camera className="h-4 w-4" />
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
          compact={true}
          showProgress={true}
          purpose="photo"
          className="w-full"
        />

        {/* Profile Photo Selector */}
        {formData.multiplePhotos && formData.multiplePhotos.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              Επιλογή Φωτογραφίας Προφίλ
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {formData.multiplePhotos.map((photo, index) => (
                <div key={index} className="relative">
                  {photo.preview || photo.uploadUrl ? (
                    <div className="relative">
                      <img
                        src={photo.preview || photo.uploadUrl}
                        alt={`Φωτογραφία ${index + 1}`}
                        className="w-full h-20 object-cover rounded border"
                      />
                      <Button
                        type="button"
                        variant={formData.selectedProfilePhotoIndex === index ? "default" : "outline"}
                        size="sm"
                        className="absolute bottom-1 right-1 h-6 px-2 text-xs"
                        onClick={() => handlers.handleProfilePhotoSelection?.(index)}
                        disabled={disabled}
                      >
                        {formData.selectedProfilePhotoIndex === index ? (
                          <Star className="h-3 w-3 fill-current" />
                        ) : (
                          <StarIcon className="h-3 w-3" />
                        )}
                      </Button>
                      {formData.selectedProfilePhotoIndex === index && (
                        <Badge className="absolute top-1 left-1 text-xs">Προφίλ</Badge>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-20 bg-gray-100 rounded border flex items-center justify-center">
                      <span className="text-xs text-gray-400">Κενό {index + 1}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
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
  disabled
}: {
  formData: ContactFormData;
  handlers: UnifiedPhotoManagerProps['handlers'];
  uploadHandlers: UnifiedPhotoManagerProps['uploadHandlers'];
  disabled?: boolean;
}) {
  return (
    <div className="mt-4">
      {/* Grid layout για δύο containers δίπλα-δίπλα (πανομοιότυπα με Individual) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Λογότυπο Εταιρείας */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4" />
              Λογότυπο Εταιρείας
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EnterprisePhotoUpload
              purpose="logo"
              maxSize={5 * 1024 * 1024} // 5MB
              photoFile={formData.logoFile}
              photoPreview={formData.logoPreview}
              onFileChange={handlers.handleLogoChange}
              uploadHandler={uploadHandlers.logoUploadHandler}
              onUploadComplete={(result) => handlers.handleUploadedLogoURL?.(result.url)}
              disabled={disabled}
              contactData={formData} // 🏷️ Pass contact data for filename generation
              compact={true}
              showProgress={true}
              className="w-full"
            />
          </CardContent>
        </Card>

        {/* Φωτογραφία Εκπροσώπου */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4" />
              Φωτογραφία Εκπροσώπου
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EnterprisePhotoUpload
              purpose="photo"
              maxSize={5 * 1024 * 1024} // 5MB
              photoFile={formData.photoFile}
              photoPreview={formData.photoPreview}
              onFileChange={handlers.handleFileChange}
              uploadHandler={uploadHandlers.photoUploadHandler}
              onUploadComplete={(result) => handlers.handleUploadedPhotoURL?.(result.url)}
              disabled={disabled}
              contactData={formData} // 🏷️ Pass contact data for filename generation
              compact={true}
              showProgress={true}
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
  disabled
}: {
  formData: ContactFormData;
  handlers: UnifiedPhotoManagerProps['handlers'];
  uploadHandlers: UnifiedPhotoManagerProps['uploadHandlers'];
  disabled?: boolean;
}) {

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Building2 className="h-4 w-4" />
          🏛️ Λογότυπο Δημόσιας Υπηρεσίας
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
          <label className="cursor-pointer block">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                if (!file) return;

                handlers.handleLogoChange?.(file);

                const reader = new FileReader();
                reader.onload = (ev) => {
                  const url = ev.target?.result as string;
                  handlers.handleUploadedLogoURL?.(url);
                };
                reader.readAsDataURL(file);
              }}
              disabled={disabled}
              className="sr-only"
            />
            <div className="space-y-2">
              <Building2 className="mx-auto h-12 w-12 text-gray-400" />
              <div className="text-sm text-gray-600">
                <span className="font-semibold text-blue-600 hover:text-blue-500">
                  Κάντε κλικ για επιλογή λογότυπου
                </span>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG έως 5MB</p>
              </div>
            </div>
          </label>
        </div>

        {formData.logoPreview && (
          <div className="relative">
            <img
              src={formData.logoPreview}
              alt="Logo preview"
              className="w-full max-h-48 object-contain rounded-lg border border-gray-200"
            />
            <button
              type="button"
              onClick={() => {
                handlers.handleLogoChange?.(null);
                handlers.handleUploadedLogoURL?.('');
              }}
              className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
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
        />
      )}

      {contactType === 'company' && (
        <CompanyPhotoManager
          formData={formData}
          handlers={handlers}
          uploadHandlers={uploadHandlers}
          disabled={disabled}
        />
      )}

      {contactType === 'service' && (
        <ServicePhotoManager
          formData={formData}
          handlers={handlers}
          uploadHandlers={uploadHandlers}
          disabled={disabled}
        />
      )}

    </div>
  );
}

export default UnifiedPhotoManager;