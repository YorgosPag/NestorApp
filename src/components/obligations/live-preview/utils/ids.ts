"use client";

import { revealInScroll } from '@/lib/a11y/reveal-in-scroll';

export function getPreviewId(id: string): string {
  return `preview-${id}`;
}

export function scrollToPreviewId(id: string): void {
  if (typeof window === 'undefined') return;

  const elementId = getPreviewId(id);
  const element = window.document.getElementById(elementId);
  
  if (element) {
    revealInScroll(element, { urgency: 'requested', block: 'start' });
  }
}
