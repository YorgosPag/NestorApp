// /home/user/studio/src/app/api/communications/webhooks/telegram/message/security-adapter.ts

import type { SearchCriteria } from '../shared/types';

interface SecurityCheckResult {
  forbidden: boolean;
  type?: string;
  keyword?: string;
  message?: string;
}

/** Security event for logging */
interface SecurityEvent {
  type: string;
  query: string;
  reason: string;
  userId: string;
}

/** Security module interface */
interface SecurityModule {
  containsForbiddenKeywords: (text: string) => SecurityCheckResult;
  logSecurityEvent: (event: SecurityEvent) => void;
  isTooGeneric: (criteria: SearchCriteria) => boolean;
  exceedsResultLimit: (count: number) => boolean;
}

let securityModule: SecurityModule | null = null;
try {
  securityModule = require('../bot-security') as SecurityModule;
  console.log('✅ Security module loaded successfully.');
} catch (error) {
  console.warn('⚠️ Security module not found, using safe defaults.');
}

export const security = {
  containsForbiddenKeywords: (text: string): SecurityCheckResult => {
    if (securityModule) {
      return securityModule.containsForbiddenKeywords(text);
    }
    return { forbidden: false };
  },
  logSecurityEvent: (event: SecurityEvent): void => {
    if (securityModule) {
      securityModule.logSecurityEvent(event);
    }
  },
  isTooGeneric: (criteria: SearchCriteria): boolean => {
    if (securityModule) {
      return securityModule.isTooGeneric(criteria);
    }
    return false;
  },
  exceedsResultLimit: (count: number): boolean => {
    if (securityModule) {
      return securityModule.exceedsResultLimit(count);
    }
    return false;
  },
};
