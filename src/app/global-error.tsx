'use client';

/**
 * =============================================================================
 * GLOBAL ERROR BOUNDARY - ENTERPRISE ERROR HANDLING
 * =============================================================================
 *
 * @purpose Global error boundary για Next.js 15 App Router
 * @author Enterprise Architecture Team
 * @pattern Following existing buildings/error.tsx pattern
 *
 * This component:
 * - Catches unhandled errors globally across the app
 * - Provides user-friendly error UI με Greek text
 * - Logs errors στο console για debugging
 * - Shows technical details μόνο σε development mode
 *
 * @see Next.js 15 Error Handling: https://nextjs.org/docs/app/building-your-application/routing/error-handling
 * @enterprise SAP/Salesforce/Microsoft error handling standard
 * =============================================================================
 */

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global Error Boundary Component
 *
 * Catches errors που δεν πιάνονται από route-specific error boundaries.
 * Required για Next.js 15 Turbopack compatibility.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: Log error στο console για monitoring
  React.useEffect(() => {
    console.error('🚨 Global application error:', error);
  }, [error]);

  return (
    <html lang="el">
      <body>
        <main className={`min-h-screen ${colors.bg.primary} p-6 flex items-center justify-center`}>
          <div className="max-w-2xl w-full">
            {/* 🏢 ENTERPRISE: Semantic section for error display */}
            <section className="text-center mb-8">
              <div className={`w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4`}>
                <AlertTriangle className={`${iconSizes.xl} text-destructive`} />
              </div>
              <h1 className="text-3xl font-bold mb-3">Κάτι πήγε στραβά</h1>
              <p className="text-lg text-muted-foreground mb-2">
                Η εφαρμογή αντιμετώπισε ένα απροσδόκητο σφάλμα.
              </p>
              <p className="text-sm text-muted-foreground">
                Παρακαλώ δοκιμάστε να ανανεώσετε τη σελίδα ή να επιστρέψετε στην αρχική.
              </p>
            </section>

            {/* 🏢 ENTERPRISE: Development-only technical details */}
            {process.env.NODE_ENV === 'development' && (
              <section className="bg-muted p-4 rounded-lg mb-6">
                <details>
                  <summary className="cursor-pointer font-medium mb-2 flex items-center gap-2 hover:text-accent transition-colors">
                    <AlertTriangle className={`${iconSizes.sm} text-amber-500`} />
                    Τεχνικές πληροφορίες σφάλματος (Development Only)
                  </summary>
                  <div className={`mt-2 p-3 ${colors.bg.primary} rounded border border-border`}>
                    <p className="text-sm font-mono text-muted-foreground break-words mb-2">
                      <strong className="text-foreground">Error Message:</strong> {error.message}
                    </p>
                    {error.digest && (
                      <p className="text-sm font-mono text-muted-foreground mb-2">
                        <strong className="text-foreground">Error Digest:</strong> {error.digest}
                      </p>
                    )}
                    {error.stack && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                          Stack Trace
                        </summary>
                        <pre className="mt-2 text-xs overflow-x-auto p-2 bg-background rounded border">
                          {error.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                </details>
              </section>
            )}

            {/* 🏢 ENTERPRISE: User action buttons */}
            <section className="space-y-4">
              <button
                onClick={reset}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className={iconSizes.sm} />
                Προσπαθήστε ξανά
              </button>

              <button
                onClick={() => window.location.href = '/'}
                className={`w-full border border-input ${colors.bg.primary} hover:bg-accent hover:text-accent-foreground px-6 py-3 rounded-md font-medium flex items-center justify-center gap-2 transition-colors`}
              >
                <Home className={iconSizes.sm} />
                Επιστροφή στην Αρχική
              </button>
            </section>

            {/* 🏢 ENTERPRISE: Support message */}
            <footer className="mt-8 text-center text-sm text-muted-foreground">
              <p>
                Αν το πρόβλημα επιμένει, παρακαλώ επικοινωνήστε με τον διαχειριστή του συστήματος.
              </p>
            </footer>
          </div>
        </main>
      </body>
    </html>
  );
}
