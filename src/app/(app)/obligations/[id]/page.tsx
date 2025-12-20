
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PageLayout } from "@/components/app/page-layout";
import { useObligation } from "./view/hooks/useObligation";
import { HeaderBar } from "./view/components/HeaderBar";
import { DocumentSidebar } from "./view/components/Sidebar";
import { DocumentView } from "./view/components/DocumentView";
import { getContentSummary } from "@/lib/obligations-utils";

export default function ObligationViewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const id = params.id;

  const { obligation, loading, error } = useObligation(id);

  const contentSummary = useMemo(() => {
    if (!obligation) return null;
    return getContentSummary(obligation);
  }, [obligation]);
  
  if (loading) {
    return (
      <PageLayout>
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Φόρτωση συγγραφής υποχρεώσεων...</p>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (error || !obligation) {
    return (
      <PageLayout>
        <div className="container mx-auto py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-destructive mb-4">Σφάλμα</h1>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Επιστροφή
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }
  
  return (
    <PageLayout>
      <div className="container mx-auto py-8 max-w-7xl">
        <HeaderBar obligation={obligation} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
          <aside className="lg:col-span-1 space-y-6">
            <DocumentSidebar obligation={obligation} contentSummary={contentSummary} />
          </aside>

          <main className="lg:col-span-3">
            <DocumentView obligation={obligation} />
          </main>
        </div>
      </div>
    </PageLayout>
  );
}

