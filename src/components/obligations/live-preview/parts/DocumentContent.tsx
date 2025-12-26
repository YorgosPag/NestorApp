"use client";

import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import type { ObligationDocument } from '@/types/obligations';
import { cn } from "@/lib/utils";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface DocumentContentProps {
    doc: Partial<ObligationDocument>;
    activeItemId?: string;
}

export function DocumentContent({ doc, activeItemId }: DocumentContentProps) {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const sections = doc.sections || [];

  if (sections.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className={`${iconSizes.xl4} mx-auto mb-4 text-muted-foreground`} />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">Δεν υπάρχει περιεχόμενο</h3>
        <p className="text-sm text-muted-foreground/70">Προσθέστε ενότητες στον editor για να δείτε την προεπισκόπηση</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      {sections.map((section) => (
        <div
          key={section.id}
          id={`preview-${section.id}`}
          className={cn("space-y-4", activeItemId === section.id && "ring-2 ring-primary ring-opacity-50 rounded-lg p-4 -m-4")}
        >
          <div className={`border-b-2 ${getStatusBorder('info')} pb-2`}>
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className="font-mono">Άρθρο {section.number}°</Badge>
              {section.category && <Badge variant="secondary" className="text-xs">{String(section.category).toUpperCase()}</Badge>}
            </div>
            <h2 className="text-xl font-bold text-primary uppercase tracking-wide">{section.title}</h2>
          </div>
          {section.content && <div className="prose prose-sm max-w-none text-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: section.content.replace(/\n/g, "<br />") }} />}
          {section.articles?.map((article) => (
            <div key={article.id} id={`preview-${article.id}`} className={cn("space-y-3 border-l-4 border-accent pl-4", activeItemId === article.id && "border-l-primary bg-accent/20 -ml-2 pl-6 py-3 rounded-r")}>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="font-mono text-sm">{article.number}</Badge>
                <h3 className="text-lg font-semibold text-foreground">{article.title}</h3>
              </div>
              {article.content && <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: article.content.replace(/\n/g, "<br />") }} />}
              {article.paragraphs?.map((paragraph) => (
                <div key={paragraph.id} id={`preview-${paragraph.id}`} className={cn("flex gap-3 text-sm text-foreground", activeItemId === paragraph.id && "bg-accent/30 -ml-3 pl-3 py-2 rounded")}>
                  <span className={`font-mono text-muted-foreground ${iconSizes.lg}`}>{paragraph.number}.</span>
                  <div className="flex-1" dangerouslySetInnerHTML={{ __html: paragraph.content.replace(/\n/g, "<br />") }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
