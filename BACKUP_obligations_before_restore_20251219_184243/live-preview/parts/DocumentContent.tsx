"use client";

import { CommonBadge } from "@/core/badges";
import { FileText } from "lucide-react";
import type { ObligationDocument } from '@/types/obligations';
import { cn } from "@/lib/utils";

interface DocumentContentProps {
    doc: Partial<ObligationDocument>;
    activeItemId?: string;
}

export function DocumentContent({ doc, activeItemId }: DocumentContentProps) {
  const sections = doc.sections || [];

  if (sections.length === 0) {
    return (
      <div className="text-center py-16">
        <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-500 mb-2">Δεν υπάρχει περιεχόμενο</h3>
        <p className="text-sm text-gray-400">Προσθέστε ενότητες στον editor για να δείτε την προεπισκόπηση</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6">
      {sections.map((section) => (
        <div
          key={section.id}
          id={`preview-${section.id}`}
          className={cn("space-y-4", activeItemId === section.id && "ring-2 ring-blue-500 ring-opacity-50 rounded-lg p-4 -m-4")}
        >
          <div className="border-b-2 border-red-600 pb-2">
            <div className="flex items-center gap-3 mb-2">
              <CommonBadge
                status="company"
                customLabel={`Άρθρο ${section.number}°`}
                variant="outline"
                className="font-mono"
              />
              {section.category && (
                <CommonBadge
                  status="company"
                  customLabel={String(section.category).toUpperCase()}
                  variant="secondary"
                  className="text-xs"
                />
              )}
            </div>
            <h2 className="text-xl font-bold text-red-700 uppercase tracking-wide">{section.title}</h2>
          </div>
          {section.content && <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: section.content.replace(/\n/g, "<br />") }} />}
          {section.articles?.map((article) => (
            <div key={article.id} id={`preview-${article.id}`} className={cn("space-y-3 border-l-4 border-green-300 pl-4", activeItemId === article.id && "border-l-green-500 bg-green-50 -ml-2 pl-6 py-3 rounded-r")}>
              <div className="flex items-center gap-3">
                <CommonBadge
                  status="company"
                  customLabel={article.number}
                  variant="outline"
                  className="font-mono text-sm"
                />
                <h3 className="text-lg font-semibold text-gray-900">{article.title}</h3>
              </div>
              {article.content && <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: article.content.replace(/\n/g, "<br />") }} />}
              {article.paragraphs?.map((paragraph) => (
                <div key={paragraph.id} id={`preview-${paragraph.id}`} className={cn("flex gap-3 text-sm text-gray-700", activeItemId === paragraph.id && "bg-yellow-50 -ml-3 pl-3 py-2 rounded")}>
                  <span className="font-mono text-gray-500 min-w-6">{paragraph.number}.</span>
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
