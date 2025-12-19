
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CommonBadge } from "@/core/badges";
import type { ObligationDocument } from "@/types/obligations";
import { sanitizeHtml } from "../utils/html-sanitize";
import { sortSections } from "../utils/sort";
import { cn } from "@/lib/utils";

interface DocumentViewProps {
  obligation: ObligationDocument;
}

export function DocumentView({ obligation }: DocumentViewProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="h-[1200px]">
          <div className="p-8">
            {/* Sections */}
            <div className="space-y-8">
              {sortSections(obligation.sections || []).map((section) => (
                <div key={section.id} id={`section-${section.id}`} className="space-y-4">
                  {/* Section Header */}
                  <div className="border-b-2 border-red-600 pb-2">
                    <div className="flex items-center gap-3 mb-2">
                      <CommonBadge
                        status="company"
                        customLabel={`Άρθρο ${section.number}°`}
                        variant="outline"
                        className="font-mono"
                      />
                      <CommonBadge
                        status="company"
                        customLabel={section.category.toUpperCase()}
                        variant="secondary"
                        className="text-xs"
                      />
                    </div>
                    <h2 className="text-xl font-bold text-red-700 uppercase tracking-wide">{section.title}</h2>
                  </div>

                  {/* Section Content */}
                  {section.content && (
                    <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed">
                      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.content.replace(/\n/g, '<br />')) }} />
                    </div>
                  )}

                  {/* Articles */}
                  {section.articles && section.articles.length > 0 && (
                    <div className="space-y-6 ml-4">
                      {section.articles.map((article) => (
                        <div key={article.id} id={`article-${article.id}`} className="space-y-3 border-l-4 border-green-300 pl-4">
                          <div className="flex items-center gap-3">
                            <CommonBadge
                              status="company"
                              customLabel={article.number}
                              variant="outline"
                              className="font-mono text-sm"
                            />
                            <h3 className="text-lg font-semibold text-gray-900">{article.title}</h3>
                          </div>

                          {article.content && (
                            <div className="prose prose-sm max-w-none text-gray-700">
                              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content.replace(/\n/g, '<br />')) }} />
                            </div>
                          )}

                          {/* Paragraphs */}
                          {article.paragraphs && article.paragraphs.length > 0 && (
                            <div className="space-y-3 ml-6">
                              {article.paragraphs.map((paragraph) => (
                                <div key={paragraph.id} id={`paragraph-${paragraph.id}`} className="flex gap-3 text-sm text-gray-700">
                                  <span className="font-mono text-gray-500 min-w-6">{paragraph.number}.</span>
                                  <div className="flex-1">
                                    <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(paragraph.content.replace(/\n/g, '<br />')) }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Document Footer */}
            <div className="mt-16 pt-8 border-t text-center text-sm text-gray-500">
              <div className="space-y-2">
                <div><strong>{obligation.contractorCompany}</strong></div>
                <div>{obligation.projectDetails?.address || 'Διεύθυνση Εταιρείας'}</div>
                <div>Τηλ: +30 210 XXXXXXX | Email: info@company.gr</div>
                <div className="mt-4 text-xs">Συγγραφή Υποχρεώσεων - {new Date().toLocaleDateString('el-GR')}</div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
