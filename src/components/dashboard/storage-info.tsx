"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

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
          <Progress value={24} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Έχετε 7.6 GB διαθέσιμο χώρο για επαφές και αρχεία
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
