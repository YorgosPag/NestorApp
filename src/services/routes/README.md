# 🏢 Enterprise Route Configuration System

## 📋 Overview

Το Enterprise Route Configuration System αντικαθιστά τα hardcoded route arrays με μια πλήρως configurable, database-driven λύση για multi-tenant deployments.

## ✨ Features

### 🎯 Core Features
- **Database-driven configuration** - Όλες οι routes αποθηκεύονται στη Firebase
- **Multi-tenant support** - Διαφορετική configuration ανά εταιρεία
- **Role-based access** - Routes φορτώνονται βάσει user role
- **Environment-specific** - Διαφορετικές routes για dev/staging/production
- **Performance optimization** - Smart caching και priority-based loading
- **Fallback support** - Λειτουργεί offline με fallback configuration

### ⚙️ Enterprise Features
- **Real-time updates** - Configuration αλλάζει χωρίς restart
- **A/B testing support** - Διαφορετικές routes για διαφορετικούς users
- **Analytics integration** - Tracking route performance
- **Audit logging** - Παρακολούθηση configuration changes
- **Security controls** - Role-based configuration management

## 🚀 Quick Start

### 1. Initialize Configuration

```bash
# Run migration script to setup initial configuration
node scripts/migrate-route-config.js --tenant=your-company --environment=production
```

### 2. Use in Your Components

```typescript
import { preloadUserRoutes, getEnterpriseRouteConfig } from '@/utils/preloadRoutes';
import type { UserRole } from '@/services/routes/EnterpriseRouteConfigService';

// Preload routes based on user role
const userRole: UserRole = 'admin';
const tenantId = 'company-a';

preloadUserRoutes(userRole, tenantId);

// Get current route configuration
const routeConfig = await getEnterpriseRouteConfig(userRole, tenantId);
console.log('Routes to preload:', routeConfig);
```

### 3. Update Configuration

```typescript
import { routeConfigService } from '@/services/routes/EnterpriseRouteConfigService';

// Update existing route
await routeConfigService.updateRouteConfig('buildings-critical', {
  isEnabled: false,
  priority: 5
});

// Add new route
await routeConfigService.addRouteConfig({
  route: 'new-feature',
  category: 'admin',
  priority: 10,
  requiredRoles: ['admin'],
  isEnabled: true,
  environment: 'production'
});
```

## 📊 Configuration Schema

### RouteConfig Interface

```typescript
interface RouteConfig {
  id: string;                    // Unique identifier
  route: PreloadableRoute;       // Route name
  category: RouteCategory;       // critical | admin | idle | user-specific
  priority: number;              // Loading priority (lower = higher priority)
  requiredRoles: UserRole[];     // Required user roles
  isEnabled: boolean;            // Enable/disable route
  preloadOnIdle?: boolean;       // Preload during idle time
  preloadOnHover?: boolean;      // Preload on link hover
  environment?: string;          // Target environment
  tenantId?: string;            // Tenant-specific configuration
  order: number;                // Display order
  metadata?: {
    description?: string;
    estimatedLoadTime?: number;  // Load time in milliseconds
    bundleSize?: number;         // Bundle size in bytes
    dependencies?: string[];     // Required dependencies
  };
}
```

### Route Categories

| Category | Description | Use Case |
|----------|-------------|----------|
| `critical` | Essential routes loaded immediately | Core navigation |
| `admin` | Administrative routes for power users | Admin panels |
| `idle` | Non-critical routes loaded during idle | Secondary features |
| `user-specific` | Routes specific to user roles | Personalized content |

## 🔧 Configuration Management

### Firebase Collection Structure

```
collections/config/
├── buildings-critical          # Critical route config
├── contacts-critical          # Critical route config
├── dxf-viewer-admin          # Admin route config
├── crm-dashboard-admin       # Admin route config
└── properties-idle           # Idle route config
```

### Environment Variables

```bash
# Firebase Collection Name (default: 'config')
NEXT_PUBLIC_CONFIG_COLLECTION=config

# Environment-specific route filtering
NODE_ENV=production

# Tenant identification
NEXT_PUBLIC_TENANT_ID=company-a
```

## 📈 Performance Optimization

### Loading Strategies

1. **Critical Routes** - Loaded immediately on app start
2. **Role-based Routes** - Loaded based on authenticated user role
3. **Idle Routes** - Loaded during browser idle time
4. **Hover Routes** - Loaded when user hovers over navigation

### Caching Strategy

- **In-memory cache** - 5 minute TTL for route configurations
- **Fallback cache** - Offline-capable with hardcoded fallbacks
- **Cache invalidation** - Manual cache clearing for immediate updates

### Bundle Size Optimization

```typescript
// Route metadata tracks bundle sizes
metadata: {
  bundleSize: 120000,           // 120KB
  estimatedLoadTime: 800,       // 800ms
  dependencies: ['@/components/buildings']
}
```

## 🛡️ Security & Access Control

### Role-based Access

```typescript
// Admin users get all routes
requiredRoles: ['admin']

// Agent users get limited routes
requiredRoles: ['admin', 'agent']

// All users get basic routes
requiredRoles: ['admin', 'agent', 'user']
```

### Tenant Isolation

```typescript
// Tenant-specific routes
{
  id: 'custom-feature-company-a',
  tenantId: 'company-a',
  route: 'custom-dashboard',
  // ... other config
}
```

## 🔄 Migration Guide

### From Hardcoded Routes

**Before:**
```typescript
// ❌ Hardcoded routes
export const CRITICAL_ROUTES = ['buildings', 'contacts'];
export const ADMIN_ROUTES = ['dxf-viewer', 'crm-dashboard'];
export const IDLE_ROUTES = ['properties'];
```

**After:**
```typescript
// ✅ Database-driven routes
import { routeConfigService } from '@/services/routes/EnterpriseRouteConfigService';

const routes = await routeConfigService.getRoutesForRole('admin', 'company-a');
```

### Migration Steps

1. **Run migration script:**
   ```bash
   node scripts/migrate-route-config.js
   ```

2. **Update imports:**
   ```typescript
   // Old import
   import { CRITICAL_ROUTES } from '@/utils/preloadRoutes';

   // New import
   import { getEnterpriseRouteConfig } from '@/utils/preloadRoutes';
   ```

3. **Update function calls:**
   ```typescript
   // Old usage
   preloadUserRoutes('admin');

   // New usage
   preloadUserRoutes('admin', 'company-a');
   ```

## 📚 API Reference

### EnterpriseRouteConfigService

#### Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `loadRouteConfig()` | Load all route configurations | `tenantId?: string` |
| `getRoutesByCategory()` | Get routes grouped by category | `userRole?: UserRole, tenantId?: string` |
| `getRoutesForRole()` | Get routes for specific user role | `userRole: UserRole, tenantId?: string` |
| `updateRouteConfig()` | Update existing route configuration | `configId: string, updates: Partial<RouteConfig>` |
| `addRouteConfig()` | Add new route configuration | `config: Omit<RouteConfig, 'id'>` |
| `invalidateCache()` | Clear configuration cache | None |

#### Usage Examples

```typescript
import { routeConfigService } from '@/services/routes/EnterpriseRouteConfigService';

// Load all configurations
const allConfigs = await routeConfigService.loadRouteConfig('company-a');

// Get admin routes
const adminRoutes = await routeConfigService.getRoutesForRole('admin', 'company-a');

// Update configuration
await routeConfigService.updateRouteConfig('buildings-critical', {
  priority: 1,
  isEnabled: true
});
```

## 🧪 Testing

### Unit Tests

```typescript
import { routeConfigService } from '@/services/routes/EnterpriseRouteConfigService';

describe('Enterprise Route Config', () => {
  it('should load routes for admin user', async () => {
    const routes = await routeConfigService.getRoutesForRole('admin');
    expect(routes).toContain('dxf-viewer');
    expect(routes).toContain('crm-dashboard');
  });

  it('should filter routes by tenant', async () => {
    const routes = await routeConfigService.loadRouteConfig('company-a');
    expect(routes.every(r => !r.tenantId || r.tenantId === 'company-a')).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe('Route Preloading Integration', () => {
  it('should preload critical routes immediately', async () => {
    const mockUser = { role: 'admin', tenantId: 'company-a' };

    preloadUserRoutes(mockUser.role, mockUser.tenantId);

    // Verify critical routes are preloaded
    expect(mockPreloadRoute).toHaveBeenCalledWith('buildings');
    expect(mockPreloadRoute).toHaveBeenCalledWith('contacts');
  });
});
```

## 🚨 Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Routes not loading | Firebase credentials | Check Firebase configuration |
| Cache not updating | Stale cache | Call `invalidateCache()` |
| Tenant routes missing | Wrong tenant filter | Verify `tenantId` parameter |
| Performance issues | Too many routes | Optimize route priority and bundling |

### Debugging

```typescript
// Enable debug logging
localStorage.setItem('debug-routes', 'true');

// Check current configuration
const config = await routeConfigService.loadRouteConfig();
console.log('Current route config:', config);

// Clear cache manually
routeConfigService.invalidateCache();
```

## 📝 Best Practices

### Configuration Management

1. **Use semantic IDs**: `feature-category-role` (e.g., `buildings-critical-admin`)
2. **Set realistic priorities**: Lower numbers = higher priority
3. **Monitor bundle sizes**: Keep bundles under 200KB when possible
4. **Document metadata**: Include descriptions and dependencies

### Performance

1. **Limit critical routes**: Keep to 2-3 essential routes
2. **Use idle loading**: Load non-critical routes during idle time
3. **Cache appropriately**: 5-minute cache for most use cases
4. **Monitor metrics**: Track load times and bundle sizes

### Security

1. **Role validation**: Always validate user roles server-side
2. **Tenant isolation**: Ensure tenant-specific routes are properly filtered
3. **Environment filtering**: Use environment-specific configurations
4. **Audit changes**: Log all configuration updates

## 🔮 Future Enhancements

- [ ] **A/B Testing Integration** - Route configurations for testing
- [ ] **Analytics Dashboard** - Route performance monitoring
- [ ] **Auto-optimization** - ML-based route priority adjustment
- [ ] **CDN Integration** - Edge-cached route configurations
- [ ] **GraphQL Support** - Alternative to REST API
- [ ] **Real-time Updates** - WebSocket-based configuration updates

---

## 📞 Support

For questions or issues with the Enterprise Route Configuration System:

1. **Documentation**: Check this README and code comments
2. **Issues**: Create GitHub issues for bugs or feature requests
3. **Migration Help**: Use the provided migration scripts and guides
4. **Performance**: Monitor route loading metrics and optimize accordingly

---

*Part of the Enterprise Configuration Management System*