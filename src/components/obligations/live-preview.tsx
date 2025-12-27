"use client";

import { useState, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ObligationDocument, TableOfContentsItem } from '@/types/obligations';
import { cn } from "@/lib/utils";
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors";

import { PreviewHeader } from './live-preview/parts/PreviewHeader';
import { DocumentHeader } from './live-preview/parts/DocumentHeader';
import { TableOfContentsPart } from './live-preview/parts/TableOfContents';
import { DocumentContent } from './live-preview/parts/DocumentContent';
import { DocumentFooter } from './live-preview/parts/DocumentFooter';

import { useToc } from './live-preview/hooks/useToc';
import { useCounters } from './live-preview/hooks/useCounters';
import { useScale } from './live-preview/hooks/useScale';
import { scrollToPreviewId } from './live-preview/utils/ids';

interface LivePreviewProps {
  document: Partial<ObligationDocument>;
  activeItemId?: string;
  onItemClick?: (item: { type: 'section' | 'article' | 'paragraph'; id: string }) => void;
  viewMode?: 'preview' | 'print';
  zoom?: number;
  className?: string;
}

export function LivePreview({
  document: doc,
  activeItemId,
  onItemClick,
  viewMode = "preview",
  zoom = 100,
  className,
}: LivePreviewProps) {
  const colors = useSemanticColors();
  const [showToc, setShowToc] = useState(true);

  const tableOfContents = useToc(doc);
  const { sectionsCount, articlesCount, paragraphsCount } = useCounters(doc.sections || []);
  const { scale, zoomDisplay } = useScale(zoom);

  const handleTocItemClick = useCallback(
    (tocItem: TableOfContentsItem) => {
      onItemClick?.({ type: tocItem.type, id: tocItem.id });
      scrollToPreviewId(tocItem.id);
    },
    [onItemClick]
  );
  
  const handlePrint = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }, []);

  return (
    <div className={cn(colors.bg.primary, className)}>
      <PreviewHeader 
        showToc={showToc}
        onToggleToc={() => setShowToc(prev => !prev)}
        onPrint={handlePrint}
      />
      
      <ScrollArea className="h-[600px]">
        <div className="flex justify-center py-4">
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top center",
              width: `${100 / scale}%`,
            }}
          >
            <div className="max-w-4xl mx-auto bg-card shadow-sm">
              <DocumentHeader doc={doc} />
              
              <TableOfContentsPart 
                toc={tableOfContents}
                activeItemId={activeItemId}
                onClick={handleTocItemClick}
                show={showToc}
              />
              
              <DocumentContent 
                doc={doc}
                activeItemId={activeItemId}
              />
            </div>
          </div>
        </div>
      </ScrollArea>
      
      <DocumentFooter
        sectionsCount={sectionsCount}
        articlesCount={articlesCount}
        paragraphsCount={paragraphsCount}
        zoomDisplay={zoomDisplay}
      />
    </div>
  );
}

// Export variants
export function PrintPreview(props: Omit<LivePreviewProps, "viewMode">) {
  return <LivePreview {...props} viewMode="print" />;
}

export function CompactPreview(props: LivePreviewProps) {
  return (
    <div className="max-h-96 overflow-hidden">
      <LivePreview {...props} />
    </div>
  );
}

// Default export for backward compatibility
export default LivePreview;
