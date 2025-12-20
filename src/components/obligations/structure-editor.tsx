"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2 } from "lucide-react";
import type { ObligationSection, TableOfContentsItem } from "@/types/obligations";
import { createNewSection } from "@/types/obligations";

interface StructureEditorProps {
  sections: ObligationSection[];
  onSectionsChange: (sections: ObligationSection[]) => void;
  activeItemId?: string;
  onActiveItemChange?: (item: TableOfContentsItem | null) => void;
}

export default function StructureEditor({
  sections,
  onSectionsChange,
  activeItemId,
  onActiveItemChange,
}: StructureEditorProps) {

  const addNewSection = () => {
    const newSection = createNewSection(sections.length + 1);
    onSectionsChange([...sections, newSection]);
  };

  const removeSection = (sectionId: string) => {
    const updatedSections = sections.filter(section => section.id !== sectionId);
    onSectionsChange(updatedSections);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {sections.length === 0 ? 'Δεν υπάρχουν ενότητες' : `${sections.length} ενότητες`}
        </div>
        <Button onClick={addNewSection} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Προσθήκη Ενότητας
        </Button>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sections.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground mb-4">
                Δεν υπάρχουν ενότητες. Προσθέστε την πρώτη ενότητα για να ξεκινήσετε.
              </p>
              <Button onClick={addNewSection} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Προσθήκη Ενότητας
              </Button>
            </CardContent>
          </Card>
        ) : (
          sections.map((section, index) => (
            <Card
              key={section.id}
              className={`border ${activeItemId === section.id ? 'border-primary' : 'border-border'}`}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-base">
                      {section.number}. {section.title || `Ενότητα ${index + 1}`}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {section.articles?.length || 0} άρθρα
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onActiveItemChange?.({ type: 'section', id: section.id })}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeSection(section.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {section.content && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {section.content}
                  </p>
                </CardContent>
              )}

              {section.articles && section.articles.length > 0 && (
                <CardContent className="pt-0">
                  <div className="space-y-1">
                    {section.articles.map((article) => (
                      <div key={article.id} className="flex items-center text-sm p-2 rounded border bg-muted/30">
                        <span className="font-medium">Άρθρο {article.number}:</span>
                        <span className="ml-2 text-muted-foreground">
                          {article.title || 'Χωρίς τίτλο'}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}