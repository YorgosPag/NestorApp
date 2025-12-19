
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText } from "lucide-react";
import type { ObligationDocument } from "@/types/obligations";

interface BasicInfoCardProps {
  obligation: ObligationDocument;
  updateObligation: (field: keyof ObligationDocument, value: any) => void;
}

export function BasicInfoCard({ obligation, updateObligation }: BasicInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Βασικά Στοιχεία
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="title">Τίτλος</Label>
            <Input
              id="title"
              value={obligation.title}
              onChange={(e) => updateObligation('title', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="status">Κατάσταση</Label>
            <Select
              value={obligation.status}
              onValueChange={(value: 'draft' | 'completed' | 'approved') =>
                updateObligation('status', value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Προσχέδιο</SelectItem>
                <SelectItem value="completed">Ολοκληρωμένο</SelectItem>
                <SelectItem value="approved">Εγκεκριμένο</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="project">Όνομα Έργου</Label>
            <Input
              id="project"
              value={obligation.projectName}
              onChange={(e) => updateObligation('projectName', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="contractor">Εργολάβος</Label>
            <Input
              id="contractor"
              value={obligation.contractorCompany}
              onChange={(e) => updateObligation('contractorCompany', e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
