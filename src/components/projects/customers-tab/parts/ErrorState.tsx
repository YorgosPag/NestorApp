import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Database, Wifi, Server, AlertCircle } from 'lucide-react';

interface ErrorStateProps {
  error: string;
  errorType?: 'NETWORK_ERROR' | 'DATABASE_ERROR' | 'VALIDATION_ERROR' | 'UNKNOWN_ERROR' | 'API_ERROR';
  canRetry?: boolean;
  onRetry?: () => void;
}

export function ErrorState({ error, errorType, canRetry = true, onRetry }: ErrorStateProps) {
  // 🔒 ENTERPRISE: Icon mapping based on error type
  const getErrorIcon = () => {
    switch (errorType) {
      case 'NETWORK_ERROR':
        return <Wifi className="w-12 h-12 mx-auto mb-2 text-orange-500" />;
      case 'DATABASE_ERROR':
        return <Database className="w-12 h-12 mx-auto mb-2 text-red-500" />;
      case 'API_ERROR':
        return <Server className="w-12 h-12 mx-auto mb-2 text-red-500" />;
      case 'VALIDATION_ERROR':
        return <AlertCircle className="w-12 h-12 mx-auto mb-2 text-yellow-500" />;
      default:
        return <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-red-500" />;
    }
  };

  // 🔒 ENTERPRISE: Context-aware error messages
  const getErrorContext = () => {
    switch (errorType) {
      case 'NETWORK_ERROR':
        return {
          title: 'Πρόβλημα Σύνδεσης',
          subtitle: 'Δεν ήταν δυνατή η σύνδεση με τον διακομιστή'
        };
      case 'DATABASE_ERROR':
        return {
          title: 'Πρόβλημα Βάσης Δεδομένων',
          subtitle: 'Προσωρινό πρόβλημα με τα δεδομένα'
        };
      case 'API_ERROR':
        return {
          title: 'Σφάλμα Διακομιστή',
          subtitle: 'Ο διακομιστής αντιμετωπίζει προσωρινά προβλήματα'
        };
      case 'VALIDATION_ERROR':
        return {
          title: 'Μη Έγκυρα Δεδομένα',
          subtitle: 'Παρακαλώ ελέγξτε τα δεδομένα και προσπαθήστε ξανά'
        };
      default:
        return {
          title: 'Σφάλμα Φόρτωσης',
          subtitle: 'Παρουσιάστηκε απρόσμενο πρόβλημα'
        };
    }
  };

  const errorContext = getErrorContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Πελάτες Έργου</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          {getErrorIcon()}

          <div className="space-y-2 mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              {errorContext.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {errorContext.subtitle}
            </p>
            <p className="text-sm text-muted-foreground">
              {error}
            </p>
          </div>

          {canRetry && onRetry && (
            <div className="flex flex-col items-center space-y-3">
              <Button
                onClick={onRetry}
                variant="outline"
                size="sm"
                className="inline-flex items-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Προσπάθεια Ξανά
              </Button>

              <p className="text-xs text-muted-foreground">
                Αν το πρόβλημα συνεχίζεται, επικοινωνήστε με την υποστήριξη
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}