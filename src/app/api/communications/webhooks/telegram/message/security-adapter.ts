// /home/user/studio/src/app/api/communications/webhooks/telegram/message/security-adapter.ts

interface SecurityCheckResult {
  forbidden: boolean;
  type?: string;
  keyword?: string;
  message?: string;
}

let securityModule: any = null;
try {
  securityModule = require('../bot-security');
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
  logSecurityEvent: (event: any): void => {
    if (securityModule) {
      securityModule.logSecurityEvent(event);
    }
  },
  isTooGeneric: (criteria: any): boolean => {
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
