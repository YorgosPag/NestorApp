import { NextRequest, NextResponse } from 'next/server';
import { EmailTemplatesService } from '@/services/email-templates.service';
import type { EmailTemplateType, EmailTemplateData } from '@/types/email-templates';

// Environment validation with defaults
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'info@nestorconstruct.gr';
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Nestor Construct';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Rate limiting (simple in-memory for demo - use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 emails per minute per IP

// Input validation schemas
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
    propertyDescription: data.propertyDescription ? sanitizeString(data.propertyDescription) : undefined,
    personalMessage: data.personalMessage ? sanitizeString(data.personalMessage) : undefined,
    propertyPrice: data.propertyPrice,
    propertyArea: data.propertyArea,
    propertyLocation: data.propertyLocation ? sanitizeString(data.propertyLocation) : undefined,
    templateType: data.templateType || 'residential',
    senderName: data.senderName ? sanitizeString(data.senderName) : SENDGRID_FROM_NAME,
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

    // Environment validation
    if (!SENDGRID_API_KEY) {
      logEmailAttempt(clientIP, false, {}, 'SendGrid API key not configured');
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    // Parse and validate request body
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

    // Prepare emails using templates
    const emailPersonalizations = data.recipients!.map(email => {
      const templateData: EmailTemplateData = {
        propertyTitle: data.propertyTitle,
        propertyDescription: data.propertyDescription,
        propertyPrice: data.propertyPrice,
        propertyArea: data.propertyArea,
        propertyLocation: data.propertyLocation,
        propertyUrl: data.propertyUrl,
        recipientEmail: email,
        personalMessage: data.personalMessage,
        senderName: data.senderName || SENDGRID_FROM_NAME
      };

      const emailHtml = EmailTemplatesService.generateEmailHtml(data.templateType!, templateData);

      return {
        to: [{ email: email, name: data.recipientName || '' }],
        subject: generateSubject(data.templateType!, data.propertyTitle),
        html: emailHtml
      };
    });

    // Send via SendGrid
    const emailPayload = {
      personalizations: emailPersonalizations.map(email => ({
        to: email.to,
        subject: email.subject
      })),
      from: {
        email: SENDGRID_FROM_EMAIL,
        name: data.senderName || SENDGRID_FROM_NAME
      },
      content: [{
        type: 'text/html',
        value: emailPersonalizations[0].html
      }],
      tracking_settings: {
        click_tracking: { enable: true },
        open_tracking: { enable: true }
      },
      custom_args: {
        template_type: data.templateType!,
        property_id: extractPropertyId(data.propertyUrl),
        campaign_type: 'property_share',
        recipient_count: data.recipients!.length.toString(),
        client_ip: clientIP
      }
    };

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      logEmailAttempt(clientIP, false, data, `SendGrid error: ${response.status}`, duration);
      
      return NextResponse.json(
        { 
          error: 'Failed to send emails',
          message: 'Our email service is temporarily unavailable. Please try again later.'
        },
        { status: 500 }
      );
    }

    logEmailAttempt(clientIP, true, data, undefined, duration);

    const template = EmailTemplatesService.getTemplate(data.templateType!);
    return NextResponse.json({ 
      success: true,
      message: `Emails sent to ${data.recipients!.length} recipients using ${template?.name || 'Residential'} template`,
      recipients: data.recipients!.length,
      templateUsed: template?.name || 'Residential',
      templateType: data.templateType
    });

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

// Helper functions
function generateSubject(templateType: EmailTemplateType, propertyTitle: string): string {
  switch (templateType) {
    case 'residential':
      return `🏠 Το Σπίτι των Ονείρων σας: ${propertyTitle} - Nestor Construct`;
    case 'commercial':
      return `🏢 Επαγγελματική Ευκαιρία: ${propertyTitle} - Nestor Construct`;
    case 'premium':
      return `⭐ Premium Collection: ${propertyTitle} - Nestor Construct`;
    default:
      return `🏠 Κοινοποίηση Ακινήτου: ${propertyTitle} - Nestor Construct`;
  }
}

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
