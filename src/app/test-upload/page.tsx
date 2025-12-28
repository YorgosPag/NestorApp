'use client';

import { useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { ThemeProgressBar } from '@/core/progress/ThemeProgressBar';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export default function TestUploadPage() {
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult('');
      setError('');
    }
  };

  const testUpload = async () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError('');
    setResult('');

    try {
      // 🔧 FIX: Try root level upload first
      const fileName = `test_${Date.now()}_${file.name}`;
      const storagePath = fileName; // Root level upload
      const storageRef = ref(storage, storagePath);

      console.log('🧪 TEST: Starting direct upload...', {
        fileName: file.name,
        fileSize: file.size,
        storagePath
      });

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progressPercent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(Math.round(progressPercent));
          console.log(`🧪 TEST: Upload progress: ${Math.round(progressPercent)}%`);
        },
        (error) => {
          console.error('🧪 TEST: Upload error:', error);
          setError(`Upload failed: ${error.message}`);
          setUploading(false);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            console.log('🧪 TEST: Upload successful!', downloadURL);
            setResult(`✅ Success! URL: ${downloadURL}`);
            setUploading(false);
          } catch (error) {
            console.error('🧪 TEST: Failed to get download URL:', error);
            setError('Failed to get download URL');
            setUploading(false);
          }
        }
      );

    } catch (error) {
      console.error('🧪 TEST: Upload initialization failed:', error);
      setError(`Upload failed: ${error}`);
      setUploading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🧪 Firebase Storage Upload Test</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Select a file to test upload:
          </label>
          <input
            type="file"
            onChange={handleFileSelect}
            accept="image/*"
            className={`block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold ${INTERACTIVE_PATTERNS.FILE_INPUT}`}
          />
        </div>

        {file && (
          <div className={`p-4 ${colors.bg.hover} rounded`}>
            <p><strong>File:</strong> {file.name}</p>
            <p><strong>Size:</strong> {Math.round(file.size / 1024)} KB</p>
            <p><strong>Type:</strong> {file.type}</p>
          </div>
        )}

        <button
          onClick={testUpload}
          disabled={!file || uploading}
          className={`px-4 py-2 ${colors.bg.info} text-white rounded disabled:opacity-50 disabled:cursor-not-allowed`}>
          {uploading ? `Uploading... ${progress}%` : 'Test Upload'}
        </button>

        {uploading && (
          <ThemeProgressBar
            progress={progress}
            label="Upload Progress"
            size="md"
            showPercentage={true}
          />
        )}

        {error && (
          <div className={`p-4 ${colors.bg.error}/10 ${getStatusBorder('error')} rounded ${colors.text.error}`}>
            ❌ {error}
          </div>
        )}

        {result && (
          <div className={`p-4 ${colors.bg.success}/10 ${getStatusBorder('success')} rounded ${colors.text.success}`}>
            {result}
          </div>
        )}

        <div className="text-sm text-gray-600 mt-6">
          <p><strong>Purpose:</strong> This page tests direct Firebase Storage upload without the complex contact form logic.</p>
          <p><strong>If this works:</strong> The issue is in our contact form upload handling.</p>
          <p><strong>If this fails:</strong> The issue is with Firebase Storage configuration/connectivity.</p>
        </div>
      </div>
    </div>
  );
}