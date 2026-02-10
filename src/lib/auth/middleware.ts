/**
 * @fileoverview API Middleware - RFC v6 Implementation
 * @version 1.0.0
 * @author Nestor Construct Platform
 * @since 2026-01-14
 *
 * Higher-order functions for API route authentication and authorization.
 * Provides `withAuth()` wrapper that handles context building, permission
 * checking, and error responses.
 *
 * @see docs/rfc/authorization-rbac.md
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import type { AuthContext, GlobalRole, PermissionId } from './types';
import { isAuthenticated } from './types';
import { buildRequestContext } from './auth-context';
import {
  hasPermission,
  createPermissionCache,
  type PermissionCache,
  type PermissionCheckOptions,
} from './permissions';
import { apiErrorHandler } from '@/lib/api/ApiErrorHandler';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('middleware');

// =============================================================================
// TYPES
// =============================================================================

/**
 * Authenticated API handler type.
 * Receives AuthContext and PermissionCache.
 */
export type AuthenticatedHandler<T = unknown> = (
  request: NextRequest,
  context: AuthContext,
  cache: PermissionCache
) => Promise<NextResponse<T | ErrorResponse>>;

/**
 * WithAuth options.
 */
export interface WithAuthOptions {
  /** Required permission(s) - all must be granted */
  permissions?: PermissionId | PermissionId[];
  /** Permission check options (projectId, unitId, etc.) */
  permissionOptions?: PermissionCheckOptions | ((request: NextRequest) => PermissionCheckOptions);
  /** Required global role(s) - user must have at least one of these roles */
  requiredGlobalRoles?: GlobalRole | GlobalRole[];
  /** Allow unauthenticated access (handler receives RequestContext) */
  allowUnauthenticated?: boolean;
  /** Custom error response for unauthorized */
  unauthorizedResponse?: (reason: string) => NextResponse;
  /** Custom error response for forbidden */
  forbiddenResponse?: (permission: PermissionId) => NextResponse;
  /** Custom error response for role requirement failure */
  roleRequiredResponse?: (requiredRoles: GlobalRole[]) => NextResponse;
}

/**
 * Standard error response structure.
 */
interface ErrorResponse {
  error: string;
  code?: string;
  errorCode?: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// ERROR RESPONSES
// =============================================================================

/**
 * Create 401 Unauthorized response.
 */
function createUnauthorizedResponse(reason: string): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
      details: { reason },
    },
    { status: 401 }
  );
}

/**
 * Create 403 Forbidden response.
 */
function createForbiddenResponse(permission?: PermissionId): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: 'Permission denied',
      code: 'FORBIDDEN',
      details: permission ? { requiredPermission: permission } : undefined,
    },
    { status: 403 }
  );
}

/**
 * Create 403 response for role requirement failure.
 */
function createRoleRequiredResponse(requiredRoles: GlobalRole[]): NextResponse<ErrorResponse> {
  return NextResponse.json(
    {
      error: 'Insufficient role',
      code: 'ROLE_REQUIRED',
      details: { requiredRoles },
    },
    { status: 403 }
  );
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Wrap an API handler with authentication and authorization.
 *
 * This middleware:
 * 1. Builds request context from Authorization header
 * 2. Checks authentication (returns 401 if invalid)
 * 3. Checks permissions if specified (returns 403 if denied)
 * 4. Calls handler with AuthContext and PermissionCache
 *
 * @param handler - Authenticated API handler
 * @param options - Middleware options
 * @returns Wrapped handler
 *
 * @example
 * ```typescript
 * // Simple authentication only
 * export const GET = withAuth(async (request, ctx, cache) => {
 *   return NextResponse.json({ userId: ctx.uid });
 * });
 *
 * // With permission check
 * export const POST = withAuth(
 *   async (request, ctx, cache) => {
 *     // Permission already verified
 *     return NextResponse.json({ success: true });
 *   },
 *   {
 *     permissions: 'projects:projects:create',
 *   }
 * );
 *
 * // With dynamic permission options
 * export const PUT = withAuth(
 *   async (request, ctx, cache) => {
 *     return NextResponse.json({ success: true });
 *   },
 *   {
 *     permissions: 'projects:projects:update',
 *     permissionOptions: (request) => ({
 *       projectId: request.nextUrl.searchParams.get('projectId') || undefined,
 *     }),
 *   }
 * );
 * ```
 */
export function withAuth<T = unknown>(
  handler: AuthenticatedHandler<T>,
  options: WithAuthOptions = {}
): (request: NextRequest) => Promise<NextResponse<T | ErrorResponse>> {
  return async (request: NextRequest): Promise<NextResponse<T | ErrorResponse>> => {
    // Step 1: Build request context
    const ctx = await buildRequestContext(request);

    // Step 2: Check authentication
    if (!isAuthenticated(ctx)) {
      if (options.allowUnauthenticated) {
        // Handler can receive unauthenticated context
        // This is a type-unsafe escape hatch for public endpoints
        return handler(request, ctx as unknown as AuthContext, createPermissionCache());
      }

      const errorResponse = options.unauthorizedResponse
        ? options.unauthorizedResponse(ctx.reason)
        : createUnauthorizedResponse(ctx.reason);

      return errorResponse as NextResponse<ErrorResponse>;
    }

    // Step 3: Create permission cache
    const cache = createPermissionCache();

    // Step 4: Check global role requirement if specified
    if (options.requiredGlobalRoles) {
      const requiredRoles = Array.isArray(options.requiredGlobalRoles)
        ? options.requiredGlobalRoles
        : [options.requiredGlobalRoles];

      // User must have at least one of the required roles
      const hasRequiredRole = requiredRoles.includes(ctx.globalRole);
      if (!hasRequiredRole) {
        logger.warn(
          `[withAuth] Role denied: user ${ctx.uid} (role: ${ctx.globalRole}) ` +
          `tried to access route requiring one of: ${requiredRoles.join(', ')}`
        );
        const errorResponse = options.roleRequiredResponse
          ? options.roleRequiredResponse(requiredRoles)
          : createRoleRequiredResponse(requiredRoles);

        return errorResponse as NextResponse<ErrorResponse>;
      }
    }

    // Step 5: Check permissions if specified
    if (options.permissions) {
      const permissions = Array.isArray(options.permissions)
        ? options.permissions
        : [options.permissions];

      // Resolve permission options
      const permissionOpts = typeof options.permissionOptions === 'function'
        ? options.permissionOptions(request)
        : options.permissionOptions ?? {};

      // Check all required permissions
      for (const permission of permissions) {
        const hasAccess = await hasPermission(ctx, permission, permissionOpts, cache);
        if (!hasAccess) {
          const errorResponse = options.forbiddenResponse
            ? options.forbiddenResponse(permission)
            : createForbiddenResponse(permission);

          return errorResponse as NextResponse<ErrorResponse>;
        }
      }
    }

    // Step 6: Call handler with authenticated context + automatic error handling
    try {
      return await handler(request, ctx, cache);
    } catch (error) {
      // 🏢 ENTERPRISE: Central error handling - no need for per-endpoint wrappers
      return await apiErrorHandler.handleError(error, request, {
        operation: request.nextUrl.pathname,
        userId: ctx.uid,
        endpoint: request.nextUrl.pathname,
        metadata: {
          globalRole: ctx.globalRole,
          companyId: ctx.companyId,
        },
      });
    }
  };
}

/**
 * Require specific permissions for an API route.
 *
 * Convenience wrapper for common permission patterns.
 *
 * @param permissions - Required permission(s)
 * @param handler - Authenticated handler
 * @returns Wrapped handler
 *
 * @example
 * ```typescript
 * export const DELETE = requirePermissions(
 *   'projects:projects:delete',
 *   async (request, ctx, cache) => {
 *     // Delete project...
 *     return NextResponse.json({ deleted: true });
 *   }
 * );
 * ```
 */
export function requirePermissions<T = unknown>(
  permissions: PermissionId | PermissionId[],
  handler: AuthenticatedHandler<T>
): (request: NextRequest) => Promise<NextResponse<T | ErrorResponse>> {
  return withAuth(handler, { permissions });
}

/**
 * Create a middleware for project-scoped routes.
 *
 * Automatically extracts projectId from URL params or query.
 *
 * @param permission - Required permission
 * @param handler - Authenticated handler
 * @returns Wrapped handler
 *
 * @example
 * ```typescript
 * // Route: /api/projects/[projectId]/members
 * export const GET = withProjectAuth(
 *   'projects:members:view',
 *   async (request, ctx, cache) => {
 *     // ctx.companyId already validated
 *     return NextResponse.json({ members: [] });
 *   }
 * );
 * ```
 */
export function withProjectAuth<T = unknown>(
  permission: PermissionId,
  handler: AuthenticatedHandler<T>
): (request: NextRequest, context: { params: Promise<{ projectId: string }> }) => Promise<NextResponse<T | ErrorResponse>> {
  return async (
    request: NextRequest,
    routeContext: { params: Promise<{ projectId: string }> }
  ): Promise<NextResponse<T | ErrorResponse>> => {
    const params = await routeContext.params;
    const projectId = params.projectId;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID required', code: 'BAD_REQUEST' },
        { status: 400 }
      ) as NextResponse<ErrorResponse>;
    }

    const wrappedHandler = withAuth(handler, {
      permissions: permission,
      permissionOptions: { projectId },
    });

    return wrappedHandler(request);
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Extract bearer token from request.
 * Useful for manual token validation scenarios.
 *
 * @param request - NextRequest
 * @returns Token string or null
 */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Get authenticated context from request.
 * Returns null if not authenticated.
 *
 * @param request - NextRequest
 * @returns AuthContext or null
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  const ctx = await buildRequestContext(request);
  return isAuthenticated(ctx) ? ctx : null;
}
