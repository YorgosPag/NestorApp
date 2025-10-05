'use client';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StorageErrorHandler, StorageManager } from '../utils/storage-utils';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { AlertTriangle, HardDrive, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isStorageError: boolean;
  storageInfo: {
    usage: number;
    quota: number;
    available: number;
  } | null;
}

export class StorageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isStorageError: false,
      storageInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    const isStorageError = StorageErrorHandler.isStorageError(error);
    
    return {
      hasError: true,
      error,
      isStorageError,
      storageInfo: null,
    };
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('StorageErrorBoundary caught an error:', error, errorInfo);
    
    if (StorageErrorHandler.isStorageError(error)) {
      try {
        const storageInfo = await StorageManager.checkStorageQuota();
        this.setState({ storageInfo });
      } catch (e) {
        console.error('Could not get storage info:', e);
      }
    }
  }

  handleClearStorage = async () => {
    try {
      await StorageManager.clearAllStorage();
      toast.success('✅ Storage καθαρίστηκε! Ανανεώνω τη σελίδα...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Error clearing storage:', error);
      toast.error('❌ Σφάλμα κατά τον καθαρισμό. Δοκιμάστε manual καθαρισμό από browser settings.');
    }
  };

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      isStorageError: false,
      storageInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      if (this.state.isStorageError) {
        return (
          <div className="flex items-center justify-center min-h-[400px] p-4">
            <Card className="w-full max-w-md">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-amber-500" />
                  <CardTitle className="text-lg">Storage Γεμάτο</CardTitle>
                </div>
                <CardDescription>
                  Το browser storage είναι γεμάτο και δεν μπορεί να αποθηκεύσει νέα δεδομένα.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {this.state.storageInfo && (
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                    <div className="font-semibold mb-2">📊 Storage Usage:</div>
                    <div>Χρησιμοποιημένο: {StorageManager.formatBytes(this.state.storageInfo.usage)}</div>
                    <div>Συνολικό: {StorageManager.formatBytes(this.state.storageInfo.quota)}</div>
                    <div>Διαθέσιμο: {StorageManager.formatBytes(this.state.storageInfo.available)}</div>
                  </div>
                )}
                
                <div className="text-sm text-gray-700">
                  <p className="mb-2">Για να συνεχίσετε, χρειάζεται να καθαρίσουμε το cached data:</p>
                  <ul className="list-disc list-inside text-xs space-y-1 ml-2">
                    <li>Cached DXF files</li>
                    <li>Temporary levels data</li>
                    <li>Browser IndexedDB</li>
                    <li>Application cache</li>
                  </ul>
                  <p className="mt-2 font-semibold text-xs">
                    ⚠️ Τα αποθηκευμένα projects δεν θα επηρεαστούν.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={this.handleClearStorage}
                    className="flex-1 flex items-center gap-2"
                    variant="destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Καθαρισμός Storage
                  </Button>
                  <Button 
                    onClick={this.handleRetry}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </Button>
                </div>

                <div className="text-xs text-gray-500 pt-2 border-t">
                  <p className="font-semibold">Manual λύση:</p>
                  <p>Chrome: Settings → Privacy → Clear browsing data → Advanced</p>
                  <p>Firefox: Settings → Privacy → Clear Data</p>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      // Generic error fallback
      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <CardTitle className="text-lg">Σφάλμα DXF Viewer</CardTitle>
              </div>
              <CardDescription>
                Κάτι πήγε στραβά με το DXF Viewer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm bg-red-50 p-3 rounded border border-red-200">
                <div className="font-mono text-xs text-red-800">
                  {this.state.error?.message || 'Unknown error'}
                </div>
              </div>
              
              <Button 
                onClick={this.handleRetry}
                className="w-full flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Προσπάθεια Ξανά
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook για monitoring storage
export function useStorageMonitor() {
  const [storageInfo, setStorageInfo] = React.useState<{
    usage: number;
    quota: number;
    available: number;
  } | null>(null);

  const checkStorage = React.useCallback(async () => {
    try {
      const info = await StorageManager.checkStorageQuota();
      setStorageInfo(info);
      
      // Warn if storage is getting full (>80%)
      if (info.quota > 0 && (info.usage / info.quota) > 0.8) {
        console.warn('⚠️ Storage is getting full:', StorageManager.formatBytes(info.available), 'remaining');
      }
    } catch (error) {
      console.error('Could not check storage:', error);
    }
  }, []);

  React.useEffect(() => {
    checkStorage();
    
    // Check storage every 30 seconds
    const interval = setInterval(checkStorage, 30000);
    return () => clearInterval(interval);
  }, [checkStorage]);

  return { storageInfo, checkStorage };
}