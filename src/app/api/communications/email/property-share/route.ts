import { NextRequest, NextResponse } from 'next/server';
import { EmailService } from '@/services/email.service';
import type { EmailTemplateType, EmailRequest } from '@/services/email.service';

const NODE_ENV = process.env.NODE_ENV || 'development';

// Rate limiting (simple in-memory for demo - use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 emails per minute per IP

// Local interface for backward compatibility
interface PropertyShareEmailRequest {
  recipientEmail?: string;
  recipients?: string[];
  recipientName?: string;
  propertyTitle: string;
  propertyDescription?: string;
  propertyPrice?: number;
  propertyArea?: number;
  propertyLocation?: string;
  propertyUrl: string;
  photoUrl?: string;
  senderName?: string;
  senderEmail?: string;
  personalMessage?: string;
  templateType?: EmailTemplateType;
}

// Validation constants
const VALIDATION_RULES = {
  MAX_RECIPIENTS: 5,
  MAX_MESSAGE_LENGTH: 500,
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_LOCATION_LENGTH: 100,
  MIN_PRICE: 0,
  MAX_PRICE: 50000000, // 50M euros
  MIN_AREA: 1,
  MAX_AREA: 10000,
  ALLOWED_TEMPLATE_TYPES: ['residential', 'commercial', 'premium', 'default'] as EmailTemplateType[]
};

// Security utilities
function sanitizeString(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
}

function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return ['http:', 'https:'].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() || realIP || 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(ip);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  userLimit.count++;
  return true;
}

// Enhanced validation function
function validateEmailRequest(data: any): { isValid: boolean; errors: string[]; sanitizedData?: PropertyShareEmailRequest } {
  const errors: string[] = [];

  // Required fields validation
  if (!data.propertyTitle || typeof data.propertyTitle !== 'string') {
    errors.push('Property title is required and must be a string');
  } else if (data.propertyTitle.length > VALIDATION_RULES.MAX_TITLE_LENGTH) {
    errors.push(`Property title must be ${VALIDATION_RULES.MAX_TITLE_LENGTH} characters or less`);
  }

  if (!data.propertyUrl || typeof data.propertyUrl !== 'string') {
    errors.push('Property URL is required and must be a string');
  } else if (!isValidUrl(data.propertyUrl)) {
    errors.push('Property URL must be a valid HTTP/HTTPS URL');
  }

  // Recipients validation
  let recipients: string[] = [];
  if (data.recipients && Array.isArray(data.recipients)) {
    recipients = data.recipients;
  } else if (data.recipientEmail && typeof data.recipientEmail === 'string') {
    recipients = [data.recipientEmail];
  }

  if (recipients.length === 0) {
    errors.push('At least one recipient email is required');
  } else if (recipients.length > VALIDATION_RULES.MAX_RECIPIENTS) {
    errors.push(`Maximum ${VALIDATION_RULES.MAX_RECIPIENTS} recipients allowed`);
  } else {
    const invalidEmails = recipients.filter(email => 
      !email || typeof email !== 'string' || !isValidEmail(email.trim())
    );
    if (invalidEmails.length > 0) {
      errors.push(`Invalid email addresses: ${invalidEmails.join(', ')}`);
    }
  }

  // Optional fields validation
  if (data.propertyDescription && typeof data.propertyDescription === 'string') {
    if (data.propertyDescription.length > VALIDATION_RULES.MAX_DESCRIPTION_LENGTH) {
      errors.push(`Property description must be ${VALIDATION_RULES.MAX_DESCRIPTION_LENGTH} characters or less`);
    }
  }

  if (data.personalMessage && typeof data.personalMessage === 'string') {
    if (data.personalMessage.length > VALIDATION_RULES.MAX_MESSAGE_LENGTH) {
      errors.push(`Personal message must be ${VALIDATION_RULES.MAX_MESSAGE_LENGTH} characters or less`);
    }
  }

  if (data.propertyPrice !== undefined) {
    if (typeof data.propertyPrice !== 'number' || data.propertyPrice < VALIDATION_RULES.MIN_PRICE || data.propertyPrice > VALIDATION_RULES.MAX_PRICE) {
      errors.push(`Property price must be between ${VALIDATION_RULES.MIN_PRICE} and ${VALIDATION_RULES.MAX_PRICE}`);
    }
  }

  if (data.propertyArea !== undefined) {
    if (typeof data.propertyArea !== 'number' || data.propertyArea < VALIDATION_RULES.MIN_AREA || data.propertyArea > VALIDATION_RULES.MAX_AREA) {
      errors.push(`Property area must be between ${VALIDATION_RULES.MIN_AREA} and ${VALIDATION_RULES.MAX_AREA}`);
    }
  }

  // Photo URL validation (optional)
  if (data.photoUrl && typeof data.photoUrl === 'string') {
    if (!isValidUrl(data.photoUrl)) {
      errors.push('Photo URL must be a valid HTTP/HTTPS URL');
    }
  }

  if (data.templateType && !VALIDATION_RULES.ALLOWED_TEMPLATE_TYPES.includes(data.templateType)) {
    errors.push(`Template type must be one of: ${VALIDATION_RULES.ALLOWED_TEMPLATE_TYPES.join(', ')}`);
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Sanitize data
  const sanitizedData: PropertyShareEmailRequest = {
    recipients: recipients.map(email => email.trim().toLowerCase()),
    propertyTitle: sanitizeString(data.propertyTitle),
    propertyUrl: data.propertyUrl,
    photoUrl: data.photoUrl || undefined,
    propertyDescription: data.propertyDescription ? sanitizeString(data.propertyDescription) : undefined,
    personalMessage: data.personalMessage ? sanitizeString(data.personalMessage) : undefined,
    propertyPrice: data.propertyPrice,
    propertyArea: data.propertyArea,
    propertyLocation: data.propertyLocation ? sanitizeString(data.propertyLocation) : undefined,
    templateType: data.templateType || 'residential',
    senderName: data.senderName ? sanitizeString(data.senderName) : undefined,
    recipientName: data.recipientName ? sanitizeString(data.recipientName) : undefined
  };

  return { isValid: true, errors: [], sanitizedData };
}

// Enhanced logging
function logEmailAttempt(
  ip: string, 
  success: boolean, 
  data: Partial<PropertyShareEmailRequest>, 
  error?: string,
  duration?: number
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ip,
    success,
    recipientCount: (data.recipients?.length || 1),
    templateType: data.templateType || 'residential',
    propertyTitle: data.propertyTitle?.substring(0, 50) || 'unknown',
    error: error?.substring(0, 100),
    duration,
    environment: NODE_ENV
  };

  if (success) {
    console.log('✅ Email API success:', JSON.stringify(logEntry));
  } else {
    console.error('❌ Email API error:', JSON.stringify(logEntry));
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const clientIP = getClientIP(request);
  
  try {
    // Rate limiting check
    if (!checkRateLimit(clientIP)) {
      logEmailAttempt(clientIP, false, {}, 'Rate limit exceeded');
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: `Maximum ${RATE_LIMIT_MAX_REQUESTS} emails per minute allowed`
        },
        { 
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': '0'
          }
        }
      );
    }

    // Parse and validate request body FIRST
    let requestData;
    try {
      requestData = await request.json();
    } catch (parseError) {
      logEmailAttempt(clientIP, false, {}, 'Invalid JSON in request body');
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Check EmailService status
    const emailServiceStatus = EmailService.getStatus();
    console.log('📧 EmailService status:', emailServiceStatus);

    // Enhanced validation
    const { isValid, errors, sanitizedData } = validateEmailRequest(requestData);
    
    if (!isValid) {
      logEmailAttempt(clientIP, false, requestData, `Validation failed: ${errors.join(', ')}`);
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: errors
        },
        { status: 400 }
      );
    }

    const data = sanitizedData!;
    console.log('📧 Email API called:', {
      ip: clientIP,
      recipientCount: data.recipients!.length,
      templateType: data.templateType,
      propertyTitle: data.propertyTitle
    });

    // Convert local interface to EmailService interface
    const emailRequest: EmailRequest = {
      recipients: data.recipients!,
      recipientName: data.recipientName,
      propertyTitle: data.propertyTitle,
      propertyDescription: data.propertyDescription,
      propertyPrice: data.propertyPrice,
      propertyArea: data.propertyArea,
      propertyLocation: data.propertyLocation,
      propertyUrl: data.propertyUrl,
      photoUrl: data.photoUrl,
      senderName: data.senderName,
      personalMessage: data.personalMessage,
      templateType: data.templateType
    };

    // Send via Enterprise EmailService
    try {
      const result = await EmailService.sendPropertyShareEmail(emailRequest);

      const duration = Date.now() - startTime;
      logEmailAttempt(clientIP, true, data, undefined, duration);

      return NextResponse.json(result);

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logEmailAttempt(clientIP, false, data, errorMessage, duration);

      return NextResponse.json(
        {
          error: 'Failed to send emails',
          message: 'Our email service is temporarily unavailable. Please try again later.'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logEmailAttempt(clientIP, false, {}, errorMessage, duration);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again later.'
      },
      { status: 500 }
    );
  }
}

// Helper function for logging
function extractPropertyId(url: string): string {
  const match = url.match(/\/properties\/([^/?]+)/);
  return match ? match[1] : 'unknown';
}

// Health check endpoint
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'healthy',
    service: 'email-api',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    features: {
      rate_limiting: true,
      input_validation: true,
      template_support: true,
      comprehensive_logging: true
    }
  });
}
