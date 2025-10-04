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
    
    console.log('\n🔧 Environment Variables Check:');
    console.log('================================');
  
    if (result.valid) {
      console.log('✅ All required environment variables are set');
    } else {
      console.log('❌ Missing required environment variables:');
      result.missing.forEach(item => console.log(`   - ${item}`));
    }
  
    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach(warning => console.log(`   - ${warning}`));
    }
  
    if (result.optional.length > 0) {
      console.log('\n💡 Optional variables not set:');
      result.optional.forEach(item => console.log(`   - ${item}`));
    }
  
    if (result.recommendations.length > 0) {
      console.log('\n📋 Recommendations:');
      result.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }
  
    console.log('\n🚀 Telegram Bot Status:');
    console.log(`   Bot Token: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Missing'}`);
    console.log(`   Firebase: ${process.env.FIREBASE_PROJECT_ID ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   Company Info: ${process.env.NEXT_PUBLIC_COMPANY_NAME ? '✅ Set' : '⚠️  Using defaults'}`);
    console.log(`   Security: ${process.env.TELEGRAM_WEBHOOK_SECRET ? '✅ Secured' : '⚠️  Unsecured'}`);
    
    console.log('\n================================\n');
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
      console.error('❌ Firebase configuration incomplete. Missing:', missing);
      return false;
    }
  
    console.log('✅ Firebase configuration complete');
    return true;
  }
  
  /**
   * Helper για Telegram configuration validation
   */
  export function validateTelegramConfig(): boolean {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('❌ Telegram Bot Token missing');
      return false;
    }
  
    // Validate token format (basic check)
    const tokenRegex = /^\d+:[A-Za-z0-9_-]+$/;
    if (!tokenRegex.test(process.env.TELEGRAM_BOT_TOKEN)) {
      console.error('❌ Telegram Bot Token format appears invalid');
      return false;
    }
  
    console.log('✅ Telegram configuration valid');
    return true;
  }
  
  /**
   * Complete system validation
   */
  export function validateSystemConfiguration(): boolean {
    console.log('🔍 Validating system configuration...\n');
    
    const firebaseValid = validateFirebaseConfig();
    const telegramValid = validateTelegramConfig();
    
    logEnvironmentStatus();
    
    const systemValid = firebaseValid && telegramValid;
    
    if (systemValid) {
      console.log('🎉 System configuration valid - Telegram Bot ready to run!');
    } else {
      console.log('💥 System configuration invalid - please fix the issues above');
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