/**
 * =============================================================================
 * 🏢 ENTERPRISE: useAddCaptureHandlers Hook
 * =============================================================================
 *
 * Encapsulates all capture handler logic for AddCaptureMenu.
 * Extracted to comply with Google-level file size standards (SRP).
 *
 * @module components/shared/files/useAddCaptureHandlers
 * @enterprise ADR-031 - Canonical File Storage System (Extension)
 */

import { useCallback, useRef, useState } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { useIsMobile } from '@/hooks/useMobile';
import {
  type CaptureSource,
  type CaptureMode,
  type CaptureMetadata,
  createCaptureMetadata,
} from '@/config/upload-entry-points';

function supportsGetUserMedia(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

// ============================================================================
// MODULE LOGGER
// ============================================================================

const logger = createModuleLogger('useAddCaptureHandlers');

// ============================================================================
// TYPES
// ============================================================================

export interface UseAddCaptureHandlersParams {
  onUploadClick: () => void;
  onCapture: (file: File, metadata: CaptureMetadata) => Promise<void>;
}

export interface UseAddCaptureHandlersReturn {
  // State
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  isTextNoteOpen: boolean;
  setIsTextNoteOpen: (value: boolean) => void;
  textNote: string;
  setTextNote: (value: string) => void;
  isRecording: boolean;
  recordingTime: number;
  // Desktop camera dialog state (ADR-311)
  isCameraDialogOpen: boolean;
  setIsCameraDialogOpen: (value: boolean) => void;
  isVideoDialogOpen: boolean;
  setIsVideoDialogOpen: (value: boolean) => void;
  // Refs
  cameraInputRef: React.RefObject<HTMLInputElement>;
  videoInputRef: React.RefObject<HTMLInputElement>;
  audioInputRef: React.RefObject<HTMLInputElement>;
  // Handlers
  handleFileCapture: (
    event: React.ChangeEvent<HTMLInputElement>,
    source: CaptureSource,
    captureMode: CaptureMode
  ) => Promise<void>;
  handleCameraCapture: () => void;
  handleVideoCapture: () => void;
  handleAudioCapture: () => Promise<void>;
  handleDialogCapture: (file: File, metadata: CaptureMetadata) => Promise<void>;
  handleTextNoteSubmit: () => Promise<void>;
  handleUploadClick: () => void;
  formatRecordingTime: (seconds: number) => string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useAddCaptureHandlers({
  onUploadClick,
  onCapture,
}: UseAddCaptureHandlersParams): UseAddCaptureHandlersReturn {
  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------

  const [isOpen, setIsOpen] = useState(false);
  const [isTextNoteOpen, setIsTextNoteOpen] = useState(false);
  const [textNote, setTextNote] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isCameraDialogOpen, setIsCameraDialogOpen] = useState(false);
  const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false);
  const isMobile = useIsMobile();

  // --------------------------------------------------------------------------
  // Refs
  // --------------------------------------------------------------------------

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

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
   * Handle camera photo capture (ADR-311).
   * Desktop → WebRTC dialog. Mobile → native `capture` input.
   */
  const handleCameraCapture = useCallback(() => {
    if (!isMobile && supportsGetUserMedia()) {
      setIsOpen(false);
      setIsCameraDialogOpen(true);
      return;
    }
    cameraInputRef.current?.click();
  }, [isMobile]);

  /**
   * Handle video capture (ADR-311).
   * Desktop → WebRTC dialog. Mobile → native `capture` input.
   */
  const handleVideoCapture = useCallback(() => {
    if (!isMobile && supportsGetUserMedia()) {
      setIsOpen(false);
      setIsVideoDialogOpen(true);
      return;
    }
    videoInputRef.current?.click();
  }, [isMobile]);

  /**
   * Handle file coming from WebRTC camera dialog (photo or video).
   */
  const handleDialogCapture = useCallback(
    async (file: File, metadata: CaptureMetadata) => {
      await onCapture(file, metadata);
      setIsCameraDialogOpen(false);
      setIsVideoDialogOpen(false);
    },
    [onCapture]
  );

  /**
   * Handle audio recording start/stop
   */
  const handleAudioCapture = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      audioInputRef.current?.click();
      return;
    }

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      return;
    }

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

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      logger.error('Audio recording failed', { error });
      audioInputRef.current?.click();
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

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  const formatRecordingTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // --------------------------------------------------------------------------
  // Return
  // --------------------------------------------------------------------------

  return {
    isOpen,
    setIsOpen,
    isTextNoteOpen,
    setIsTextNoteOpen,
    textNote,
    setTextNote,
    isRecording,
    recordingTime,
    isCameraDialogOpen,
    setIsCameraDialogOpen,
    isVideoDialogOpen,
    setIsVideoDialogOpen,
    cameraInputRef,
    videoInputRef,
    audioInputRef,
    handleFileCapture,
    handleCameraCapture,
    handleVideoCapture,
    handleAudioCapture,
    handleDialogCapture,
    handleTextNoteSubmit,
    handleUploadClick,
    formatRecordingTime,
  };
}
