/**
 * Natural language event parsing via OpenAI.
 * POST: Takes natural text, returns structured event data.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface ParsedEventResult {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  duration: number; // minutes
  type: 'meeting' | 'call' | 'viewing' | 'follow_up' | 'email' | 'document' | 'other';
  contactName?: string;
  description?: string;
}

const PARSE_EVENT_SCHEMA = {
  type: 'object' as const,
  properties: {
    title: { type: 'string' as const, description: 'Event title' },
    date: { type: 'string' as const, description: 'Date in YYYY-MM-DD format' },
    time: { type: 'string' as const, description: 'Time in HH:mm format (24h)' },
    duration: { type: 'number' as const, description: 'Duration in minutes' },
    type: {
      type: 'string' as const,
      enum: ['meeting', 'call', 'viewing', 'follow_up', 'email', 'document', 'other'],
    },
    contactName: { type: ['string', 'null'] as const, description: 'Contact name if mentioned' },
    description: { type: ['string', 'null'] as const, description: 'Additional details' },
  },
  required: ['title', 'date', 'time', 'duration', 'type', 'contactName', 'description'] as const,
  additionalProperties: false as const,
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { text: string; currentDate: string; locale: string };
    const { text, currentDate, locale } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI not configured' }, { status: 500 });
    }

    const client = new OpenAI({ apiKey });

    const systemPrompt = `You are an event parser. Extract calendar event details from natural language input.
Today's date is ${currentDate}. The user's locale is ${locale}.
Support both Greek and English input. Infer reasonable defaults:
- If no time specified, default to 09:00
- If no duration specified, default to 60 minutes
- Determine the best event type from the context
- For relative dates: "αύριο"/"tomorrow" = tomorrow, "Δευτέρα"/"Monday" = next Monday, etc.
Return structured data in the specified JSON format.`;

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_TEXT_MODEL ?? 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'parsed_event',
          strict: true,
          schema: PARSE_EVENT_SCHEMA,
        },
      },
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    const parsed = JSON.parse(content) as ParsedEventResult;
    return NextResponse.json({ result: parsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Parse failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
