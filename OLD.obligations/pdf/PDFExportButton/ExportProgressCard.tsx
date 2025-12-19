
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle } from "lucide-react";

interface ExportProgressCardProps {
  progress: number;
}

const getProgressMessage = (progress: number): string => {
  if (progress < 30) return "Προετοιμασία περιεχομένου...";
  if (progress < 60) return "Μορφοποίηση εγγράφου...";
  if (progress < 90) return "Δημιουργία πίνακα περιεχομένων...";
  if (progress < 100) return "Τελική επεξεργασία...";
  return "Εξαγωγή ολοκληρώθηκε!";
};

export function ExportProgressCard({ progress }: ExportProgressCardProps) {
  const isComplete = progress === 100;
  
  if (isComplete) {
    return (
      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <h4 className="font-medium text-green-900">Επιτυχία</h4>
              <p className="text-sm text-green-700">Το PDF δημιουργήθηκε επιτυχώς.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <div>
              <h4 className="font-medium">Δημιουργία PDF...</h4>
              <p className="text-sm text-gray-600">{getProgressMessage(progress)}</p>
            </div>
          </div>
          <Progress value={progress} className="w-full" />
          <div className="text-center text-sm text-gray-500">{progress}% ολοκληρώθηκε</div>
        </div>
      </CardContent>
    </Card>
  );
}
