/**
 * PROCUREMENT HANDLER — Purchase Order management via AI agent
 *
 * Tools: create_purchase_order, list_purchase_orders, get_purchase_order_status
 * Admin-only. Delegates to procurement-service (SSoT for PO business logic).
 *
 * @module services/ai-pipeline/tools/handlers/procurement-handler
 * @see ADR-267 Phase C (AI Telegram PO Creation)
 */

import 'server-only';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { AuthContext } from '@/lib/auth';
import type { POVatRate, PurchaseOrderStatus, CreatePurchaseOrderDTO } from '@/types/procurement';
import { PO_VAT_RATES } from '@/types/procurement';
import { createPO, getPO, listPOs } from '@/services/procurement';
import { findContactByName } from '../../shared/contact-lookup';
import {
  type AgenticContext,
  type ToolHandler,
  type ToolResult,
  logger,
} from '../executor-shared';

// ============================================================================
// VALID VAT RATES (derived from SSoT: PO_VAT_RATES)
// ============================================================================

const VALID_VAT_RATES = new Set<number>(PO_VAT_RATES.map(r => r.value));

// ============================================================================
// HANDLER
// ============================================================================

export class ProcurementHandler implements ToolHandler {
  readonly toolNames = [
    'create_purchase_order',
    'list_purchase_orders',
    'get_purchase_order_status',
  ] as const;

  async execute(
    toolName: string,
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    if (!ctx.isAdmin) {
      return { success: false, error: 'Procurement tools are admin-only.' };
    }

    switch (toolName) {
      case 'create_purchase_order':
        return this.handleCreate(args, ctx);
      case 'list_purchase_orders':
        return this.handleList(args, ctx);
      case 'get_purchase_order_status':
        return this.handleGetStatus(args, ctx);
      default:
        return { success: false, error: `Unknown procurement tool: ${toolName}` };
    }
  }

  // --------------------------------------------------------------------------
  // CREATE PURCHASE ORDER
  // --------------------------------------------------------------------------

  private async handleCreate(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const resolved = await this.resolveReferences(args, ctx);
    if (resolved.error) return { success: false, error: resolved.error };

    const items = this.parseItems(args);
    if (!items) {
      return { success: false, error: 'items must be a non-empty array of {description, quantity, unit, unitPrice, categoryCode}.' };
    }

    const rawTaxRate = typeof args.taxRate === 'number' ? args.taxRate : 24;
    const taxRate: POVatRate = VALID_VAT_RATES.has(rawTaxRate)
      ? (rawTaxRate as POVatRate)
      : 24;

    const dto: CreatePurchaseOrderDTO = {
      projectId: resolved.projectId,
      supplierId: resolved.supplierId,
      items,
      taxRate,
      dateNeeded: typeof args.dateNeeded === 'string' ? args.dateNeeded : null,
      supplierNotes: typeof args.supplierNotes === 'string' ? args.supplierNotes : null,
      internalNotes: typeof args.internalNotes === 'string' ? args.internalNotes : null,
    };

    const authCtx = this.buildAuthContext(ctx);
    const result = await createPO(authCtx, dto);

    logger.info('PO created via AI agent', {
      requestId: ctx.requestId,
      poId: result.id,
      poNumber: result.poNumber,
    });

    return {
      success: true,
      data: {
        poId: result.id,
        poNumber: result.poNumber,
        supplierId: resolved.supplierId,
        projectId: resolved.projectId,
        itemCount: items.length,
        taxRate,
      },
    };
  }

  // --------------------------------------------------------------------------
  // LIST PURCHASE ORDERS
  // --------------------------------------------------------------------------

  private async handleList(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const rawStatus = typeof args.status === 'string' ? args.status : null;
    const validStatuses: ReadonlySet<string> = new Set([
      'draft', 'approved', 'ordered', 'partially_delivered', 'delivered', 'closed', 'cancelled',
    ]);
    const status = rawStatus && validStatuses.has(rawStatus)
      ? (rawStatus as PurchaseOrderStatus)
      : undefined;

    const supplierId = typeof args.supplierId === 'string' ? args.supplierId : undefined;
    const projectId = typeof args.projectId === 'string' ? args.projectId : undefined;
    const rawLimit = typeof args.limit === 'number' ? args.limit : 20;
    const limit = Math.min(Math.max(1, rawLimit), 50);

    const pos = await listPOs({
      companyId: ctx.companyId,
      status,
      supplierId,
      projectId,
    });

    const sliced = pos.slice(0, limit);

    return {
      success: true,
      data: sliced.map(po => ({
        poId: po.id,
        poNumber: po.poNumber,
        status: po.status,
        supplierId: po.supplierId,
        projectId: po.projectId,
        total: po.total,
        itemCount: po.items.length,
        dateCreated: po.dateCreated,
        dateNeeded: po.dateNeeded,
        dateOrdered: po.dateOrdered,
      })),
      count: sliced.length,
    };
  }

  // --------------------------------------------------------------------------
  // GET PURCHASE ORDER STATUS
  // --------------------------------------------------------------------------

  private async handleGetStatus(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<ToolResult> {
    const poIdOrNumber = String(args.poId ?? '').trim();
    if (!poIdOrNumber) {
      return { success: false, error: 'poId is required.' };
    }

    const po = await this.findPO(poIdOrNumber, ctx.companyId);
    if (!po) {
      return { success: false, error: `Purchase order not found: ${poIdOrNumber}` };
    }

    return {
      success: true,
      data: {
        poId: po.id,
        poNumber: po.poNumber,
        status: po.status,
        supplierId: po.supplierId,
        projectId: po.projectId,
        subtotal: po.subtotal,
        taxRate: po.taxRate,
        taxAmount: po.taxAmount,
        total: po.total,
        items: po.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          total: item.total,
          categoryCode: item.categoryCode,
          quantityReceived: item.quantityReceived,
          quantityRemaining: item.quantityRemaining,
        })),
        dateCreated: po.dateCreated,
        dateNeeded: po.dateNeeded,
        dateOrdered: po.dateOrdered,
        dateDelivered: po.dateDelivered,
        linkedInvoiceIds: po.linkedInvoiceIds,
        supplierNotes: po.supplierNotes,
      },
    };
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  /** Resolve supplier and project references (name → ID). Returns error string or null. */
  private async resolveReferences(
    args: Record<string, unknown>,
    ctx: AgenticContext
  ): Promise<{ supplierId: string; projectId: string; error: string | null }> {
    let supplierId = typeof args.supplierId === 'string' && args.supplierId ? args.supplierId : '';
    let projectId = typeof args.projectId === 'string' && args.projectId ? args.projectId : '';

    // Resolve supplier by name
    if (!supplierId) {
      const name = typeof args.supplierName === 'string' ? args.supplierName.trim() : '';
      if (!name) return { supplierId: '', projectId: '', error: 'Either supplierId or supplierName is required.' };

      const matches = await findContactByName(name, ctx.companyId, 5);
      if (matches.length === 0) {
        return { supplierId: '', projectId: '', error: `No supplier found matching "${name}". Create the contact first.` };
      }
      if (matches.length > 1) {
        const list = matches.map(m => `${m.name} (${m.contactId})`).join(', ');
        return { supplierId: '', projectId: '', error: `Multiple matches for "${name}": ${list}. Use supplierId to specify.` };
      }
      supplierId = matches[0].contactId;
    }

    // Resolve project by name
    if (!projectId) {
      const name = typeof args.projectName === 'string' ? args.projectName.trim() : '';
      if (!name) return { supplierId, projectId: '', error: 'Either projectId or projectName is required.' };

      const found = await this.findProjectByName(name, ctx.companyId);
      if (!found) {
        return { supplierId, projectId: '', error: `No project found matching "${name}".` };
      }
      projectId = found;
    }

    return { supplierId, projectId, error: null };
  }

  /** Search projects by name (fuzzy, case-insensitive) */
  private async findProjectByName(
    name: string,
    companyId: string
  ): Promise<string | null> {
    const db = getAdminFirestore();
    const snapshot = await db
      .collection(COLLECTIONS.PROJECTS)
      .where('companyId', '==', companyId)
      .limit(50)
      .get();

    const normalised = name.toLowerCase();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const projectName = String(data.name ?? data.title ?? '').toLowerCase();
      if (projectName.includes(normalised) || normalised.includes(projectName)) {
        return doc.id;
      }
    }
    return null;
  }

  /** Find PO by ID or PO number */
  private async findPO(
    idOrNumber: string,
    companyId: string
  ): Promise<import('@/types/procurement').PurchaseOrder | null> {
    // Try direct ID first
    const direct = await getPO(idOrNumber);
    if (direct && direct.companyId === companyId && !direct.isDeleted) {
      return direct;
    }

    // Try by PO number (e.g. "PO-0042")
    const pos = await listPOs({ companyId });
    return pos.find(po => po.poNumber === idOrNumber && !po.isDeleted) ?? null;
  }

  /** Parse and validate items array from AI args */
  private parseItems(
    args: Record<string, unknown>
  ): CreatePurchaseOrderDTO['items'] | null {
    if (!Array.isArray(args.items) || args.items.length === 0) return null;

    const items: CreatePurchaseOrderDTO['items'] = [];
    for (const raw of args.items) {
      if (typeof raw !== 'object' || !raw) return null;
      const item = raw as Record<string, unknown>;

      const description = String(item.description ?? '').trim();
      const quantity = Number(item.quantity);
      const unit = String(item.unit ?? 'τεμ').trim();
      const unitPrice = Number(item.unitPrice);
      const categoryCode = String(item.categoryCode ?? '').trim();

      if (!description || isNaN(quantity) || quantity <= 0) return null;
      if (isNaN(unitPrice) || unitPrice < 0) return null;
      if (!categoryCode) return null;

      items.push({
        description,
        quantity,
        unit,
        unitPrice,
        total: quantity * unitPrice,
        categoryCode,
        boqItemId: null,
      });
    }

    return items.length > 0 ? items : null;
  }

  /** Build AuthContext for procurement-service calls */
  private buildAuthContext(ctx: AgenticContext): AuthContext {
    return {
      uid: ctx.channelSenderId,
      email: 'ai-agent@nestor.app',
      companyId: ctx.companyId,
      globalRole: 'super_admin',
      mfaEnrolled: false,
      isAuthenticated: true,
    };
  }
}
