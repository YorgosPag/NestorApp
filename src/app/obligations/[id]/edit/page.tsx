
"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Eye, ArrowLeft, Loader2 } from "lucide-react";
import toast from 'react-hot-toast';

import { useObligation } from "./hooks/useObligation";
import { useUnsavedChangesWarning } from "./hooks/useUnsavedWarning";

import { PageLayout } from "@/components/app/page-layout";
import { BasicInfoCard } from "./components/BasicInfoCard";
import { OwnersCard } from "./components/OwnersCard";
import { SectionsCard } from "./components/SectionsCard";
import { SidebarStats } from "./components/SidebarStats";
import { ProjectDetailsCard } from "./components/ProjectDetailsCard";
import { getStatusLabel } from "@/lib/obligations-utils";
import type { ObligationDocument } from "@/types/obligations";

export default function EditObligationPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const id = params.id;
  
  const { obligation, setObligation, loading, error, saveObligation } = useObligation(id);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useUnsavedChangesWarning(hasUnsavedChanges);

  const updateObligationField = useCallback(<K extends keyof ObligationDocument>(
    field: K,
    value: ObligationDocument[K]
  ) => {
    setObligation((prev) => {
        if (!prev) return null;
        return { ...prev, [field]: value };
    });
    setHasUnsavedChanges(true);
  }, [setObligation]);
  
  const updateProjectDetailsField = useCallback((
      field: keyof ObligationDocument['projectDetails'],
      value: any
  ) => {
      setObligation((prev) => {
          if(!prev) return null;
          return {
              ...prev,
              projectDetails: {
                  ...(prev.projectDetails ?? {}),
                  [field]: value
              }
          }
      });
      setHasUnsavedChanges(true);
  }, [setObligation]);

  const handleSave = async () => {
    if (!obligation) return;
    
    setIsSaving(true);
    const success = await saveObligation();
    
    if (success) {
      setHasUnsavedChanges(false);
      toast.success('Η συγγραφή υποχρεώσεων αποθηκεύτηκε επιτυχώς!');
    } else {
      toast.error("Σφάλμα κατά την αποθήκευση. Παρακαλώ δοκιμάστε ξανά.");
    }
    setIsSaving(false);
  };

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Φόρτωση συγγραφής υποχρεώσεων...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error || !obligation) {
    return (
      <PageLayout>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Σφάλμα</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Επιστροφή
          </Button>
        </div>
      </PageLayout>
    );
  }
  
  return (
    <PageLayout>
      <div className="max-w-6xl mx-auto py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Επεξεργασία Συγγραφής Υποχρεώσεων
              </h1>
              <p className="text-muted-foreground mt-1">
                {obligation.title} • {getStatusLabel(obligation.status)}
                {hasUnsavedChanges && (
                  <Badge variant="outline" className="ml-2 text-orange-600">
                    Μη αποθηκευμένες αλλαγές
                  </Badge>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.push(`/obligations/${id}`)}>
              <Eye className="h-4 w-4 mr-2" />
              Προεπισκόπηση
            </Button>
            <Button onClick={handleSave} disabled={!hasUnsavedChanges || isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isSaving ? "Αποθήκευση..." : "Αποθήκευση"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <BasicInfoCard
              obligation={obligation}
              updateObligation={updateObligationField}
            />
            <OwnersCard
              owners={obligation.owners}
              updateOwners={(newOwners) => updateObligationField('owners', newOwners)}
            />
            <SectionsCard
              sections={obligation.sections}
              updateSections={(newSections) => updateObligationField('sections', newSections)}
            />
          </div>

          <aside className="space-y-6">
            <SidebarStats obligation={obligation} />
            <ProjectDetailsCard
              projectDetails={obligation.projectDetails}
              updateProjectDetails={updateProjectDetailsField}
            />
          </aside>
        </div>
      </div>
    </PageLayout>
  );
}

    