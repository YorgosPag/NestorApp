
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import type { ExportOptions } from "./types";

interface ExportOptionsCardProps {
  exportOptions: ExportOptions;
  onChange: (newOptions: ExportOptions) => void;
  contentSummary: {
    sections: number;
    articles: number;
    paragraphs: number;
    words: number;
    readingTime: number;
  };
}

export function ExportOptionsCard({ exportOptions, onChange, contentSummary }: ExportOptionsCardProps) {
  const iconSizes = useIconSizes();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className={iconSizes.md} />
          Επιλογές Εξαγωγής
        </CardTitle>
        <CardDescription>
          Προσαρμόστε την εξαγωγή PDF σύμφωνα με τις ανάγκες σας
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Content Options */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Περιεχόμενο</h4>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input aria-label="Συμπερίληψη πίνακα περιεχομένων" type="checkbox" checked={exportOptions.includeTableOfContents} onChange={(e) => onChange({ ...exportOptions, includeTableOfContents: e.target.checked })} className="rounded" />
              <div>
                <span className="text-sm font-medium">Πίνακας Περιεχομένων</span>
                <p className="text-xs text-muted-foreground">Αυτόματος πίνακας με navigation links</p>
              </div>
            </label>
            <label className="flex items-center gap-3">
              <input aria-label="Συμπερίληψη αρίθμησης σελίδων" type="checkbox" checked={exportOptions.includePageNumbers} onChange={(e) => onChange({ ...exportOptions, includePageNumbers: e.target.checked })} className="rounded" />
              <div>
                <span className="text-sm font-medium">Αρίθμηση Σελίδων</span>
                <p className="text-xs text-muted-foreground">Footer με αριθμούς σελίδων και στοιχεία</p>
              </div>
            </label>
            <label className="flex items-center gap-3">
              <input aria-label="Συμπερίληψη λογότυπου" type="checkbox" checked={exportOptions.includeLogo} onChange={(e) => onChange({ ...exportOptions, includeLogo: e.target.checked })} className="rounded" />
              <div>
                <span className="text-sm font-medium">Λογότυπο Εταιρείας</span>
                <p className="text-xs text-muted-foreground">Προσθήκη λογοτύπου στο header</p>
              </div>
            </label>
          </div>
        </div>
        <Separator />
        {/* Quality Options */}
        <div className="space-y-4">
            <h4 className="font-medium text-sm">Ποιότητα & Μορφοποίηση</h4>
            <div className="space-y-2">
                <label className="flex items-center gap-3">
                    <input aria-label="Ποιότητα Standard" type="radio" name="quality" checked={exportOptions.quality === "standard"} onChange={() => onChange({ ...exportOptions, quality: "standard" })} className="rounded-full" />
                    <div>
                        <span className="text-sm font-medium">Στάνταρ</span>
                        <p className="text-xs text-muted-foreground">Βασική μορφοποίηση, μικρότερο μέγεθος</p>
                    </div>
                </label>
                <label className="flex items-center gap-3">
                    <input aria-label="Ποιότητα High" type="radio" name="quality" checked={exportOptions.quality === "high"} onChange={() => onChange({ ...exportOptions, quality: "high" })} className="rounded-full" />
                    <div>
                        <span className="text-sm font-medium">Υψηλή Ποιότητα</span>
                        <p className="text-xs text-muted-foreground">Βελτιωμένα περιθώρια και typography</p>
                    </div>
                </label>
            </div>
        </div>
        <Separator />
        {/* Document Metrics */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Προεπισκόπηση Εγγράφου</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Ενότητες:</span><Badge variant="outline">{contentSummary.sections}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Άρθρα:</span><Badge variant="outline">{contentSummary.articles}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Παράγραφοι:</span><Badge variant="outline">{contentSummary.paragraphs}</Badge></div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Λέξεις:</span><Badge variant="outline">{contentSummary.words.toLocaleString("el-GR")}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Ανάγνωση:</span><Badge variant="outline">{contentSummary.readingTime} λεπτά</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Εκτιμώμενες σελίδες:</span><Badge variant="outline">~{Math.ceil(contentSummary.words / 300)}</Badge></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
