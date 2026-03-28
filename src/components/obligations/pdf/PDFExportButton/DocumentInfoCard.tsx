
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import type { ObligationDocument } from "@/types/obligations";
import '@/lib/design-system';

interface DocumentInfoCardProps {
  document: ObligationDocument;
}

export function DocumentInfoCard({ document }: DocumentInfoCardProps) {
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const colors = useSemanticColors();
  return (
    <Card className={`bg-primary/10 ${quick.info}`}>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <FileText className={`${iconSizes.md} text-primary mt-0.5`} />
          <div className="flex-1">
            <h4 className="font-medium text-foreground">
              {document.title}
            </h4>
            <p className="text-sm text-foreground">{document.projectName}</p>
            <p className={cn("text-xs mt-1", colors.text.muted)}>
              {document.contractorCompany}
            </p>
          </div>
          <Badge variant="outline" className={`text-primary ${quick.info}`}>
            {document.status === "draft" && "📝 Προσχέδιο"}
            {document.status === "completed" && "✅ Ολοκληρωμένο"}
            {document.status === "approved" && "🔐 Εγκεκριμένο"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

