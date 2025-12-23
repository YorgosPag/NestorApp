
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';

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
  const iconSizes = useIconSizes();
  const isComplete = progress === 100;
  
  if (isComplete) {
    return (
      <Card className="bg-accent/20 border-accent/40">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <CheckCircle className={`${iconSizes.md} text-accent-foreground`} />
            <div>
              <h4 className="font-medium text-foreground">Επιτυχία</h4>
              <p className="text-sm text-muted-foreground">Το PDF δημιουργήθηκε επιτυχώς.</p>
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
            <Loader2 className={`${iconSizes.md} animate-spin text-primary`} />
            <div>
              <h4 className="font-medium">Δημιουργία PDF...</h4>
              <p className="text-sm text-muted-foreground">{getProgressMessage(progress)}</p>
            </div>
          </div>
          <Progress value={progress} className="w-full" />
          <div className="text-center text-sm text-muted-foreground">{progress}% ολοκληρώθηκε</div>
        </div>
      </CardContent>
    </Card>
  );
}
