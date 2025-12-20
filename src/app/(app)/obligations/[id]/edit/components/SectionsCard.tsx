
"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CommonBadge } from "@/core/badges";
import { Settings, Plus, FileText, Trash2 } from "lucide-react";
import type { ObligationSection } from "@/types/obligations";
import { createNewSection } from "@/types/obligations";
import { sortSections } from "../utils/sections-sort";
import SectionEditor from "@/components/obligations/section-editor";
import { DEFAULT_TEMPLATE_SECTIONS } from '@/types/obligation-services';

interface SectionsCardProps {
  sections: ObligationSection[];
  updateSections: (newSections: ObligationSection[]) => void;
}

export function SectionsCard({ sections = [], updateSections }: SectionsCardProps) {
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // Ensure sections is always an array
  const safeSections = Array.isArray(sections) ? sections : [];

  const addSection = useCallback((templateSection?: ObligationSection) => {
    const newSection: ObligationSection = templateSection
      ? { ...templateSection, id: `section-${Date.now()}` }
      : createNewSection(safeSections.length);

    updateSections([...safeSections, newSection]);
    setEditingSectionId(newSection.id);
  }, [safeSections, updateSections]);

  const updateSection = useCallback((updatedSection: ObligationSection) => {
    const newSections = safeSections.map(section =>
      section.id === updatedSection.id ? updatedSection : section
    );
    updateSections(newSections);
    setEditingSectionId(null);
  }, [safeSections, updateSections]);

  const deleteSection = useCallback((sectionId: string) => {
    const newSections = safeSections.filter(section => section.id !== sectionId);
    updateSections(newSections);
    setEditingSectionId(null);
  }, [safeSections, updateSections]);

  const sorted = sortSections(safeSections);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Άρθρα Συγγραφής</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowTemplates(!showTemplates)}>
              <Settings className="h-4 w-4 mr-1" />
              Πρότυπα Άρθρα
            </Button>
            <Button onClick={() => addSection()} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Νέο Άρθρο
            </Button>
          </div>
        </div>

        {showTemplates && (
          <div className="mt-4 p-4 bg-muted/30 rounded-lg">
            <h4 className="font-medium mb-3">Επιλέξτε πρότυπο άρθρο:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {DEFAULT_TEMPLATE_SECTIONS.map((template) => (
                <Button
                  key={template.id}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    addSection(template);
                    setShowTemplates(false);
                  }}
                  className="text-left justify-start h-auto p-2"
                >
                  <div className="font-medium text-xs">Άρθρο {template.number}: {template.title}</div>
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {sorted.map((section) => (
            <AccordionItem key={section.id} value={section.id}>
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <CommonBadge
                    status="company"
                    customLabel={section.number.toString()}
                    variant="outline"
                  />
                  <span className="font-medium">{section.title}</span>
                  {section.isRequired && (
                    <CommonBadge
                      status="company"
                      customLabel="Απαραίτητο"
                      variant="destructive"
                      className="text-xs"
                    />
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {editingSectionId === section.id ? (
                  <SectionEditor
                    section={section}
                    onSave={updateSection}
                    onDelete={deleteSection}
                    onCancel={() => setEditingSectionId(null)}
                    isEditing={true}
                  />
                ) : (
                  <div>
                    <div className="prose max-w-none mb-4">
                      <div className="bg-muted/30 p-4 rounded-lg text-sm whitespace-pre-wrap">
                        {section.content || 'Δεν έχει προστεθεί περιεχόμενο ακόμα...'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => setEditingSectionId(section.id)}>
                        Επεξεργασία
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => {
                        if (window.confirm('Θέλετε να διαγράψετε αυτό το άρθρο;')) deleteSection(section.id);
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        {safeSections.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p>Δεν έχουν προστεθεί άρθρα ακόμα</p>
            <p className="text-sm">Κλικ "Νέο Άρθρο" για να ξεκινήσετε</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
