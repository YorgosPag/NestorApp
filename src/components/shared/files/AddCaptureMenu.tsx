/**
 * =============================================================================
 * 🏢 ENTERPRISE: Add/Capture Menu Component
 * =============================================================================
 *
 * Enterprise-grade capture menu that extends the canonical upload system.
 * Replaces simple upload button with context-aware capture options.
 *
 * Features:
 * - Desktop: Dropdown menu
 * - Mobile: Bottom sheet
 * - Context-aware options based on category capabilities
 * - Direct capture (1 click → action) except for file upload
 * - All captures flow through canonical upload pipeline
 *
 * @module components/shared/files/AddCaptureMenu
 * @enterprise ADR-031 - Canonical File Storage System (Extension)
 *
 * ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ: No new FAB system - extends existing EntityFilesManager
 */

'use client';

import React from 'react';
import {
  Upload,
  Camera,
  Video,
  Mic,
  FileText,
  Plus,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIsMobile } from '@/hooks/useMobile';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { FileCategory } from '@/config/domain-constants';
import {
  type CaptureSource,
  type CaptureMetadata,
  getCaptureSourcesForCategory,
} from '@/config/upload-entry-points';
import { useAddCaptureHandlers } from './useAddCaptureHandlers';
import '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

export interface AddCaptureMenuProps {
  /** File category for context-aware options */
  category: FileCategory;
  /** Callback when user selects "Upload file" option */
  onUploadClick: () => void;
  /** Callback when file is captured (photo/video/audio/text) */
  onCapture: (file: File, metadata: CaptureMetadata) => Promise<void>;
  /** Disabled state */
  disabled?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Custom button label */
  buttonLabel?: string;
}

interface CaptureOption {
  id: CaptureSource;
  icon: React.ElementType;
  labelKey: string;
  descriptionKey: string;
  accept?: string;
  capture?: 'user' | 'environment';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const _CAPTURE_OPTIONS: Record<CaptureSource, CaptureOption> = {
  upload: {
    id: 'upload',
    icon: Upload,
    labelKey: 'capture.upload',
    descriptionKey: 'capture.uploadDesc',
  },
  camera: {
    id: 'camera',
    icon: Camera,
    labelKey: 'capture.photo',
    descriptionKey: 'capture.photoDesc',
    accept: 'image/*',
    capture: 'environment',
  },
  video: {
    id: 'video',
    icon: Video,
    labelKey: 'capture.video',
    descriptionKey: 'capture.videoDesc',
    accept: 'video/*',
    capture: 'environment',
  },
  microphone: {
    id: 'microphone',
    icon: Mic,
    labelKey: 'capture.audio',
    descriptionKey: 'capture.audioDesc',
    accept: 'audio/*',
  },
  text: {
    id: 'text',
    icon: FileText,
    labelKey: 'capture.text',
    descriptionKey: 'capture.textDesc',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function AddCaptureMenu({
  category,
  onUploadClick,
  onCapture,
  disabled = false,
  loading = false,
  buttonLabel,
}: AddCaptureMenuProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation('files');
  const colors = useSemanticColors();
  const isMobile = useIsMobile();

  const {
    isOpen,
    setIsOpen,
    isTextNoteOpen,
    setIsTextNoteOpen,
    textNote,
    setTextNote,
    isRecording,
    recordingTime,
    cameraInputRef,
    videoInputRef,
    audioInputRef,
    handleFileCapture,
    handleCameraCapture,
    handleVideoCapture,
    handleAudioCapture,
    handleTextNoteSubmit,
    handleUploadClick,
    formatRecordingTime,
  } = useAddCaptureHandlers({ onUploadClick, onCapture });

  // Get allowed capture sources for this category
  const allowedSources = getCaptureSourcesForCategory(category);

  // =========================================================================
  // RENDER HELPERS
  // =========================================================================

  const renderMenuItems = () => {
    return (
      <>
        {/* Upload file - always available, opens entry point selector */}
        {allowedSources.includes('upload') && (
          <DropdownMenuItem onClick={handleUploadClick} className="gap-2 py-2">
            <Upload className={iconSizes.md} />
            <div className="flex flex-col">
              <span className="font-medium">{t('capture.upload')}</span>
              <span className={cn("text-xs", colors.text.muted)}>
                {t('capture.uploadDesc')}
              </span>
            </div>
          </DropdownMenuItem>
        )}

        {allowedSources.length > 1 && <DropdownMenuSeparator />}

        {/* Camera capture */}
        {allowedSources.includes('camera') && (
          <DropdownMenuItem onClick={handleCameraCapture} className="gap-2 py-2">
            <Camera className={iconSizes.md} />
            <div className="flex flex-col">
              <span className="font-medium">{t('capture.photo')}</span>
              <span className={cn("text-xs", colors.text.muted)}>
                {t('capture.photoDesc')}
              </span>
            </div>
          </DropdownMenuItem>
        )}

        {/* Video capture */}
        {allowedSources.includes('video') && (
          <DropdownMenuItem onClick={handleVideoCapture} className="gap-2 py-2">
            <Video className={iconSizes.md} />
            <div className="flex flex-col">
              <span className="font-medium">{t('capture.video')}</span>
              <span className={cn("text-xs", colors.text.muted)}>
                {t('capture.videoDesc')}
              </span>
            </div>
          </DropdownMenuItem>
        )}

        {/* Audio recording */}
        {allowedSources.includes('microphone') && (
          <DropdownMenuItem
            onClick={handleAudioCapture}
            className={cn('gap-2 py-2', isRecording && 'bg-red-50 text-red-600')} // eslint-disable-line design-system/enforce-semantic-colors
          >
            <Mic className={cn(iconSizes.md, isRecording && 'animate-pulse')} />
            <div className="flex flex-col">
              <span className="font-medium">
                {isRecording
                  ? `${t('capture.recording')} ${formatRecordingTime(recordingTime)}`
                  : t('capture.audio')}
              </span>
              <span className={cn("text-xs", colors.text.muted)}>
                {isRecording ? t('capture.clickToStop') : t('capture.audioDesc')}
              </span>
            </div>
          </DropdownMenuItem>
        )}

        {/* Text note */}
        {allowedSources.includes('text') && (
          <DropdownMenuItem
            onClick={() => setIsTextNoteOpen(true)}
            className="gap-2 py-2"
          >
            <FileText className={iconSizes.md} />
            <div className="flex flex-col">
              <span className="font-medium">{t('capture.text')}</span>
              <span className={cn("text-xs", colors.text.muted)}>
                {t('capture.textDesc')}
              </span>
            </div>
          </DropdownMenuItem>
        )}
      </>
    );
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  const triggerButton = (
    <Button
      variant="default"
      size="sm"
      disabled={disabled || loading}
      aria-label={buttonLabel || t('manager.addFiles')}
    >
      {loading ? (
        <Spinner size="small" color="inherit" className="mr-2" />
      ) : (
        <Plus className={`${iconSizes.sm} mr-2`} />
      )}
      {buttonLabel || t('manager.addFiles')}
    </Button>
  );

  // Hidden inputs for native capture
  const hiddenInputs = (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileCapture(e, 'camera', 'photo')}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileCapture(e, 'video', 'video')}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => handleFileCapture(e, 'microphone', 'audio')}
      />
    </>
  );

  // Text note dialog/sheet
  const textNoteContent = isTextNoteOpen && (
    <div className="space-y-2 p-2">
      <Textarea
        value={textNote}
        onChange={(e) => setTextNote(e.target.value)}
        placeholder={t('capture.textPlaceholder')}
        className="min-h-[150px]"
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setTextNote('');
            setIsTextNoteOpen(false);
          }}
        >
          {t('common.cancel')}
        </Button>
        <Button
          size="sm"
          onClick={handleTextNoteSubmit}
          disabled={!textNote.trim()}
        >
          {t('capture.saveNote')}
        </Button>
      </div>
    </div>
  );

  // Mobile: Bottom Sheet
  if (isMobile) {
    return (
      <>
        {hiddenInputs}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>{triggerButton}</SheetTrigger>
          <SheetContent side="bottom" className="pb-8">
            <SheetHeader>
              <SheetTitle>{t('capture.title')}</SheetTitle>
            </SheetHeader>
            <nav className="mt-4 space-y-2" role="menu">
              {renderMenuItems()}
            </nav>
            {textNoteContent}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // Desktop: Dropdown Menu
  return (
    <>
      {hiddenInputs}
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>{t('capture.title')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {renderMenuItems()}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Text Note Sheet for desktop too */}
      <Sheet open={isTextNoteOpen} onOpenChange={setIsTextNoteOpen}>
        <SheetContent side="right" className="w-[400px]">
          <SheetHeader>
            <SheetTitle>{t('capture.text')}</SheetTitle>
          </SheetHeader>
          {textNoteContent}
        </SheetContent>
      </Sheet>
    </>
  );
}

export default AddCaptureMenu;
