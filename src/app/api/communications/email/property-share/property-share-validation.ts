/**
 * @fileoverview Validation & security utilities for the property-share email endpoint.
 * Extracted from route.ts to keep the handler lean (Google SRP — ADR-261).
 */

import { NextRequest } from 'next/server';
import { isValidEmail as isValidEmailFn, isValidUrl } from '@/lib/validation/email-validation';
import type { EmailTemplateType } from '@/types/email-templates';

// ============================================================================
// TYPES
// ============================================================================

export interface PropertyShareEmailRequest {
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
  /** CRM contact ID when sharing to a CRM contact */
  sourceContactId?: string;
  /** CRM contact display name for audit trail */
  sourceContactName?: string;
}

/** Input data for email validation */
interface EmailValidationInput {
  propertyTitle?: string;
  propertyUrl?: string;
  recipients?: string[];
  recipientEmail?: string;
  recipientName?: string;
  propertyDescription?: string;
  propertyPrice?: number;
  propertyArea?: number;
  propertyLocation?: string;
  photoUrl?: string;
  senderName?: string;
  senderEmail?: string;
  personalMessage?: string;
  templateType?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: PropertyShareEmailRequest;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const VALIDATION_RULES = {
  MAX_RECIPIENTS: 5,
  MAX_MESSAGE_LENGTH: 500,
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 1000,
  MAX_LOCATION_LENGTH: 100,
  MIN_PRICE: 0,
  MAX_PRICE: 50000000,
  MIN_AREA: 1,
  MAX_AREA: 10000,
  ALLOWED_TEMPLATE_TYPES: ['residential', 'commercial', 'premium', 'default'] as EmailTemplateType[],
} as const;

// Rate limiting (simple in-memory — use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 10;

// ============================================================================
// SECURITY UTILITIES
// ============================================================================

export function sanitizeString(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

function isValidEmail(email: string): boolean {
  return isValidEmailFn(email) && email.length <= 254;
}

export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() || realIP || 'unknown';
}

export function checkRateLimit(ip: string): boolean {
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

// ============================================================================
// VALIDATION
// ============================================================================

export function validateEmailRequest(data: EmailValidationInput): ValidationResult {
  const errors: string[] = [];

  // Required fields
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

  // Recipients
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

  // Optional fields
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

  if (data.photoUrl && typeof data.photoUrl === 'string') {
    if (!isValidUrl(data.photoUrl)) {
      errors.push('Photo URL must be a valid HTTP/HTTPS URL');
    }
  }

  if (data.templateType && !VALIDATION_RULES.ALLOWED_TEMPLATE_TYPES.includes(data.templateType as EmailTemplateType)) {
    errors.push(`Template type must be one of: ${VALIDATION_RULES.ALLOWED_TEMPLATE_TYPES.join(', ')}`);
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  const sanitizedData: PropertyShareEmailRequest = {
    recipients: recipients.map(email => email.trim().toLowerCase()),
    propertyTitle: sanitizeString(data.propertyTitle as string),
    propertyUrl: data.propertyUrl as string,
    photoUrl: data.photoUrl || undefined,
    propertyDescription: data.propertyDescription ? sanitizeString(data.propertyDescription) : undefined,
    personalMessage: data.personalMessage ? sanitizeString(data.personalMessage) : undefined,
    propertyPrice: data.propertyPrice,
    propertyArea: data.propertyArea,
    propertyLocation: data.propertyLocation ? sanitizeString(data.propertyLocation) : undefined,
    templateType: (data.templateType || 'residential') as EmailTemplateType,
    senderName: data.senderName ? sanitizeString(data.senderName) : undefined,
    recipientName: data.recipientName ? sanitizeString(data.recipientName) : undefined,
  };

  return { isValid: true, errors: [], sanitizedData };
}
