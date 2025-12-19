
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CommonBadge } from "@/core/badges";
import { Separator } from "@/components/ui/separator";
import { Settings } from "lucide-react";
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="h-5 w-5" />
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
                <p className="text-xs text-gray-500">Αυτόματος πίνακας με navigation links</p>
              </div>
            </label>
            <label className="flex items-center gap-3">
              <input aria-label="Συμπερίληψη αρίθμησης σελίδων" type="checkbox" checked={exportOptions.includePageNumbers} onChange={(e) => onChange({ ...exportOptions, includePageNumbers: e.target.checked })} className="rounded" />
              <div>
                <span className="text-sm font-medium">Αρίθμηση Σελίδων</span>
                <p className="text-xs text-gray-500">Footer με αριθμούς σελίδων και στοιχεία</p>
              </div>
            </label>
            <label className="flex items-center gap-3">
              <input aria-label="Συμπερίληψη λογότυπου" type="checkbox" checked={exportOptions.includeLogo} onChange={(e) => onChange({ ...exportOptions, includeLogo: e.target.checked })} className="rounded" />
              <div>
                <span className="text-sm font-medium">Λογότυπο Εταιρείας</span>
                <p className="text-xs text-gray-500">Προσθήκη λογοτύπου στο header</p>
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
                        <p className="text-xs text-gray-500">Βασική μορφοποίηση, μικρότερο μέγεθος</p>
                    </div>
                </label>
                <label className="flex items-center gap-3">
                    <input aria-label="Ποιότητα High" type="radio" name="quality" checked={exportOptions.quality === "high"} onChange={() => onChange({ ...exportOptions, quality: "high" })} className="rounded-full" />
                    <div>
                        <span className="text-sm font-medium">Υψηλή Ποιότητα</span>
                        <p className="text-xs text-gray-500">Βελτιωμένα περιθώρια και typography</p>
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
              <div className="flex justify-between"><span className="text-gray-600">Ενότητες:</span><CommonBadge status="company" customLabel={contentSummary.sections.toString()} variant="outline" /></div>
              <div className="flex justify-between"><span className="text-gray-600">Άρθρα:</span><CommonBadge status="company" customLabel={contentSummary.articles.toString()} variant="outline" /></div>
              <div className="flex justify-between"><span className="text-gray-600">Παράγραφοι:</span><CommonBadge status="company" customLabel={contentSummary.paragraphs.toString()} variant="outline" /></div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-gray-600">Λέξεις:</span><CommonBadge status="company" customLabel={contentSummary.words.toLocaleString("el-GR")} variant="outline" /></div>
              <div className="flex justify-between"><span className="text-gray-600">Ανάγνωση:</span><CommonBadge status="company" customLabel={`${contentSummary.readingTime} λεπτά`} variant="outline" /></div>
              <div className="flex justify-between"><span className="text-gray-600">Εκτιμώμενες σελίδες:</span><CommonBadge status="company" customLabel={`~${Math.ceil(contentSummary.words / 300)}`} variant="outline" /></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
