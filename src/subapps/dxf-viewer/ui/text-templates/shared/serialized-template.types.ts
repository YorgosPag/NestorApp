/**
 * ADR-344 Phase 7.D — Wire shape for user text templates.
 *
 * Mirrors `_helpers.ts#SerializedUserTextTemplate` in the API route. Kept
 * here as a separate module so client code can import it without pulling
 * in the `server-only` service.
 */
import type {
  TextTemplateCategory,
} from '@/subapps/dxf-viewer/text-engine/templates';
import type { DxfTextNode } from '@/subapps/dxf-viewer/text-engine/types/text-ast.types';

export interface SerializedUserTextTemplate {
  readonly id: string;
  readonly companyId: string;
  readonly name: string;
  readonly category: TextTemplateCategory;
  readonly content: DxfTextNode;
  readonly placeholders: readonly string[];
  readonly isDefault: false;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly createdByName: string | null;
  readonly updatedBy: string;
  readonly updatedByName: string | null;
}
