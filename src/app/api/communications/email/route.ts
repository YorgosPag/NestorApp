// /home/user/studio/src/app/api/communications/email/route.ts

import { NextRequest, NextResponse } from 'next/server';

interface EmailPayload {
  to: string;
  templateId: string;
  subject: string;
  message: string;
  leadId?: string;
  priority?: 'low' | 'normal' | 'high';
  category?: string;
}

export async function POST(request: NextRequest) {
  try {
    const payload: EmailPayload = await request.json();
    
    // Validation
    if (!payload.to || !payload.subject || !payload.message) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, message' },
        { status: 400 }
      );
    }

    // Call Firebase Function (PRODUCTION)
    const functionUrl = 'https://sendemail-n4velymlea-ew.a.run.app';
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: payload.to,
        subject: payload.subject,
        message: payload.message,
        templateId: payload.templateId,
        leadId: payload.leadId
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Firebase Function error:', errorData);
      return NextResponse.json(
        { error: errorData.error || 'Failed to send email' },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    console.log('✅ PRODUCTION Email sent via SendGrid:', {
      to: payload.to,
      messageId: result.messageId,
      status: result.status
    });

    return NextResponse.json({
      id: result.messageId,
      status: 'sent',
      message: 'Email sent successfully via SendGrid',
      production: true,
      messageId: result.messageId
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Error in email API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
