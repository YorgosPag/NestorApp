'use client';

import React from 'react';
import { Building, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

interface BuildingsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function BuildingsError({ error, reset }: BuildingsErrorProps) {
  React.useEffect(() => {
    console.error('Buildings page error:', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Σφάλμα σελίδας κτιρίων</h1>
          <p className="text-muted-foreground mb-6">
            Προέκυψε ένα σφάλμα κατά τη φόρτωση της σελίδας διαχείρισης κτιρίων.
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="bg-muted p-4 rounded-lg mb-6">
            <details>
              <summary className="cursor-pointer font-medium mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Τεχνικές πληροφορίες σφάλματος
              </summary>
              <div className="mt-2 p-3 bg-background rounded border">
                <p className="text-sm font-mono text-muted-foreground break-words">
                  <strong>Error:</strong> {error.message}
                </p>
                {error.digest && (
                  <p className="text-sm font-mono text-muted-foreground mt-1">
                    <strong>Digest:</strong> {error.digest}
                  </p>
                )}
              </div>
            </details>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={reset}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Προσπαθήστε ξανά
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => window.history.back()}
              className="border border-input bg-background hover:bg-accent hover:text-accent-foreground px-6 py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Πίσω
            </button>

            <button
              onClick={() => window.location.href = '/'}
              className="border border-input bg-background hover:bg-accent hover:text-accent-foreground px-6 py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors"
            >
              Αρχική
            </button>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            Αν το πρόβλημα επιμένει, παρακαλώ επικοινωνήστε με τον διαχειριστή.
          </p>
        </div>
      </div>
    </main>
  );
}