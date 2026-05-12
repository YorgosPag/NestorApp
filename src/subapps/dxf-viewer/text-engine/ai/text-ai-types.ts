/**
 * ADR-344 Phase 12 — Shared types for DXF text AI integration.
 *
 * TextAIIntentFlat is the wire format returned by the OpenAI call (strict
 * json_schema — flat object with nullable fields, discriminated by `command`).
 *
 * TextAIIntent is the validated discriminated union used in TypeScript code.
 * TextAIContext carries the runtime objects needed to build an ICommand.
 * TextAIRouterResult is the final output of TextAICommandRouter.
 */

import type { ICommand } from '../../core/commands/interfaces';
import type { DxfTextSceneEntity, ILayerAccessProvider, IDxfTextAuditRecorder } from '../../core/commands/text/types';
import type { ISceneManager } from '../../core/commands/interfaces';

// ── Wire format (strict flat schema from OpenAI) ──────────────────────────────

/** Flat object returned by OpenAI strict json_schema. All unused fields = null. */
export interface TextAIIntentFlat {
  readonly command:
    | 'create_text'
    | 'update_style'
    | 'update_geometry'
    | 'update_paragraph'
    | 'replace_one'
    | 'replace_all'
    | 'delete';

  // create_text
  readonly content: string | null;
  readonly positionX: number | null;
  readonly positionY: number | null;
  readonly layer: string | null;

  // update_style
  readonly bold: boolean | null;
  readonly italic: boolean | null;
  readonly height: number | null;
  readonly fontFamily: string | null;
  /** 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFY' */
  readonly justification: string | null;
  /** DXF ACI color index (1–255). */
  readonly colorAci: number | null;

  // update_geometry
  readonly newPositionX: number | null;
  readonly newPositionY: number | null;
  readonly rotation: number | null;

  // replace_one / replace_all
  readonly search: string | null;
  readonly replacement: string | null;
  readonly matchIndex: number | null;
  readonly caseSensitive: boolean | null;

  // update_paragraph
  readonly paragraphIndex: number | null;
  readonly paragraphContent: string | null;
}

// ── Runtime context ───────────────────────────────────────────────────────────

/** Runtime objects + entity ID needed to instantiate an ICommand. */
export interface TextAIContext {
  readonly entityId: string;
  readonly scene: ISceneManager;
  readonly layerProvider: ILayerAccessProvider;
  readonly auditRecorder: IDxfTextAuditRecorder;
}

// ── Router result ─────────────────────────────────────────────────────────────

export type TextAIRouterResult =
  | { readonly ok: true; readonly command: ICommand }
  | { readonly ok: false; readonly error: string };
