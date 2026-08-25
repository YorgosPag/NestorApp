/**
 * Το σχήμα της απάντησης του διαγνωστικού συνδεσιμότητας (CHECK 4 — ADR-585).
 *
 * Ζει χωριστά ώστε το `route.ts` να μείνει **σύνορο** και όχι υλοποίηση: το όριο
 * των 300 γραμμών για API routes υπάρχει ακριβώς για να μη γίνεται ένα route
 * «το αρχείο όπου ζει το χαρακτηριστικό».
 *
 * @module api/floors/diagnostic/types
 */

export interface FirestoreDiagnosticResult {
  timestamp: string;
  summary: {
    overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'FAILED';
    criticalIssues: string[];
    recommendedActions: string[];
  };
  connection: {
    status: 'CONNECTED' | 'FAILED' | 'UNKNOWN';
    latency?: number;
    errorMessage?: string;
  };
  environment: {
    hasRequiredVars: boolean;
    missingVars: string[];
    collections: Record<string, string>;
  };
  collections: {
    [key: string]: {
      accessible: boolean;
      documentCount?: number;
      latency?: number;
      errorMessage?: string;
      sampleDocument?: Record<string, unknown> | null;
    };
  };
  specificTests: {
    floorsNormalized: {
      status: 'PASS' | 'FAIL' | 'TIMEOUT';
      details: string;
      latency?: number;
    };
    floorsSubcollections: {
      status: 'PASS' | 'FAIL' | 'TIMEOUT';
      details: string;
      latency?: number;
    };
    buildingsAccess: {
      status: 'PASS' | 'FAIL' | 'TIMEOUT';
      details: string;
      latency?: number;
    };
  };
}
