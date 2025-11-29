"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeProgressBar } from "@/core/progress/ThemeProgressBar";
import { User, Building2, Landmark } from "lucide-react";

export function ContactDistribution() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Κατανομή Επαφών</CardTitle>
        <CardDescription>Ανάλυση ανά τύπο επαφής</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Φυσικά Πρόσωπα</span>
              </div>
              <span className="text-sm text-muted-foreground">
                856 (68.6%)
              </span>
            </div>
            <ThemeProgressBar
              progress={68.6}
              label=""
              size="sm"
              showPercentage={false}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Νομικά Πρόσωπα</span>
              </div>
              <span className="text-sm text-muted-foreground">312 (25%)</span>
            </div>
            <ThemeProgressBar
              progress={25}
              label=""
              size="sm"
              showPercentage={false}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Δημόσιες Υπηρεσίες</span>
              </div>
              <span className="text-sm text-muted-foreground">79 (6.4%)</span>
            </div>
            <ThemeProgressBar
              progress={6.4}
              label=""
              size="sm"
              showPercentage={false}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
