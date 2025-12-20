
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import type { ObligationDocument } from "@/types/obligations";

interface DocumentInfoCardProps {
  document: ObligationDocument;
}

export function DocumentInfoCard({ document }: DocumentInfoCardProps) {
  return (
    <Card className="bg-primary/10 border-primary/20">
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-foreground">
              {document.title}
            </h4>
            <p className="text-sm text-foreground">{document.projectName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {document.contractorCompany}
            </p>
          </div>
          <Badge variant="outline" className="text-primary border-primary/30">
            {document.status === "draft" && "📝 Προσχέδιο"}
            {document.status === "completed" && "✅ Ολοκληρωμένο"}
            {document.status === "approved" && "🔐 Εγκεκριμένο"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
