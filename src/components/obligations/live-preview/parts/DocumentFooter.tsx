"use client";

interface DocumentFooterProps {
  sectionsCount: number;
  articlesCount: number;
  paragraphsCount: number;
  zoomDisplay: number;
}

export function DocumentFooter({ sectionsCount, articlesCount, paragraphsCount, zoomDisplay }: DocumentFooterProps) {
  return (
    <div className="flex items-center justify-between p-4 border-t bg-muted/30 text-sm text-muted-foreground">
      <div>
        {sectionsCount} ενότητες • {articlesCount} άρθρα • {paragraphsCount} παράγραφοι
      </div>
      <div className="flex items-center gap-2">
        <span>Ζουμ: {zoomDisplay}%</span>
      </div>
    </div>
  );
}
