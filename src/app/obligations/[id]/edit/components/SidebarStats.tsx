
"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CommonBadge } from "@/core/badges";
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
        <dl className="space-y-4">
          <div className="flex items-center justify-between">
            <dt className="text-sm text-muted-foreground">Σύνολο άρθρων</dt>
            <dd>
              <CommonBadge
                status="company"
                customLabel={stats.sectionsCount.toString()}
                variant="outline"
              />
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-muted-foreground">Απαραίτητα</dt>
            <dd>
              <CommonBadge
                status="company"
                customLabel={stats.requiredCount.toString()}
                variant="outline"
              />
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-muted-foreground">Ιδιοκτήτες</dt>
            <dd>
              <CommonBadge
                status="company"
                customLabel={stats.ownersCount.toString()}
                variant="outline"
              />
            </dd>
          </div>
        </dl>
        <Separator />
        <footer className="text-xs text-muted-foreground">
          <div>Δημιουργήθηκε: <time dateTime={obligation.createdAt}>{formatDate(obligation.createdAt)}</time></div>
          <div>Ενημερώθηκε: <time dateTime={obligation.updatedAt}>{formatDate(obligation.updatedAt)}</time></div>
        </footer>
      </CardContent>
    </Card>
  );
}
