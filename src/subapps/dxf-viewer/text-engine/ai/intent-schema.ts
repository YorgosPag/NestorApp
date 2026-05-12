/**
 * ADR-344 Phase 12 — OpenAI Responses API strict json_schema for text intent.
 *
 * Rules (memory: OpenAI Structured Outputs strict mode):
 * - ALL properties listed in `required`
 * - Optional fields: nullable type ["T","null"]
 * - No oneOf/anyOf at root level
 * - additionalProperties: false on all objects
 */

/** All field names in the flat intent object (must match TextAIIntentFlat). */
const ALL_FIELDS = [
  'command',
  'content',
  'positionX',
  'positionY',
  'layer',
  'bold',
  'italic',
  'height',
  'fontFamily',
  'justification',
  'colorAci',
  'newPositionX',
  'newPositionY',
  'rotation',
  'search',
  'replacement',
  'matchIndex',
  'caseSensitive',
  'paragraphIndex',
  'paragraphContent',
] as const;

export const TEXT_AI_INTENT_SCHEMA = {
  name: 'text_ai_intent',
  description: 'Maps a natural-language DXF text editing command to a structured action.',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ALL_FIELDS as unknown as string[],
    properties: {
      command: {
        type: 'string',
        enum: [
          'create_text',
          'update_style',
          'update_geometry',
          'update_paragraph',
          'replace_one',
          'replace_all',
          'delete',
        ],
      },
      // create_text ────────────────────────────────────────────────────────────
      content: { type: ['string', 'null'] },
      positionX: { type: ['number', 'null'] },
      positionY: { type: ['number', 'null'] },
      layer: { type: ['string', 'null'] },
      // update_style ───────────────────────────────────────────────────────────
      bold: { type: ['boolean', 'null'] },
      italic: { type: ['boolean', 'null'] },
      height: { type: ['number', 'null'] },
      fontFamily: { type: ['string', 'null'] },
      justification: { type: ['string', 'null'] },
      colorAci: { type: ['integer', 'null'] },
      // update_geometry ────────────────────────────────────────────────────────
      newPositionX: { type: ['number', 'null'] },
      newPositionY: { type: ['number', 'null'] },
      rotation: { type: ['number', 'null'] },
      // replace_one / replace_all ──────────────────────────────────────────────
      search: { type: ['string', 'null'] },
      replacement: { type: ['string', 'null'] },
      matchIndex: { type: ['integer', 'null'] },
      caseSensitive: { type: ['boolean', 'null'] },
      // update_paragraph ───────────────────────────────────────────────────────
      paragraphIndex: { type: ['integer', 'null'] },
      paragraphContent: { type: ['string', 'null'] },
    },
  },
} as const;
