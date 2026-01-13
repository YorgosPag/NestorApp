// bot-security.ts - Security & Access Control for Telegram Bot

import { COLLECTIONS } from '@/config/firestore-collections';

export const ALLOWED_COLLECTIONS = [
    COLLECTIONS.UNITS,
    COLLECTIONS.BUILDINGS,
    COLLECTIONS.PROJECTS,
    COLLECTIONS.PARKING_SPACES,
    COLLECTIONS.STORAGE
];

export const FORBIDDEN_KEYWORDS = [
  'όλα', 'όλες', 'όλοι', 'όλων', 'λίστα', 'κατάλογος', 'πλήρης',
  'συνολικά', 'συνολική', 'συνολικό', 'database', 'βάση', 'δεδομένα',
  'export', 'εξαγωγή', 'dump', 'κέρδη', 'έσοδα', 'χρήματα', 'φπα', 'φόρος'
];

export const SECURITY_RULES = {
  MAX_RESULTS: 5,
  MAX_QUERIES_PER_MINUTE: 15, // Increased limit
  REQUIRE_MIN_CRITERIA: 1, // Relaxed criteria
};

export interface SecurityCheckResult {
  forbidden: boolean;
  type?: string;
  keyword?: string;
  message?: string;
}

export function containsForbiddenKeywords(text: string): SecurityCheckResult {
  const lowerText = text.toLowerCase();
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      return {
        forbidden: true,
        type: 'mass_data_extraction',
        keyword,
        message: "Δεν παρέχω συγκεντρωτικά δεδομένα. Παρακαλώ ρωτήστε για συγκεκριμένο ακίνητο."
      };
    }
  }
  return { forbidden: false };
}

export function isTooGeneric(searchCriteria: Record<string, any>): boolean {
    const criteriaCount = Object.keys(searchCriteria).length;
    return criteriaCount < SECURITY_RULES.REQUIRE_MIN_CRITERIA;
}

export function exceedsResultLimit(resultCount: number): boolean {
    return resultCount > SECURITY_RULES.MAX_RESULTS;
}

export const SECURITY_MESSAGES = {
  TOO_GENERIC: `🔍 Η αναζήτησή σας είναι πολύ γενική. Παρακαλώ προσθέστε περισσότερες λεπτομέρειες (π.χ. τύπο, τιμή, περιοχή).`,
  TOO_MANY_RESULTS: `📊 Βρέθηκαν πολλά αποτελέσματα. Παρακαλώ περιορίστε την αναζήτησή σας ή επικοινωνήστε μαζί μας.`,
  ACCESS_DENIED: `🚫 Δεν έχω πρόσβαση σε αυτού του τύπου τις πληροφορίες.`
};

export function logSecurityEvent(event: { type: string; query: string; reason: string; userId: string; }): void {
  console.warn('🔒 Security Event:', {
    timestamp: new Date().toISOString(),
    ...event
  });
}
