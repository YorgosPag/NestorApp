"use client";

import { cn } from '@/lib/utils';
import { layoutUtilities } from '@/styles/design-tokens';

interface PreviewProps {
  html: string;
  placeholder: string;
  minHeight: number;
  maxHeight: number;
}

export function Preview({ html, placeholder, minHeight, maxHeight }: PreviewProps) {
  // SSR Guard
  if (typeof window === 'undefined') {
    return (
      <div
        style={layoutUtilities.cssVars.interactive.heightRange(minHeight, maxHeight)}
        className="prose prose-sm max-w-none p-4 border rounded-md bg-gray-50 overflow-y-auto"
      >
        <p className="text-gray-400 italic">Η προεπισκόπηση είναι διαθέσιμη μόνο στον browser.</p>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "prose prose-sm max-w-none p-4 border rounded-md bg-gray-50 overflow-y-auto",
        "prose-headings:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700",
        "prose-strong:text-gray-900 prose-em:text-gray-600"
      )}
      style={layoutUtilities.cssVars.interactive.heightRange(minHeight, maxHeight)}
    >
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="text-gray-400 italic">{placeholder}</p>
      )}
    </div>
  );
}
