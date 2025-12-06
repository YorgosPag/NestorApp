// ============================================================================
// CONTACT FORM HOOKS - MAIN MODULE INDEX
// ============================================================================
//
// 🏢 Enterprise Contact Form Hooks System - Centralized Access Point
// Single entry point for all contact form hook functionalities
//
// 🎯 ENTERPRISE ARCHITECTURE BENEFITS:
// - Tree-shaking optimization (import only what you need)
// - Clear separation of concerns (core vs files vs photos vs interactions)
// - Enhanced maintainability (focused hooks)
// - Better developer experience (organized imports)
// - Single Responsibility Principle (SRP) compliance
//
// 📋 USAGE EXAMPLES:
//
// // Complete orchestrated solution (legacy compatibility):
// import { useContactFormState } from '@/hooks/contactForm';
//
// // Modular approach (recommended for new code):
// import { useFormState, useFileUploads, usePhotoSelection } from '@/hooks/contactForm';
//
// // Category-specific imports:
// import { useFormState } from '@/hooks/contactForm/core';
// import { useFileUploads } from '@/hooks/contactForm/files';
// import { usePhotoSelection } from '@/hooks/contactForm/photos';
// import { useDragAndDrop } from '@/hooks/contactForm/interactions';
//
// ============================================================================

// =============================================================================
// CORE EXPORTS - 🏗️ Basic form state and reset functionality
// =============================================================================
export {
  useFormState,
  useFormReset,
  type UseFormStateReturn,
  type UseFormResetReturn
} from './core';

// =============================================================================
// FILES EXPORTS - 📁 File upload and management functionality
// =============================================================================
export {
  useFileUploads,
  useUploadCompletion,
  useMemoryCleanup,
  type UseFileUploadsReturn,
  type UseUploadCompletionReturn,
  type UseMemoryCleanupReturn
} from './files';

// =============================================================================
// PHOTOS EXPORTS - 📸 Photo selection and management functionality
// =============================================================================
export {
  usePhotoSelection,
  type UsePhotoSelectionReturn
} from './photos';

// =============================================================================
// INTERACTIONS EXPORTS - 🎭 User interaction functionality
// =============================================================================
export {
  useDragAndDrop,
  type UseDragAndDropReturn
} from './interactions';

// =============================================================================
// ORCHESTRATOR EXPORTS - 🎼 Main orchestrated hook (legacy compatibility)
// =============================================================================
export {
  useContactFormState,
  type UseContactFormStateReturn
} from './modular/orchestrator';

// =============================================================================
// CONVENIENCE RE-EXPORTS - Most commonly used hooks in grouped format
// =============================================================================

// Primary hooks by category (for clear intent)
export const ContactFormHooks = {
  // Core functionality
  core: {
    useFormState,
    useFormReset
  },
  // File handling
  files: {
    useFileUploads,
    useUploadCompletion,
    useMemoryCleanup
  },
  // Photo management
  photos: {
    usePhotoSelection
  },
  // User interactions
  interactions: {
    useDragAndDrop
  },
  // Main orchestrator
  orchestrator: {
    useContactFormState
  }
};

// =============================================================================
// MODULE METADATA
// =============================================================================

export const MODULE_INFO = {
  name: 'Contact Form Hooks',
  version: '2.0.0',
  architecture: 'Enterprise Modular',
  migration: {
    from: 'useContactFormState.ts (466 lines monolithic)',
    to: 'Modular hooks architecture (8 focused modules)',
    benefits: [
      'Single Responsibility Principle',
      'Better testability',
      'Tree-shaking optimization',
      'Enhanced maintainability',
      'Clear separation of concerns'
    ]
  },
  compatibility: {
    backward: '100% (re-exports from orchestrator)',
    forward: 'Modular imports recommended'
  }
} as const;