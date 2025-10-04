import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import crypto from 'crypto';

// Environment configuration
const SENDGRID_WEBHOOK_SECRET = process.env.SENDGRID_WEBHOOK_SECRET;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB
const WEBHOOK_TIMEOUT_MS = 30000; // 30 seconds

// Rate limiting for webhooks (in-memory - use Redis in production)
const webhookRateLimit = new Map<string, { count: number; resetTime: number }>();
const WEBHOOK_RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const WEBHOOK_RATE_LIMIT_MAX_REQUESTS = 1000; // 1000 events per minute

interface SendGridEvent {
  event: string;
  email: string;
  timestamp: number;
  url?: string;
  ip?: string;
  useragent?: string;
  sg_event_id: string;
  sg_message_id: string;
  reason?: string;
  status?: string;
  response?: string;
  [key: string]: any;
}

interface EmailAnalyticsRecord {
  eventType: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'dropped';
  recipientEmail: string;
  propertyId?: string;
  timestamp: any;
  sendgridEventId: string;
  sendgridMessageId: string;
  metadata: {
    ip?: string;
    userAgent?: string;
    clickedUrl?: string;
    bounceReason?: string;
    dropReason?: string;
    [key: string]: any;
  };
  createdAt: any;
}

// Security utilities
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() || realIP || 'unknown';
}

function checkWebhookRateLimit(ip: string): boolean {
  const now = Date.now();
  const userLimit = webhookRateLimit.get(ip);

  if (!userLimit || now > userLimit.resetTime) {
    webhookRateLimit.set(ip, { count: 1, resetTime: now + WEBHOOK_RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (userLimit.count >= WEBHOOK_RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  userLimit.count++;
  return true;
}

function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim().replace(/[<>]/g, '');
}

function sanitizeEventId(eventId: string): string {
  return eventId.replace(/[^a-zA-Z0-9\-_]/g, '');
}

function validateSendGridEvent(event: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!event.event || typeof event.event !== 'string') {
    errors.push('Event type is required');
  }

  if (!event.email || typeof event.email !== 'string') {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(event.email)) {
    errors.push('Invalid email format');
  }

  if (!event.timestamp || typeof event.timestamp !== 'number') {
    errors.push('Timestamp is required');
  }

  if (!event.sg_event_id || typeof event.sg_event_id !== 'string') {
    errors.push('SendGrid event ID is required');
  }

  if (!event.sg_message_id || typeof event.sg_message_id !== 'string') {
    errors.push('SendGrid message ID is required');
  }

  // Validate timestamp is reasonable (not too old or in future)
  if (event.timestamp) {
    const eventTime = event.timestamp * 1000; // Convert to milliseconds
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const oneHourFromNow = now + (60 * 60 * 1000);

    if (eventTime < oneWeekAgo || eventTime > oneHourFromNow) {
      errors.push('Event timestamp is outside acceptable range');
    }
  }

  return { isValid: errors.length === 0, errors };
}

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) {
    console.warn('⚠️ Webhook signature verification skipped (missing signature or secret)');
    return NODE_ENV === 'development'; // Allow in development, block in production
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64');

    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('❌ Webhook signature verification error:', error);
    return false;
  }
}

function mapSendGridEvent(sgEvent: string): EmailAnalyticsRecord['eventType'] {
  switch (sgEvent.toLowerCase()) {
    case 'delivered':
      return 'delivered';
    case 'open':
      return 'opened';
    case 'click':
      return 'clicked';
    case 'bounce':
    case 'blocked':
      return 'bounced';
    case 'dropped':
    case 'spamreport':
    case 'unsubscribe':
      return 'dropped';
    default:
      console.warn(`⚠️ Unknown SendGrid event type: ${sgEvent}`);
      return 'delivered'; // Default fallback
  }
}

function logWebhookAttempt(
  ip: string,
  success: boolean,
  eventCount: number = 0,
  error?: string,
  duration?: number
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'sendgrid_webhook',
    ip,
    success,
    eventCount,
    error: error?.substring(0, 200),
    duration,
    environment: NODE_ENV
  };

  if (success) {
    console.log('✅ SendGrid webhook success:', JSON.stringify(logEntry));
  } else {
    console.error('❌ SendGrid webhook error:', JSON.stringify(logEntry));
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const clientIP = getClientIP(request);

  try {
    // Rate limiting check
    if (!checkWebhookRateLimit(clientIP)) {
      logWebhookAttempt(clientIP, false, 0, 'Rate limit exceeded');
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Check content length
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
      logWebhookAttempt(clientIP, false, 0, 'Payload too large');
      return NextResponse.json(
        { error: 'Payload too large' },
        { status: 413 }
      );
    }

    // Get raw payload for signature verification
    const rawPayload = await request.text();
    
    // Verify webhook signature (if configured)
    const signature = request.headers.get('x-twilio-email-event-webhook-signature');
    if (SENDGRID_WEBHOOK_SECRET && !verifyWebhookSignature(rawPayload, signature || '', SENDGRID_WEBHOOK_SECRET)) {
      logWebhookAttempt(clientIP, false, 0, 'Invalid webhook signature');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse JSON payload
    let events: SendGridEvent[];
    try {
      events = JSON.parse(rawPayload);
    } catch (parseError) {
      logWebhookAttempt(clientIP, false, 0, 'Invalid JSON payload');
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    if (!Array.isArray(events)) {
      logWebhookAttempt(clientIP, false, 0, 'Payload must be an array');
      return NextResponse.json(
        { error: 'Invalid payload format' },
        { status: 400 }
      );
    }

    if (events.length === 0) {
      logWebhookAttempt(clientIP, true, 0);
      return NextResponse.json({ success: true, processed: 0 });
    }

    console.log(`📧 Processing ${events.length} SendGrid webhook events from ${clientIP}`);

    // Process events with validation
    const processedEvents = [];
    const validationErrors = [];

    for (const [index, event] of events.entries()) {
      try {
        // Validate event structure
        const { isValid, errors } = validateSendGridEvent(event);
        if (!isValid) {
          validationErrors.push(`Event ${index}: ${errors.join(', ')}`);
          continue;
        }

        // Sanitize and map event data
        const analyticsRecord: EmailAnalyticsRecord = {
          eventType: mapSendGridEvent(event.event),
          recipientEmail: sanitizeEmail(event.email),
          timestamp: new Date(event.timestamp * 1000),
          sendgridEventId: sanitizeEventId(event.sg_event_id),
          sendgridMessageId: sanitizeEventId(event.sg_message_id),
          metadata: {
            ip: event.ip,
            userAgent: event.useragent,
            clickedUrl: event.url,
            bounceReason: event.reason,
            dropReason: event.status || event.response,
            rawEvent: {
              event: event.event,
              timestamp: event.timestamp
            }
          },
          createdAt: serverTimestamp()
        };

        // Extract property ID from URL if available
        if (event.url) {
          const propertyMatch = event.url.match(/\/properties\/([^/?]+)/);
          if (propertyMatch) {
            analyticsRecord.propertyId = propertyMatch[1];
          }
        }

        // Save to Firestore with timeout
        const savePromise = addDoc(collection(db, 'email_analytics'), analyticsRecord);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Firestore timeout')), WEBHOOK_TIMEOUT_MS)
        );

        const docRef = await Promise.race([savePromise, timeoutPromise]) as any;
        
        console.log(`✅ Saved ${event.event} event for ${event.email} (${docRef.id})`);
        
        processedEvents.push({
          id: docRef.id,
          event: event.event,
          email: event.email,
          eventType: analyticsRecord.eventType
        });

      } catch (eventError) {
        console.error(`❌ Error processing event ${index} for ${event.email}:`, eventError);
        validationErrors.push(`Event ${index}: Processing failed`);
      }
    }

    const duration = Date.now() - startTime;
    
    if (validationErrors.length > 0) {
      console.warn('⚠️ Some events had validation errors:', validationErrors);
    }

    logWebhookAttempt(clientIP, true, processedEvents.length, undefined, duration);

    return NextResponse.json({
      success: true,
      processed: processedEvents.length,
      total: events.length,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
      events: processedEvents.slice(0, 10) // Limit response size
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logWebhookAttempt(clientIP, false, 0, errorMessage, duration);
    
    console.error('❌ SendGrid webhook error:', error);
    
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        message: 'Internal server error'
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  const clientIP = getClientIP(request);
  
  console.log('🔍 SendGrid webhook health check from:', clientIP);
  
  return NextResponse.json({
    status: 'healthy',
    service: 'sendgrid-webhook',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    features: {
      signature_verification: !!SENDGRID_WEBHOOK_SECRET,
      rate_limiting: true,
      input_validation: true,
      firestore_integration: true
    },
    security: {
      max_payload_size: `${MAX_PAYLOAD_SIZE / 1024 / 1024}MB`,
      timeout: `${WEBHOOK_TIMEOUT_MS / 1000}s`,
      rate_limit: `${WEBHOOK_RATE_LIMIT_MAX_REQUESTS}/minute`
    }
  });
}
