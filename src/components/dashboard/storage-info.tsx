"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeProgressBar } from "@/core/progress/ThemeProgressBar";

export function StorageInfo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Χώρος Αποθήκευσης</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Χρησιμοποιημένος</span>
            <span className="font-medium">2.4 GB / 10 GB</span>
          </div>
          <ThemeProgressBar
            progress={24}
            label=""
            size="sm"
            showPercentage={false}
          />
          <p className="text-xs text-muted-foreground">
            Έχετε 7.6 GB διαθέσιμο χώρο για επαφές και αρχεία
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
