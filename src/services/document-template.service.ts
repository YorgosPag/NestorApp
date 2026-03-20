/**
 * =============================================================================
 * Document Template Service — Reusable document templates
 * =============================================================================
 *
 * Manages document templates (contracts, permits, invoices) with
 * variable interpolation and PDF generation capability.
 *
 * @module services/document-template.service
 * @enterprise ADR-191 Phase 4.1 — Document Templates
 */

import {
  collection,
  doc,
  setDoc,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  deleteDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';

// ============================================================================
// TYPES
// ============================================================================

export type TemplateCategory =
  | 'contract'
  | 'permit'
  | 'invoice'
  | 'report'
  | 'letter'
  | 'certificate'
  | 'other';

export interface TemplateVariable {
  /** Variable key (e.g., "clientName") */
  key: string;
  /** Display label (e.g., "Όνομα πελάτη") */
  label: string;
  /** Variable type */
  type: 'text' | 'number' | 'date' | 'currency';
  /** Default value */
  defaultValue: string;
  /** Is this required? */
  required: boolean;
}

export interface DocumentTemplate {
  /** Document ID */
  id: string;
  /** Company ID for tenant isolation */
  companyId: string;
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Category */
  category: TemplateCategory;
  /** HTML content with {{variable}} placeholders */
  content: string;
  /** Defined variables */
  variables: TemplateVariable[];
  /** Who created */
  createdBy: string;
  /** Creation timestamp */
  createdAt: Date | string;
  /** Last update */
  updatedAt: Date | string | null;
  /** Is this a system template (non-deletable)? */
  isSystem: boolean;
}

export interface CreateTemplateInput {
  companyId: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  content: string;
  variables: TemplateVariable[];
  createdBy: string;
}

// ============================================================================
// SERVICE
// ============================================================================

export const DocumentTemplateService = {
  /**
   * Create a new template
   */
  async createTemplate(input: CreateTemplateInput): Promise<string> {
    const { generateTemplateId } = await import('@/services/enterprise-id.service');
    const enterpriseId = generateTemplateId();
    const docRef = doc(db, COLLECTIONS.DOCUMENT_TEMPLATES, enterpriseId);
    await setDoc(docRef, {
      companyId: input.companyId,
      name: input.name,
      description: input.description ?? '',
      category: input.category,
      content: input.content,
      variables: input.variables,
      createdBy: input.createdBy,
      createdAt: serverTimestamp(),
      updatedAt: null,
      isSystem: false,
    });
    return enterpriseId;
  },

  /**
   * Get all templates for a company
   */
  async getTemplates(companyId: string): Promise<DocumentTemplate[]> {
    const q = query(
      collection(db, COLLECTIONS.DOCUMENT_TEMPLATES),
      where('companyId', '==', companyId),
      orderBy('category', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as DocumentTemplate[];
  },

  /**
   * Get a single template
   */
  async getTemplate(templateId: string): Promise<DocumentTemplate | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.DOCUMENT_TEMPLATES, templateId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as DocumentTemplate;
  },

  /**
   * Update a template
   */
  // TODO(ADR-253-RC-7): Wrap in runTransaction for atomic operations
  async updateTemplate(
    templateId: string,
    updates: Partial<Pick<DocumentTemplate, 'name' | 'description' | 'category' | 'content' | 'variables'>>
  ): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.DOCUMENT_TEMPLATES, templateId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTIONS.DOCUMENT_TEMPLATES, templateId));
  },

  /**
   * Render template with variable values
   */
  renderTemplate(
    content: string,
    values: Record<string, string>
  ): string {
    let rendered = content;
    for (const [key, value] of Object.entries(values)) {
      rendered = rendered.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        value
      );
    }
    return rendered;
  },
};
