"use client";

export function getPreviewId(id: string): string {
  return `preview-${id}`;
}

export function scrollToPreviewId(id: string): void {
  if (typeof window === 'undefined') return;

  const elementId = getPreviewId(id);
  const element = window.document.getElementById(elementId);
  
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
