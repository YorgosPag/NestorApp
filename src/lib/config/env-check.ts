// lib/config/env-check.ts - Environment Variables Validation

/**
 * Required Environment Variables για Telegram Bot functionality
 */
const REQUIRED_ENV_VARS = {
    // Firebase (Required for property data)
    FIREBASE_API_KEY: 'Firebase API Key',
    FIREBASE_PROJECT_ID: 'Firebase Project ID', 
    FIREBASE_AUTH_DOMAIN: 'Firebase Auth Domain',
    FIREBASE_STORAGE_BUCKET: 'Firebase Storage Bucket',
    FIREBASE_MESSAGING_SENDER_ID: 'Firebase Messaging Sender ID',
    FIREBASE_APP_ID: 'Firebase App ID',
  
    // Telegram Bot (Required for bot functionality)
    TELEGRAM_BOT_TOKEN: 'Telegram Bot Token',
  } as const;
  
  /**
   * Optional Environment Variables που βελτιώνουν τη λειτουργικότητα
   */
  const OPTIONAL_ENV_VARS = {
    // Company Info (for better bot responses)
    NEXT_PUBLIC_COMPANY_NAME: 'Company Name',
    NEXT_PUBLIC_COMPANY_EMAIL: 'Company Email',
    NEXT_PUBLIC_COMPANY_PHONE: 'Company Phone',
  
    // Security
    TELEGRAM_WEBHOOK_SECRET: 'Telegram Webhook Secret',
    WEBHOOK_SECRET_TOKEN: 'General Webhook Secret',
  
    // AI Enhancement
    OPENAI_API_KEY: 'OpenAI API Key',
  
    // Future Channels
    WHATSAPP_PHONE_NUMBER: 'WhatsApp Business Number',
    WHATSAPP_API_KEY: 'WhatsApp API Key',
    MESSENGER_PAGE_TOKEN: 'Facebook Messenger Page Token',
    EMAIL_SERVICE_API_KEY: 'Email Service API Key',
  } as const;
  
  export interface EnvCheckResult {
    valid: boolean;
    missing: string[];
    optional: string[];
    warnings: string[];
    recommendations: string[];
  }
  
  /**
   * Έλεγχος όλων των environment variables
   */
  export function checkEnvironmentVariables(): EnvCheckResult {
    const missing: string[] = [];
    const optional: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
  
    // Έλεγχος required variables
    Object.entries(REQUIRED_ENV_VARS).forEach(([key, description]) => {
      if (!process.env[key]) {
        missing.push(`${key} (${description})`);
      }
    });
  
    // Έλεγχος optional variables
    Object.entries(OPTIONAL_ENV_VARS).forEach(([key, description]) => {
      if (!process.env[key]) {
        optional.push(`${key} (${description})`);
      }
    });
  
    // Specific warnings και recommendations
    if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
      warnings.push('No Telegram webhook secret - bot will accept all webhooks (security risk)');
      recommendations.push('Set TELEGRAM_WEBHOOK_SECRET for secure webhook validation');
    }
  
    if (!process.env.NEXT_PUBLIC_COMPANY_NAME) {
      recommendations.push('Set NEXT_PUBLIC_COMPANY_NAME for personalized bot responses');
    }
  
    if (!process.env.OPENAI_API_KEY) {
      recommendations.push('Set OPENAI_API_KEY to enable AI-enhanced responses');
    }
  
    if (process.env.NODE_ENV === 'production' && !process.env.TELEGRAM_WEBHOOK_SECRET) {
      warnings.push('PRODUCTION WARNING: No webhook secret configured - this is a security risk!');
    }
  
    const valid = missing.length === 0;
  
    return {
      valid,
      missing,
      optional,
      warnings,
      recommendations
    };
  }
  
  /**
   * Detailed logging της environment configuration
   */
  export function logEnvironmentStatus(): void {
    const result = checkEnvironmentVariables();
    
    // Debug logging removed
    // Debug logging removed
  
    if (result.valid) {
      // Debug logging removed
    } else {
      // Debug logging removed
      // Debug logging removed
    }
  
    if (result.warnings.length > 0) {
      // Debug logging removed
      // Debug logging removed
    }
  
    if (result.optional.length > 0) {
      // Debug logging removed
      // Debug logging removed
    }
  
    if (result.recommendations.length > 0) {
      // Debug logging removed
      // Debug logging removed
    }
  
    // Debug logging removed
    // Debug logging removed
    // Debug logging removed
    // Debug logging removed
    // Debug logging removed

    // Debug logging removed
  }
  
  /**
   * Helper για Firebase configuration validation
   */
  export function validateFirebaseConfig(): boolean {
    const requiredFirebaseVars = [
      'FIREBASE_API_KEY',
      'FIREBASE_PROJECT_ID',
      'FIREBASE_AUTH_DOMAIN',
      'FIREBASE_STORAGE_BUCKET',
      'FIREBASE_MESSAGING_SENDER_ID',
      'FIREBASE_APP_ID'
    ];
  
    const missing = requiredFirebaseVars.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      // Error logging removed
      return false;
    }
  
    // Debug logging removed
    return true;
  }
  
  /**
   * Helper για Telegram configuration validation
   */
  export function validateTelegramConfig(): boolean {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      // Error logging removed
      return false;
    }
  
    // Validate token format (basic check)
    const tokenRegex = /^\d+:[A-Za-z0-9_-]+$/;
    if (!tokenRegex.test(process.env.TELEGRAM_BOT_TOKEN)) {
      // Error logging removed
      return false;
    }
  
    // Debug logging removed
    return true;
  }
  
  /**
   * Complete system validation
   */
  export function validateSystemConfiguration(): boolean {
    // Debug logging removed
    
    const firebaseValid = validateFirebaseConfig();
    const telegramValid = validateTelegramConfig();
    
    logEnvironmentStatus();
    
    const systemValid = firebaseValid && telegramValid;
    
    if (systemValid) {
      // Debug logging removed
    } else {
      // Debug logging removed
    }
    
    return systemValid;
  }
  
  /**
   * Default values για development
   */
  export const DEFAULT_VALUES = {
    COMPANY_NAME: 'Pagonis Real Estate',
    COMPANY_EMAIL: 'info@pagonis.gr', 
    COMPANY_PHONE: '+30 231 012 3456',
    RATE_LIMIT_MAX: 15,
    RATE_LIMIT_WINDOW: 60000, // 1 minute
  } as const;