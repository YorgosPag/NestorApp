'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, Check, X, AlertTriangle, Loader2 } from 'lucide-react';

// Firebase imports
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { HOVER_BORDER_EFFECTS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface SimplePDFUploaderProps {
  currentFloor: { id: string; name: string; buildingId: string } | null;
  onPDFUpdate: (floorId: string, pdfUrl: string) => void;
  className?: string;
}

export function SimplePDFUploader({ currentFloor, onPDFUpdate, className }: SimplePDFUploaderProps) {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ensure Firebase Auth (Anonymous)
  const ensureAuth = async () => {
    const auth = getAuth();
    if (!auth.currentUser) {
      console.log('🔐 No user found, signing in anonymously...');
      const userCredential = await signInAnonymously(auth);
      console.log('✅ Anonymous user signed in:', userCredential.user.uid);
      return userCredential.user;
    } else {
      console.log('✅ User already signed in:', auth.currentUser.uid);
      return auth.currentUser;
    }
  };

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

  // Enhanced upload function with auth
  const handleUpload = async () => {
    if (!selectedFile || !currentFloor) {
      setError('Δεν έχει επιλεγεί αρχείο ή όροφος');
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setError(null);

    try {
      // ✅ ΚΡΙΣΙΜΟ: Ensure authentication before upload
      console.log('🔐 Ensuring authentication...');
      const user = await ensureAuth();
      console.log('✅ Authenticated user UID:', user.uid);
      
      console.log('Starting upload for floor:', currentFloor.id);

      // 🏢 ENTERPRISE: Fixed filename to prevent duplicates (Fortune 500 standard)
      const fileName = 'floorplan.pdf';
      const folderPath = `floor-plans/${currentFloor.buildingId}/${currentFloor.id}`;
      const filePath = `${folderPath}/${fileName}`;

      console.log('Upload path:', filePath);
      console.log('Storage bucket:', storage.app.options.storageBucket);

      // 🏢 ENTERPRISE: Delete existing files in folder before upload (prevent duplicates)
      console.log('🗑️ ENTERPRISE: Cleaning up existing files in folder...');
      try {
        const folderRef = ref(storage, folderPath);
        const existingFiles = await listAll(folderRef);

        if (existingFiles.items.length > 0) {
          console.log(`🗑️ Found ${existingFiles.items.length} existing file(s) - deleting...`);

          // Delete all existing files in parallel
          const deletePromises = existingFiles.items.map(async (fileRef) => {
            try {
              await deleteObject(fileRef);
              console.log(`✅ Deleted: ${fileRef.name}`);
            } catch (deleteError) {
              console.warn(`⚠️ Could not delete ${fileRef.name}:`, deleteError);
            }
          });

          await Promise.all(deletePromises);
          console.log('✅ ENTERPRISE: Folder cleanup completed');
        } else {
          console.log('✅ Folder is empty - no cleanup needed');
        }
      } catch (cleanupError) {
        // If folder doesn't exist, that's fine - continue with upload
        console.log('ℹ️ Folder may not exist yet - proceeding with upload');
      }

      // Create storage reference for the new file
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
      console.log('📤 Uploading to Firebase Storage...');
      const snapshot = await uploadBytes(storageRef, selectedFile);
      console.log('✅ Upload completed:', snapshot);
      
      // Get download URL
      console.log('🔗 Getting download URL...');
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('✅ PDF Download URL:', downloadURL);
      
      // Validate URL format
      if (!downloadURL || !downloadURL.includes('firebasestorage.googleapis.com')) {
        throw new Error('Invalid download URL format received');
      }
      
      // Clear progress interval and set to 100%
      clearInterval(progressInterval);
      setProgress(100);
      
      // Success
      setSuccess(true);
      setIsUploading(false);
      
      // Call parent callback with URL
      console.log('✅ Calling onPDFUpdate with URL:', downloadURL);
      onPDFUpdate(currentFloor.id, downloadURL);
      
      // Auto close after 2 seconds
      setTimeout(() => {
        handleDialogOpenChange(false);
      }, 2000);
      
    } catch (error: any) {
      console.error('❌ Upload error:', error);
      setIsUploading(false);
      setProgress(0);
      
      // Enhanced error handling
      let errorMessage = 'Σφάλμα κατά την αποστολή του αρχείου';
      
      if (error.code === 'storage/unauthorized') {
        errorMessage = 'Δεν έχετε δικαίωμα να ανεβάσετε αρχεία. Πρόβλημα με authentication.';
        console.error('❌ Auth state:', getAuth().currentUser?.uid || 'NO USER');
      } else if (error.code === 'storage/canceled') {
        errorMessage = 'Η αποστολή ακυρώθηκε';
      } else if (error.code === 'storage/quota-exceeded') {
        errorMessage = 'Δεν υπάρχει αρκετός χώρος αποθήκευσης';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Anonymous authentication δεν είναι ενεργοποιημένη';
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
              <p className="text-xs text-green-600">
                🔐 Auto-authentication ενεργό
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
            <Alert className={`${getStatusBorder('success')} ${colors.bg.success}`}>
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
              className={`${useBorderTokens().createBorder('medium', 'hsl(var(--muted-foreground))', 'dashed')} rounded-lg p-8 text-center cursor-pointer ${HOVER_BORDER_EFFECTS.GRAY} transition-colors`}
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