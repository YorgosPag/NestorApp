
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CommonBadge } from "@/core/badges";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Building, Users, Download, FileText } from "lucide-react";
import type { ObligationDocument } from "@/types/obligations";
import { formatDate } from "@/lib/obligations-utils";
import { TableOfContents } from "@/components/obligations/table-of-contents";
import PDFExportButton, { PrintButton } from "@/components/obligations/pdf-export-button";

interface DocumentSidebarProps {
  obligation: ObligationDocument;
  contentSummary: {
    sections: number;
    articles: number;
    paragraphs: number;
    words: number;
    readingTime: number;
  } | null;
}

export function DocumentSidebar({ obligation, contentSummary }: DocumentSidebarProps) {
  return (
    <div className="lg:col-span-1 space-y-6">
      {/* Document Info */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Στοιχεία Εγγράφου</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Building className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Έργο</p>
                <p className="text-sm text-muted-foreground">{obligation.projectName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Εργολάβος</p>
                <p className="text-sm text-muted-foreground">{obligation.contractorCompany}</p>
              </div>
            </div>
            {obligation.projectDetails?.location && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Τοποθεσία</p>
                  <p className="text-sm text-muted-foreground">{obligation.projectDetails.location}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Δημιουργήθηκε</p>
                <p className="text-sm text-muted-foreground">{formatDate(obligation.createdAt)}</p>
              </div>
            </div>
          </div>
          <Separator />
          {contentSummary && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Στατιστικά</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-center p-2 bg-primary/10 rounded"><div className="font-semibold text-primary">{contentSummary.sections}</div><div className="text-primary/80 text-xs">Ενότητες</div></div>
                <div className="text-center p-2 bg-accent/10 rounded"><div className="font-semibold text-accent-foreground">{contentSummary.articles}</div><div className="text-accent-foreground/80 text-xs">Άρθρα</div></div>
                <div className="text-center p-2 bg-muted/30 rounded"><div className="font-semibold text-foreground">{contentSummary.paragraphs}</div><div className="text-muted-foreground text-xs">Παράγραφοι</div></div>
                <div className="text-center p-2 bg-secondary/20 rounded"><div className="font-semibold text-foreground">{contentSummary.words.toLocaleString()}</div><div className="text-muted-foreground text-xs">Λέξεις</div></div>
              </div>
              <div className="text-center text-xs text-muted-foreground mt-2">
                Εκτιμώμενος χρόνος ανάγνωσης: {contentSummary.readingTime} λεπτά
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Owners */}
      {obligation.owners && obligation.owners.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Ιδιοκτήτες</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {obligation.owners.map((owner) => (
                <div key={owner.id} className="flex justify-between items-center">
                  <span className="text-sm">{owner.name}</span>
                  {owner.share && (
                    <CommonBadge
                      status="company"
                      customLabel={`${owner.share}%`}
                      variant="outline"
                      className="text-xs"
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table of Contents */}
      <TableOfContents items={obligation.tableOfContents || []} compact={true} />

      {/* Export Options */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2"><Download className="h-4 w-4" />Εξαγωγή</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PDFExportButton document={obligation} variant="outline" size="sm" className="w-full justify-start" />
          <PrintButton document={obligation} className="w-full justify-start" />
          <Button variant="outline" size="sm" className="w-full justify-start"><FileText className="h-4 w-4 mr-2" />Εξαγωγή Word</Button>
        </CardContent>
      </Card>
    </div>
  );
}
