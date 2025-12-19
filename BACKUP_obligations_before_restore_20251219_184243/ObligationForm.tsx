"use client";

import React, { useState, useCallback } from 'react';
import { PageLayout } from "@/components/app/page-layout";
import { PageHeader } from '@/core/headers';
import { Button } from "@/components/ui/button";
import { FileText, Save, ArrowLeft, PanelLeftOpen, PanelRightOpen, Maximize } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ObligationDocument } from "@/types/obligations";
import StructureEditor from './structure-editor/StructureEditor';
import LivePreview from './live-preview';
import { HOVER_BACKGROUND_EFFECTS, TRANSITION_PRESETS } from '@/components/ui/effects';

export const ObligationForm = () => {
  const router = useRouter();

  // View state
  const [viewMode, setViewMode] = useState<'split' | 'editor' | 'preview'>('split');
  const [activeItemId, setActiveItemId] = useState<string | undefined>();

  // Document state
  const [obligation, setObligation] = useState<ObligationDocument>({
    id: `new-${Date.now()}`,
    title: 'Νέα Συγγραφή Υποχρεώσεων',
    projectName: '',
    contractorCompany: '',
    owners: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'draft',
    sections: [],
    projectDetails: {
      location: '',
      address: '',
      plotNumber: '',
      buildingPermitNumber: '',
      contractDate: undefined,
      deliveryDate: undefined,
      notaryName: ''
    },
    tableOfContents: []
  });

  const handleSectionsChange = useCallback((sections: any[]) => {
    setObligation(prev => ({
      ...prev,
      sections,
      updatedAt: new Date()
    }));
  }, []);

  const handleSave = async () => {
    console.log('Saving obligation:', obligation);
    router.push('/obligations');
  };

  const toggleViewMode = () => {
    setViewMode(prev => {
      switch (prev) {
        case 'split': return 'editor';
        case 'editor': return 'preview';
        case 'preview': return 'split';
        default: return 'split';
      }
    });
  };

  const getViewIcon = () => {
    switch (viewMode) {
      case 'split': return <PanelLeftOpen className="h-4 w-4 mr-2" />;
      case 'editor': return <FileText className="h-4 w-4 mr-2" />;
      case 'preview': return <Maximize className="h-4 w-4 mr-2" />;
      default: return <PanelLeftOpen className="h-4 w-4 mr-2" />;
    }
  };

  const getViewLabel = () => {
    switch (viewMode) {
      case 'split': return 'Split View';
      case 'editor': return 'Μόνο Επεξεργασία';
      case 'preview': return 'Μόνο Προβολή';
      default: return 'Split View';
    }
  };

  return (
    <PageLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-full mx-auto">
        <PageHeader
          variant="static"
          layout="stacked"
          title={{
            icon: FileText,
            title: obligation.title || "Νέα Συγγραφή Υποχρεώσεων",
            subtitle: "Επεξεργασία συγγραφής υποχρεώσεων με δομημένα άρθρα"
          }}
          actions={{
            customActions: [
              <Button
                key="back"
                variant="outline"
                onClick={() => router.back()}
                className={`${HOVER_BACKGROUND_EFFECTS.MUTED} ${TRANSITION_PRESETS.COLORS}`}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Επιστροφή
              </Button>,
              <Button
                key="view-toggle"
                variant="outline"
                onClick={toggleViewMode}
                className={`${HOVER_BACKGROUND_EFFECTS.MUTED} ${TRANSITION_PRESETS.COLORS}`}
              >
                {getViewIcon()}
                {getViewLabel()}
              </Button>,
              <Button
                key="save"
                onClick={handleSave}
                className={`${HOVER_BACKGROUND_EFFECTS.PRIMARY} ${TRANSITION_PRESETS.COLORS}`}
              >
                <Save className="h-4 w-4 mr-2" />
                Αποθήκευση
              </Button>
            ]
          }}
        />

        <div className="flex gap-6 h-[calc(100vh-200px)]">
          {/* Structure Editor */}
          {(viewMode === 'split' || viewMode === 'editor') && (
            <div className={viewMode === 'split' ? 'flex-1' : 'w-full'}>
              <StructureEditor
                sections={obligation.sections}
                onSectionsChange={handleSectionsChange}
                onActiveItemChange={setActiveItemId}
                activeItemId={activeItemId}
              />
            </div>
          )}

          {/* Live Preview */}
          {(viewMode === 'split' || viewMode === 'preview') && (
            <div className={viewMode === 'split' ? 'flex-1' : 'w-full'}>
              <LivePreview
                document={obligation}
                activeItemId={activeItemId}
                onItemClick={({ id }) => setActiveItemId(id)}
              />
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default ObligationForm;