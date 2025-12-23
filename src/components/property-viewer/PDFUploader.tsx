'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, Check, X, AlertTriangle, Loader2 } from 'lucide-react';

// Simple Firebase imports
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { HOVER_BORDER_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';

interface SimplePDFUploaderProps {
  currentFloor: { id: string; name: string; buildingId: string } | null;
  onPDFUpdate: (floorId: string, pdfUrl: string) => void;
  className?: string;
}

export function SimplePDFUploader({ currentFloor, onPDFUpdate, className }: SimplePDFUploaderProps) {
  const iconSizes = useIconSizes();
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset function
  const resetState = () => {
    setIsUploading(false);
    setProgress(0);
    setError(null);
    setSuccess(false);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle dialog open/close
  const handleDialogOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetState();
    }
  };

  // File validation
  const validateFile = (file: File): string | null => {
    console.log('Validating file:', file.name, file.type, file.size);
    
    if (file.type !== 'application/pdf') {
      return 'Μόνο αρχεία PDF επιτρέπονται';
    }
    if (file.size > 50 * 1024 * 1024) { // 50MB
      return 'Το αρχείο είναι πολύ μεγάλο (μέγιστο 50MB)';
    }
    return null;
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('File selected:', file);
    setError(null);
    setSuccess(false);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSelectedFile(file);
  };

  // Simple upload function
  const handleUpload = async () => {
    if (!selectedFile || !currentFloor) {
      setError('Δεν έχει επιλεγεί αρχείο ή όροφος');
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      console.log('Starting upload for floor:', currentFloor.id);
      
      // Create file path
      const timestamp = Date.now();
      const fileName = `${timestamp}_${selectedFile.name}`;
      const filePath = `floor-plans/${currentFloor.buildingId}/${currentFloor.id}/${fileName}`;
      
      console.log('Upload path:', filePath);
      
      // Create storage reference
      const storageRef = ref(storage, filePath);
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);
      
      // Upload file
      console.log('Uploading to Firebase Storage...');
      const snapshot = await uploadBytes(storageRef, selectedFile);
      console.log('Upload completed:', snapshot);
      
      // Get download URL
      console.log('Getting download URL...');
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('Download URL:', downloadURL);
      
      // Clear progress interval and set to 100%
      clearInterval(progressInterval);
      setProgress(100);
      
      // Success
      setSuccess(true);
      setIsUploading(false);
      
      // Notify parent
      onPDFUpdate(currentFloor.id, downloadURL);
      
      // Auto close after 2 seconds
      setTimeout(() => {
        handleDialogOpenChange(false);
      }, 2000);
      
    } catch (error: any) {
      console.error('Upload error:', error);
      setIsUploading(false);
      setProgress(0);
      
      // User-friendly error messages
      let errorMessage = 'Σφάλμα κατά την αποστολή του αρχείου';
      
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'Δεν έχετε δικαίωμα να ανεβάσετε αρχεία. Ελέγξτε τις ρυθμίσεις Firebase.';
      } else if (error.code === 'storage/canceled') {
        errorMessage = 'Η αποστολή ακυρώθηκε';
      } else if (error.code === 'storage/quota-exceeded') {
        errorMessage = 'Δεν υπάρχει αρκετός χώρος αποθήκευσης';
      } else if (error.message) {
        errorMessage = `Σφάλμα: ${error.message}`;
      }
      
      setError(errorMessage);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  if (!currentFloor) {
    return (
      <Button variant="ghost" size="sm" disabled className={className}>
        <Upload className={iconSizes.sm} />
      </Button>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className={className} aria-label="Ανέβασμα PDF κάτοψης">
          <Upload className={iconSizes.sm} />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className={iconSizes.md} />
            Ανέβασμα PDF Κάτοψης
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Floor Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Όροφος: {currentFloor.name}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                ID: {currentFloor.id}
              </p>
              <p className="text-xs text-muted-foreground">
                Κτίριο: {currentFloor.buildingId}
              </p>
            </CardContent>
          </Card>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className={iconSizes.sm} />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {success && (
            <Alert className="border-green-200 bg-green-50">
              <Check className={`${iconSizes.sm} text-green-600`} />
              <AlertDescription className="text-green-700">
                Η κάτοψη ανέβηκε επιτυχώς!
              </AlertDescription>
            </Alert>
          )}

          {/* File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Upload Area */}
          {!selectedFile && !isUploading && !success && (
            <div
              onClick={triggerFileSelect}
              className={`border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer ${HOVER_BORDER_EFFECTS.GRAY} transition-colors`}
            >
              <Upload className={`${iconSizes.xl2} mx-auto mb-2 text-muted-foreground`} />
              <p className="text-sm font-medium">Κλικ για επιλογή PDF</p>
              <p className="text-xs text-muted-foreground mt-1">
                Μόνο αρχεία PDF, μέγιστο 50MB
              </p>
            </div>
          )}

          {/* File Preview */}
          {selectedFile && !isUploading && !success && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <FileText className={`${iconSizes.xl2} text-red-500`} />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className={iconSizes.sm} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress */}
          {isUploading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Loader2 className={`${iconSizes.sm} animate-spin`} />
                  Ανέβασμα PDF...
                </span>
                <span className="font-mono">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              {selectedFile && (
                <p className="text-xs text-muted-foreground">
                  {selectedFile.name}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {selectedFile && !isUploading && !success && (
            <>
              <Button variant="outline" onClick={() => setSelectedFile(null)}>
                Ακύρωση
              </Button>
              <Button onClick={handleUpload}>
                <Upload className={`${iconSizes.sm} mr-2`} />
                Ανέβασμα
              </Button>
            </>
          )}
          
          {!selectedFile && !isUploading && !success && (
            <Button variant="outline" onClick={() => handleDialogOpenChange(false)}>
              Κλείσιμο
            </Button>
          )}

          {success && (
            <Button onClick={() => handleDialogOpenChange(false)}>
              <Check className={`${iconSizes.sm} mr-2`} />
              Τέλος
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}