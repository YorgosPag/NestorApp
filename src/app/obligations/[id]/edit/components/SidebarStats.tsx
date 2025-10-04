
"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ObligationDocument } from "@/types/obligations";
import { formatDate } from "@/lib/obligations-utils";

interface SidebarStatsProps {
  obligation: ObligationDocument;
}

export function SidebarStats({ obligation }: SidebarStatsProps) {
    
  const stats = useMemo(() => {
    return {
      sectionsCount: obligation.sections.length,
      requiredCount: obligation.sections.filter(s => s.isRequired).length,
      ownersCount: obligation.owners.length,
    };
  }, [obligation]);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Στατιστικά</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Σύνολο άρθρων</span>
          <Badge variant="outline">{stats.sectionsCount}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Απαραίτητα</span>
          <Badge variant="outline">{stats.requiredCount}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Ιδιοκτήτες</span>
          <Badge variant="outline">{stats.ownersCount}</Badge>
        </div>
        <Separator />
        <div className="text-xs text-gray-500">
          <div>Δημιουργήθηκε: {formatDate(obligation.createdAt)}</div>
          <div>Ενημερώθηκε: {formatDate(obligation.updatedAt)}</div>
        </div>
      </CardContent>
    </Card>
  );
}
