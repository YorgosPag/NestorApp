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

import React, { useCallback, useRef, useState } from 'react';
import {
  Upload,
  Camera,
  Video,
  Mic,
  FileText,
  Plus,
  X,
  Loader2,
} from 'lucide-react';
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
import type { FileCategory } from '@/config/domain-constants';
import {
  type CaptureSource,
  type CaptureMode,
  type CaptureMetadata,
  getCaptureSourcesForCategory,
  createCaptureMetadata,
} from '@/config/upload-entry-points';

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

const CAPTURE_OPTIONS: Record<CaptureSource, CaptureOption> = {
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
  const isMobile = useIsMobile();

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [isTextNoteOpen, setIsTextNoteOpen] = useState(false);
  const [textNote, setTextNote] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Refs for hidden inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get allowed capture sources for this category
  const allowedSources = getCaptureSourcesForCategory(category);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  /**
   * Handle file selection from hidden input (camera/video capture)
   */
  const handleFileCapture = useCallback(
    async (
      event: React.ChangeEvent<HTMLInputElement>,
      source: CaptureSource,
      captureMode: CaptureMode
    ) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      const metadata = createCaptureMetadata(source, captureMode, {
        mimeType: file.type,
        originalFilename: file.name,
      });

      await onCapture(file, metadata);

      // Reset input
      event.target.value = '';
      setIsOpen(false);
    },
    [onCapture]
  );

  /**
   * Handle camera photo capture
   */
  const handleCameraCapture = useCallback(() => {
    cameraInputRef.current?.click();
  }, []);

  /**
   * Handle video capture
   */
  const handleVideoCapture = useCallback(() => {
    videoInputRef.current?.click();
  }, []);

  /**
   * Handle audio recording start/stop
   */
  const handleAudioCapture = useCallback(async () => {
    // Check if MediaRecorder is supported
    if (!navigator.mediaDevices?.getUserMedia) {
      // Fallback: use file input
      audioInputRef.current?.click();
      return;
    }

    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const file = new File(
            [audioBlob],
            `voice-note-${Date.now()}.webm`,
            { type: 'audio/webm' }
          );

          const metadata = createCaptureMetadata('microphone', 'audio', {
            mimeType: 'audio/webm',
            durationMs: recordingTime * 1000,
            originalFilename: file.name,
          });

          await onCapture(file, metadata);
          setRecordingTime(0);
          setIsOpen(false);

          // Stop all tracks
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingTime(0);

        // Update recording time
        recordingIntervalRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      } catch (error) {
        console.error('[AddCaptureMenu] Audio recording failed:', error);
        // Fallback to file input
        audioInputRef.current?.click();
      }
    }
  }, [isRecording, onCapture, recordingTime]);

  /**
   * Handle text note submission
   */
  const handleTextNoteSubmit = useCallback(async () => {
    if (!textNote.trim()) return;

    const content = textNote.trim();
    const blob = new Blob([content], { type: 'text/markdown' });
    const file = new File(
      [blob],
      `note-${Date.now()}.md`,
      { type: 'text/markdown' }
    );

    const metadata = createCaptureMetadata('text', 'text', {
      mimeType: 'text/markdown',
      originalFilename: file.name,
    });

    await onCapture(file, metadata);
    setTextNote('');
    setIsTextNoteOpen(false);
    setIsOpen(false);
  }, [textNote, onCapture]);

  /**
   * Handle upload option click
   */
  const handleUploadClick = useCallback(() => {
    setIsOpen(false);
    onUploadClick();
  }, [onUploadClick]);

  // =========================================================================
  // RENDER HELPERS
  // =========================================================================

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderMenuItems = () => {
    return (
      <>
        {/* Upload file - always available, opens entry point selector */}
        {allowedSources.includes('upload') && (
          <DropdownMenuItem onClick={handleUploadClick} className="gap-3 py-3">
            <Upload className={iconSizes.md} />
            <div className="flex flex-col">
              <span className="font-medium">{t('capture.upload')}</span>
              <span className="text-xs text-muted-foreground">
                {t('capture.uploadDesc')}
              </span>
            </div>
          </DropdownMenuItem>
        )}

        {allowedSources.length > 1 && <DropdownMenuSeparator />}

        {/* Camera capture */}
        {allowedSources.includes('camera') && (
          <DropdownMenuItem onClick={handleCameraCapture} className="gap-3 py-3">
            <Camera className={iconSizes.md} />
            <div className="flex flex-col">
              <span className="font-medium">{t('capture.photo')}</span>
              <span className="text-xs text-muted-foreground">
                {t('capture.photoDesc')}
              </span>
            </div>
          </DropdownMenuItem>
        )}

        {/* Video capture */}
        {allowedSources.includes('video') && (
          <DropdownMenuItem onClick={handleVideoCapture} className="gap-3 py-3">
            <Video className={iconSizes.md} />
            <div className="flex flex-col">
              <span className="font-medium">{t('capture.video')}</span>
              <span className="text-xs text-muted-foreground">
                {t('capture.videoDesc')}
              </span>
            </div>
          </DropdownMenuItem>
        )}

        {/* Audio recording */}
        {allowedSources.includes('microphone') && (
          <DropdownMenuItem
            onClick={handleAudioCapture}
            className={cn('gap-3 py-3', isRecording && 'bg-red-50 text-red-600')}
          >
            <Mic className={cn(iconSizes.md, isRecording && 'animate-pulse')} />
            <div className="flex flex-col">
              <span className="font-medium">
                {isRecording
                  ? `${t('capture.recording')} ${formatRecordingTime(recordingTime)}`
                  : t('capture.audio')}
              </span>
              <span className="text-xs text-muted-foreground">
                {isRecording ? t('capture.clickToStop') : t('capture.audioDesc')}
              </span>
            </div>
          </DropdownMenuItem>
        )}

        {/* Text note */}
        {allowedSources.includes('text') && (
          <DropdownMenuItem
            onClick={() => setIsTextNoteOpen(true)}
            className="gap-3 py-3"
          >
            <FileText className={iconSizes.md} />
            <div className="flex flex-col">
              <span className="font-medium">{t('capture.text')}</span>
              <span className="text-xs text-muted-foreground">
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
        <Loader2 className={`${iconSizes.sm} mr-2 animate-spin`} />
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
    <div className="space-y-4 p-4">
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
