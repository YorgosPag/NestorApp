// ============================================================================
// ♿ ACCESSIBILITY UTILITIES - ENTERPRISE WCAG 2.1 AA COMPLIANCE
// ============================================================================
//
// 🎯 PURPOSE: Centralized accessibility utilities για focus management, keyboard navigation
// 🏢 STANDARDS: WCAG 2.1 AA, WAI-ARIA guidelines
// 📱 PLATFORM: Web, Mobile PWA support
//
// ============================================================================

import { useEffect, useRef, useCallback } from 'react';

// ============================================================================
// FOCUS MANAGEMENT UTILITIES
// ============================================================================

/**
 * ♿ Focusable Elements Selector
 * Comprehensive selector για όλα τα focusable elements
 */
export const FOCUSABLE_ELEMENTS_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  'details',
  '[tabindex]:not([tabindex="-1"])',
  'a[href]',
  'area[href]',
  'iframe',
  'object',
  'embed',
  '[contenteditable]',
  'audio[controls]',
  'video[controls]',
  'summary'
].join(',');

/**
 * ♿ Get Focusable Elements
 * Βρίσκει όλα τα focusable elements μέσα σε ένα container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENTS_SELECTOR)
  ).filter(element => {
    // Additional visibility checks
    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      !element.hasAttribute('aria-hidden') &&
      element.offsetParent !== null
    );
  });
}

/**
 * ♿ Focus First Element
 * Εστιάζει στο πρώτο focusable element
 */
export function focusFirstElement(container: HTMLElement): boolean {
  const focusableElements = getFocusableElements(container);
  if (focusableElements.length > 0) {
    focusableElements[0].focus();
    return true;
  }
  return false;
}

/**
 * ♿ Focus Last Element
 * Εστιάζει στο τελευταίο focusable element
 */
export function focusLastElement(container: HTMLElement): boolean {
  const focusableElements = getFocusableElements(container);
  if (focusableElements.length > 0) {
    focusableElements[focusableElements.length - 1].focus();
    return true;
  }
  return false;
}

// ============================================================================
// FOCUS TRAP HOOK - MODAL ACCESSIBILITY
// ============================================================================

/**
 * ♿ useFocusTrap Hook
 * Implements focus trapping για modals και dialogs
 *
 * Features:
 * - Focus trapping inside container
 * - Restore focus to trigger element
 * - Keyboard navigation (Tab, Shift+Tab, Escape)
 * - Auto-focus first element
 */
export interface FocusTrapOptions {
  autoFocus?: boolean;
  restoreFocus?: boolean;
  escapeDeactivates?: boolean;
  onEscape?: () => void;
}

export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  isActive: boolean,
  options: FocusTrapOptions = {}
) {
  const {
    autoFocus = true,
    restoreFocus = true,
    escapeDeactivates = true,
    onEscape
  } = options;

  const containerRef = useRef<T>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Store previously focused element
  useEffect(() => {
    if (isActive) {
      previousActiveElementRef.current = document.activeElement as HTMLElement;
    }
  }, [isActive]);

  // Focus management
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;

    // Auto-focus first element
    if (autoFocus) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        focusFirstElement(container);
      }, 10);
    }

    // Keyboard event handler
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        handleTabNavigation(event, container);
      } else if (event.key === 'Escape' && escapeDeactivates) {
        event.preventDefault();
        if (onEscape) {
          onEscape();
        }
      }
    };

    // Focus containment for clicks outside
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if (!container.contains(target)) {
        // Focus escaped container, bring it back
        focusFirstElement(container);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);

      // Restore focus when trap deactivates
      if (restoreFocus && previousActiveElementRef.current) {
        try {
          previousActiveElementRef.current.focus();
        } catch (error) {
          // Element might be removed from DOM, fallback to body
          document.body.focus();
        }
      }
    };
  }, [isActive, autoFocus, restoreFocus, escapeDeactivates, onEscape]);

  return containerRef;
}

/**
 * ♿ Handle Tab Navigation
 * Implements circular tab navigation within container
 */
function handleTabNavigation(event: KeyboardEvent, container: HTMLElement) {
  const focusableElements = getFocusableElements(container);

  if (focusableElements.length === 0) {
    event.preventDefault();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const activeElement = document.activeElement;

  if (event.shiftKey) {
    // Shift + Tab (backward)
    if (activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    }
  } else {
    // Tab (forward)
    if (activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }
}

// ============================================================================
// KEYBOARD NAVIGATION UTILITIES
// ============================================================================

/**
 * ♿ Arrow Key Navigation Hook
 * Implements arrow key navigation για lists και grids
 */
export interface ArrowNavigationOptions {
  orientation?: 'vertical' | 'horizontal' | 'grid';
  loop?: boolean;
  onSelect?: (index: number) => void;
}

export function useArrowNavigation(
  isActive: boolean,
  itemsLength: number,
  options: ArrowNavigationOptions = {}
) {
  const {
    orientation = 'vertical',
    loop = true,
    onSelect
  } = options;

  const containerRef = useRef<HTMLElement>(null);
  const currentIndexRef = useRef<number>(-1);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const { key } = event;
      let newIndex = currentIndexRef.current;

      // Handle different orientations
      if (orientation === 'vertical') {
        if (key === 'ArrowDown') {
          event.preventDefault();
          newIndex = getNextIndex(newIndex, itemsLength, 1, loop);
        } else if (key === 'ArrowUp') {
          event.preventDefault();
          newIndex = getNextIndex(newIndex, itemsLength, -1, loop);
        }
      } else if (orientation === 'horizontal') {
        if (key === 'ArrowRight') {
          event.preventDefault();
          newIndex = getNextIndex(newIndex, itemsLength, 1, loop);
        } else if (key === 'ArrowLeft') {
          event.preventDefault();
          newIndex = getNextIndex(newIndex, itemsLength, -1, loop);
        }
      }

      // Handle Enter και Space για selection
      if ((key === 'Enter' || key === ' ') && currentIndexRef.current >= 0) {
        event.preventDefault();
        if (onSelect) {
          onSelect(currentIndexRef.current);
        }
      }

      // Update focus if index changed
      if (newIndex !== currentIndexRef.current) {
        currentIndexRef.current = newIndex;
        focusElementAtIndex(containerRef.current!, newIndex);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, itemsLength, orientation, loop, onSelect]);

  return {
    containerRef,
    setCurrentIndex: (index: number) => {
      currentIndexRef.current = index;
    }
  };
}

/**
 * ♿ Get Next Index με Loop Support
 */
function getNextIndex(
  currentIndex: number,
  length: number,
  direction: number,
  loop: boolean
): number {
  let newIndex = currentIndex + direction;

  if (loop) {
    if (newIndex >= length) newIndex = 0;
    if (newIndex < 0) newIndex = length - 1;
  } else {
    if (newIndex >= length) newIndex = length - 1;
    if (newIndex < 0) newIndex = 0;
  }

  return newIndex;
}

/**
 * ♿ Focus Element at Index
 */
function focusElementAtIndex(container: HTMLElement, index: number) {
  const focusableElements = getFocusableElements(container);
  if (focusableElements[index]) {
    focusableElements[index].focus();
  }
}

// ============================================================================
// SCREEN READER UTILITIES
// ============================================================================

/**
 * ♿ Announce to Screen Readers
 * Δημιουργεί live region για screen reader announcements
 */
export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
) {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.setAttribute('class', 'sr-only');
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * ♿ Screen Reader Only CSS Class
 * Utility function για screen reader only content
 */
export const SCREEN_READER_ONLY_STYLES = {
  position: 'absolute' as const,
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap' as const,
  border: '0'
};

// ============================================================================
// ARIA UTILITIES
// ============================================================================

/**
 * ♿ Generate Unique ID για ARIA
 */
let idCounter = 0;
export function generateId(prefix = 'accessibility-id'): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * ♿ ARIA Live Region Hook
 * Manages live regions για dynamic content updates
 */
export function useAriaLiveRegion(level: 'polite' | 'assertive' = 'polite') {
  const regionRef = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string) => {
    if (regionRef.current) {
      regionRef.current.textContent = message;
    }
  }, []);

  const createLiveRegion = useCallback(() => {
    if (!regionRef.current) {
      const region = document.createElement('div');
      region.setAttribute('aria-live', level);
      region.setAttribute('aria-atomic', 'true');
      region.style.position = 'absolute';
      region.style.left = '-10000px';
      region.style.width = '1px';
      region.style.height = '1px';
      region.style.overflow = 'hidden';
      document.body.appendChild(region);
      regionRef.current = region;
    }
    return regionRef.current;
  }, [level]);

  return { announce, createLiveRegion };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  useFocusTrap,
  useArrowNavigation,
  useAriaLiveRegion,
  getFocusableElements,
  focusFirstElement,
  focusLastElement,
  announceToScreenReader,
  generateId,
  FOCUSABLE_ELEMENTS_SELECTOR,
  SCREEN_READER_ONLY_STYLES
};
