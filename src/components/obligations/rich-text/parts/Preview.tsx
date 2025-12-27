"use client";

import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface PreviewProps {
  html: string;
  placeholder: string;
  minHeight: number;
  maxHeight: number;
}

export function Preview({ html, placeholder, minHeight, maxHeight }: PreviewProps) {
  const colors = useSemanticColors();
  // DEBUG: Log what HTML we receive
  console.log('Preview component received HTML:', html);

  // SSR Guard
  if (typeof window === 'undefined') {
    return (
      <div 
        style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }} 
        className={cn("prose prose-sm max-w-none p-4 border rounded-md overflow-y-auto", colors.bg.secondary)}
      >
        <p className="text-gray-400 italic">Η προεπισκόπηση είναι διαθέσιμη μόνο στον browser.</p>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "prose prose-sm max-w-none p-4 border rounded-md overflow-y-auto",
        colors.bg.secondary,
        "prose-headings:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700",
        "prose-strong:text-gray-900 prose-em:text-gray-600"
      )}
      style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
    >
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="text-gray-400 italic">{placeholder}</p>
      )}
    </div>
  );
}
