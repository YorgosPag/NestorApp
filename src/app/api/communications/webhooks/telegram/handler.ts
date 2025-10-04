// /home/user/studio/src/app/api/communications/webhooks/telegram/handler.ts

import { type NextRequest, NextResponse } from 'next/server';
import { isFirebaseAvailable } from './firebase/availability';
import { processMessage } from './message/process-message';
import { handleCallbackQuery } from './message/callback-query';
import { sendTelegramMessage } from './telegram/client';
import { storeMessageInCRM } from './crm/store';
import type { TelegramMessage, TelegramSendPayload } from './telegram/types';

/**
 * Main orchestrator for handling incoming Telegram webhook requests.
 */
async function processTelegramUpdate(webhookData: TelegramMessage): Promise<void> {
  let telegramResponse: TelegramSendPayload | null = null;

  if (webhookData.message) {
    console.log('💬 Processing regular message');
    telegramResponse = await processMessage(webhookData.message);
  }

  if (webhookData.callback_query) {
    console.log('🎯 Processing callback query');
    telegramResponse = await handleCallbackQuery(webhookData.callback_query);
  }

  // Send response to Telegram if we have one
  if (telegramResponse) {
    const sentResult = await sendTelegramMessage(telegramResponse);
    console.log('📤 Telegram response sent:', sentResult.success);

    // Store outbound message if Firebase is available
    if (sentResult.success && isFirebaseAvailable() && telegramResponse.text) {
      await storeMessageInCRM({
        chat: { id: telegramResponse.chat_id },
        from: { id: 'bot', first_name: 'Pagonis Bot' },
        text: telegramResponse.text,
        message_id: Date.now()
      }, 'outbound');
    }
  }
}

/**
 * Handles POST requests from the main route file.
 */
export async function handlePOST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('🔄 Telegram webhook received');
    
    // Early return if no Firebase available
    if (!isFirebaseAvailable()) {
      console.warn('⚠️ Firebase not available, returning minimal response');
      return NextResponse.json({ ok: true, status: 'firebase_unavailable' });
    }

    const webhookData = await request.json();
    console.log('📦 Processing webhook data...');

    await processTelegramUpdate(webhookData);
    
    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('❌ Telegram webhook error:', error);
    return NextResponse.json({ ok: true, error: 'internal_error' });
  }
}

/**
 * Handles GET requests from the main route file.
 */
export async function handleGET(): Promise<NextResponse> {
    return NextResponse.json({ 
        status: 'Telegram webhook endpoint is working',
        timestamp: new Date().toISOString(),
        firebase_available: isFirebaseAvailable(),
        features: [
          'Real property search',
          'Smart natural language processing', 
          'Security controls',
          'CRM integration',
          'Build-safe operation'
        ]
    });
}
