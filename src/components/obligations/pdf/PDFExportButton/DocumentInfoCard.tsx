
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CommonBadge } from "@/core/badges";
import { FileText } from "lucide-react";
import type { ObligationDocument } from "@/types/obligations";

interface DocumentInfoCardProps {
  document: ObligationDocument;
}

export function DocumentInfoCard({ document }: DocumentInfoCardProps) {
  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-blue-900">
              {document.title}
            </h4>
            <p className="text-sm text-blue-700">{document.projectName}</p>
            <p className="text-xs text-blue-600 mt-1">
              {document.contractorCompany}
            </p>
          </div>
          <CommonBadge
            status="company"
            customLabel={
              document.status === "draft" ? "📝 Προσχέδιο" :
              document.status === "completed" ? "✅ Ολοκληρωμένο" :
              document.status === "approved" ? "🔐 Εγκεκριμένο" : ""
            }
            variant="outline"
            className="text-blue-700 border-blue-300"
          />
        </div>
      </CardContent>
    </Card>
  );
}
