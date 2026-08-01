/**
 * @fileoverview Κατηγοριοποίηση σφάλματος της διαδρομής «ιδιοκτησίες επαφής»
 *
 * Εξήχθη από το `route.ts` (357 γρ. έναντι ορίου 300 για API route, N.7.1).
 *
 * ⚠️ Η αντιστοίχιση κατηγορίας→κωδικού διαβάζει το **μήνυμα** του σφάλματος, όχι
 * τον τύπο του. Είναι εύθραυστο και το ξέρει — μεταφέρθηκε **αυτούσιο** ώστε το
 * σπάσιμο να μην αλλάξει καμία απάντηση. Αν κάποτε αλλάξει, αλλάζει εδώ, μία φορά.
 */

import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/error-utils';
import { nowISO } from '@/lib/date-local';
import type { ContactPropertiesErrorResponse } from './types';

interface ErrorClassification {
  errorCategory: string;
  statusCode: number;
}

function classifyError(error: unknown): ErrorClassification {
  const message = error instanceof Error ? error.message : '';

  if (message.includes('Firebase')) return { errorCategory: 'database', statusCode: 503 };
  if (message.includes('network')) return { errorCategory: 'network', statusCode: 502 };
  if (message.includes('permission')) return { errorCategory: 'authentication', statusCode: 403 };

  return { errorCategory: 'unknown', statusCode: 500 };
}

/**
 * Η απάντηση σφάλματος με **κενή** δομή δεδομένων: ο καταναλωτής διαβάζει
 * `statistics.byType` χωρίς να ελέγξει πρώτα το `success`.
 */
export function contactPropertiesErrorResponse(
  error: unknown,
  contactId: string | null,
): NextResponse<ContactPropertiesErrorResponse> {
  const { errorCategory, statusCode } = classifyError(error);

  return NextResponse.json(
    {
      success: false as const,
      error: getErrorMessage(error, 'Άγνωστο σφάλμα φόρτωσης ιδιοκτησιών επαφής'),
      errorCategory,
      contactId,
      timestamp: nowISO(),

      // Empty data structure for consistency
      properties: [],
      propertiesCount: 0,
      totalValue: 0,
      totalArea: 0,
      statistics: {
        byType: {},
        byBuilding: {},
        byProject: {},
        byStatus: {},
      },
    },
    { status: statusCode },
  );
}
