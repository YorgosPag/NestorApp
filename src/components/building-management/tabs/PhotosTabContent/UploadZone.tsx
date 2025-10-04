'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Camera } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface UploadZoneProps {
  isUploading: boolean;
  uploadProgress: number;
  onFileUpload: (files: FileList | null) => void;
}

export function UploadZone({ isUploading, uploadProgress, onFileUpload }: UploadZoneProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Φωτογραφίες Κτιρίου</h3>
        <Button asChild>
          <Label className="cursor-pointer">
            <Upload className="w-4 h-4 mr-2" />
            Ανέβασμα Φωτογραφιών
            <input 
              type="file" 
              multiple 
              accept="image/*"
              className="hidden" 
              onChange={(e) => onFileUpload(e.target.files)}
            />
          </Label>
        </Button>
      </div>

      <div 
        className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer bg-muted/20 hover:bg-primary/10"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFileUpload(e.dataTransfer.files);
        }}
      >
        <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-lg font-medium text-foreground mb-2">Σύρετε φωτογραφίες εδώ</p>
        <p className="text-sm text-muted-foreground">ή κάντε κλικ για επιλογή αρχείων</p>
      </div>

      {isUploading && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Ανέβασμα σε εξέλιξη...</p>
                <Progress value={uploadProgress} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">{uploadProgress}% ολοκληρώθηκε</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
