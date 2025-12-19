
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building } from "lucide-react";
import type { ProjectDetails } from "@/types/obligations";
import { useCallback } from "react";

interface ProjectDetailsCardProps {
  projectDetails: ProjectDetails;
  updateProjectDetails: (field: keyof ProjectDetails, value: any) => void;
}

export function ProjectDetailsCard({ projectDetails, updateProjectDetails }: ProjectDetailsCardProps) {
    
  const handleUpdate = useCallback((field: keyof ProjectDetails, value: string) => {
    updateProjectDetails(field, value);
  }, [updateProjectDetails]);
    
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Building className="h-4 w-4" />
          Στοιχεία Έργου
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="location" className="text-xs">Τοποθεσία</Label>
          <Input
            id="location"
            className="h-8"
            value={projectDetails?.location || ''}
            onChange={(e) => handleUpdate('location', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="address" className="text-xs">Διεύθυνση</Label>
          <Textarea
            id="address"
            rows={2}
            value={projectDetails?.address || ''}
            onChange={(e) => handleUpdate('address', e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
