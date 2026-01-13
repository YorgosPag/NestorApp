# 🎨 Enterprise Polygon Styling System

## 📋 Overview

Το Enterprise Polygon Styling System αντικαθιστά τα hardcoded DEFAULT_POLYGON_STYLES με μια πλήρως configurable, database-driven λύση για multi-tenant deployments με theme support.

## ✨ Features

### 🎯 Core Features
- **Database-driven styling** - Όλα τα polygon styles αποθηκεύονται στη Firebase
- **Multi-theme support** - Default, Dark, High-Contrast και custom themes
- **Multi-tenant styling** - Διαφορετικά styles ανά εταιρεία
- **Accessibility compliance** - WCAG AA/AAA compliant colors
- **Environment-specific** - Διαφορετικά styles για dev/staging/production
- **Real-time updates** - Style changes χωρίς restart
- **Performance optimization** - Smart caching και preloading

### 🎨 Theme Features
- **System themes** - Default, Dark, High-Contrast
- **Brand themes** - Company-specific color schemes
- **Accessibility themes** - High-contrast και color-blind friendly
- **Custom themes** - Fully customizable theme creation
- **Theme inheritance** - Base themes με overrides

## 🚀 Quick Start

### 1. Initialize Polygon Styles

```bash
# Run migration script to setup polygon style configuration
node scripts/migrate-polygon-styles.js --themes=default,dark,high-contrast
```

### 2. Use in React Components

```typescript
import { usePolygonStyles, usePolygonStyle } from '@/hooks/usePolygonStyles';
import type { PolygonType } from '@core/polygon-system/types';

// Full styles hook
function PolygonRenderer() {
  const {
    styles,
    loading,
    switchTheme,
    currentTheme
  } = usePolygonStyles({
    theme: 'default',
    tenantId: 'company-a'
  });

  if (loading) return <div>Loading styles...</div>;

  return (
    <div>
      <button onClick={() => switchTheme('dark')}>
        Switch to Dark Theme
      </button>
      {/* Use styles for polygon rendering */}
    </div>
  );
}

// Single style hook
function AlertZone() {
  const { style, loading } = usePolygonStyle('alert-zone', {
    theme: 'high-contrast',
    tenantId: 'company-a'
  });

  if (loading || !style) return null;

  return (
    <polygon
      stroke={style.strokeColor}
      fill={style.fillColor}
      strokeWidth={style.strokeWidth}
      fillOpacity={style.fillOpacity}
    />
  );
}
```

### 3. Direct Service Usage

```typescript
import { polygonStyleService } from '@/services/polygon/EnterprisePolygonStyleService';

// Load all styles για theme
const styles = await polygonStyleService.loadPolygonStyles('dark', 'company-a');

// Get specific style
const alertStyle = await polygonStyleService.getPolygonStyle('alert-zone', 'default');

// Get available themes
const themes = await polygonStyleService.getAvailableThemes('company-a');
```

## 📊 Polygon Types & Styling

### Available Polygon Types

| Type | Description | Default Use Case |
|------|-------------|------------------|
| `simple` | Basic polygon drawing | General-purpose shapes |
| `georeferencing` | Geographic control points | Map alignment |
| `alert-zone` | Critical monitoring areas | Security & alerts |
| `real-estate` | Property analysis zones | Real estate monitoring |
| `measurement` | Area/distance tools | Measurements |
| `annotation` | Notes & comments | Documentation |

### Style Properties

```typescript
interface PolygonStyle {
  strokeColor: string;      // Border color
  fillColor: string;        // Fill color
  strokeWidth: number;      // Border thickness
  fillOpacity: number;      // Fill transparency (0-1)
  strokeOpacity: number;    // Border transparency (0-1)
  strokeDash?: number[];    // Dash pattern
  pointRadius?: number;     // Vertex point size
  pointColor?: string;      // Vertex point color
}
```

## 🎨 Theme System

### Built-in Themes

#### 1. Default Theme (WCAG AA)
```typescript
// Enhanced colors για better accessibility
{
  'alert-zone': {
    strokeColor: '#dc2626',  // Enhanced red
    fillColor: '#ef4444',
    fillOpacity: 0.2,
    // ...
  }
}
```

#### 2. Dark Theme
```typescript
// Optimized για dark environments
{
  'alert-zone': {
    strokeColor: '#f87171',  // Lighter red για dark backgrounds
    fillColor: '#ef4444',
    fillOpacity: 0.25,
    // ...
  }
}
```

#### 3. High-Contrast Theme (WCAG AAA)
```typescript
// Maximum contrast για accessibility
{
  'alert-zone': {
    strokeColor: '#cc0000',  // High contrast red
    fillColor: '#ff3333',
    strokeWidth: 4,          // Thicker lines
    fillOpacity: 0.4,
    // ...
  }
}
```

### Custom Theme Creation

```typescript
// Add custom brand theme
await polygonStyleService.addStyleConfig({
  polygonType: 'alert-zone',
  style: {
    strokeColor: '#your-brand-color',
    fillColor: '#your-brand-fill',
    strokeWidth: 3,
    fillOpacity: 0.2,
    strokeOpacity: 1
  },
  theme: 'brand-theme',
  tenantId: 'your-company',
  isEnabled: true,
  priority: 1,
  metadata: {
    displayName: 'Brand Alert Zone',
    description: 'Company-specific alert zone styling',
    category: 'brand'
  }
});
```

## 🏢 Multi-Tenant Configuration

### Tenant-Specific Styling

```typescript
// Company A - Professional blue theme
const companyAStyles = await polygonStyleService.loadPolygonStyles(
  'default',
  'company-a'
);

// Company B - Modern green theme
const companyBStyles = await polygonStyleService.loadPolygonStyles(
  'brand-green',
  'company-b'
);
```

### Environment-Specific Styles

```typescript
// Development - Bright colors για easy identification
const devStyles = await polygonStyleService.loadPolygonStyles(
  'development',
  tenantId,
  'development'
);

// Production - Professional colors
const prodStyles = await polygonStyleService.loadPolygonStyles(
  'default',
  tenantId,
  'production'
);
```

## 📈 Performance Optimization

### Caching Strategy

```typescript
// Styles cached για 10 minutes
const styles = await polygonStyleService.loadPolygonStyles('default');

// Manual cache control
polygonStyleService.invalidateCache();
polygonStyleService.clearCacheForTenant('company-a');
```

### Preloading

```typescript
import { usePolygonStylePreloader } from '@/hooks/usePolygonStyles';

function App() {
  const {
    preloadedThemes,
    isPreloading,
    preloadAllThemes
  } = usePolygonStylePreloader(['default', 'dark', 'high-contrast']);

  useEffect(() => {
    // Preload themes during idle time
    preloadAllThemes();
  }, []);

  return <div>App with preloaded themes</div>;
}
```

## 🛡️ Accessibility Compliance

### WCAG Standards

| Theme | WCAG Level | Contrast Ratio | Color Blind Safe |
|-------|------------|----------------|------------------|
| Default | AA | 4.5:1 | ✅ |
| Dark | A | 3.0:1 | ✅ |
| High-Contrast | AAA | 7.0:1 | ✅ |

### Accessibility Features

```typescript
// Check accessibility compliance
const style = await polygonStyleService.getPolygonStyle('alert-zone', 'high-contrast');

// Metadata includes accessibility information
console.log(style.metadata?.accessibility);
// {
//   wcagCompliant: true,
//   contrastRatio: 7.0,
//   colorBlindSafe: true
// }
```

## 🔄 Migration Guide

### From Hardcoded Styles

**Before:**
```typescript
// ❌ Hardcoded styles
import { DEFAULT_POLYGON_STYLES } from 'packages/core/polygon-system/types';

const alertStyle = DEFAULT_POLYGON_STYLES['alert-zone'];
```

**After:**
```typescript
// ✅ Database-driven styles
import { usePolygonStyle } from '@/hooks/usePolygonStyles';

const { style: alertStyle } = usePolygonStyle('alert-zone', {
  theme: 'default',
  tenantId: 'company-a'
});
```

### Migration Steps

1. **Run migration script:**
   ```bash
   node scripts/migrate-polygon-styles.js --tenant=your-company
   ```

2. **Update component imports:**
   ```typescript
   // Old
   import { DEFAULT_POLYGON_STYLES } from 'packages/core/polygon-system/types';

   // New
   import { usePolygonStyles } from '@/hooks/usePolygonStyles';
   ```

3. **Replace style usage:**
   ```typescript
   // Old
   const style = DEFAULT_POLYGON_STYLES[polygonType];

   // New
   const { getStyle } = usePolygonStyles();
   const style = getStyle(polygonType);
   ```

## 📚 API Reference

### EnterprisePolygonStyleService

#### Core Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `loadPolygonStyles()` | Load all styles για theme/tenant | `theme?: string, tenantId?: string, environment?: string` |
| `getPolygonStyle()` | Get style για specific polygon type | `polygonType: PolygonType, theme?: string, tenantId?: string` |
| `getAvailableThemes()` | Get list of available themes | `tenantId?: string` |
| `updateStyleConfig()` | Update style configuration | `configId: string, updates: Partial<EnterprisePolygonStyleConfig>` |
| `addStyleConfig()` | Add new style configuration | `config: Omit<EnterprisePolygonStyleConfig, 'id'>` |

#### Cache Management

| Method | Description |
|--------|-------------|
| `invalidateCache()` | Clear all style caches |
| `clearCacheForTenant()` | Clear cache for specific tenant |

### React Hooks

#### usePolygonStyles()

```typescript
const {
  styles,              // All polygon styles
  loading,             // Loading state
  error,               // Error state
  availableThemes,     // Available theme list
  currentTheme,        // Current active theme
  getStyle,            // Get style function
  switchTheme,         // Switch theme function
  reloadStyles,        // Reload από database
  clearCache,          // Clear cache
  isReady,             // Ready state check
  hasTheme             // Theme availability check
} = usePolygonStyles({
  theme: 'default',
  tenantId: 'company-a',
  environment: 'production',
  autoReload: true,
  debug: false
});
```

#### usePolygonStyle()

```typescript
const {
  style,    // Single polygon style
  loading,  // Loading state
  error,    // Error state
  reload    // Reload function
} = usePolygonStyle('alert-zone', {
  theme: 'dark',
  tenantId: 'company-a'
});
```

## 🧪 Testing

### Unit Tests

```typescript
describe('Enterprise Polygon Styling', () => {
  it('should load styles για default theme', async () => {
    const styles = await polygonStyleService.loadPolygonStyles('default');

    expect(styles).toBeDefined();
    expect(styles['alert-zone']).toBeDefined();
    expect(styles['alert-zone'].strokeColor).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('should cache styles for performance', async () => {
    const spy = jest.spyOn(polygonStyleService, 'loadPolygonStyles');

    await polygonStyleService.loadPolygonStyles('default');
    await polygonStyleService.loadPolygonStyles('default');

    expect(spy).toHaveBeenCalledTimes(1); // Second call uses cache
  });
});
```

### Component Tests

```typescript
describe('usePolygonStyles Hook', () => {
  it('should provide polygon styles', async () => {
    const { result, waitFor } = renderHook(() =>
      usePolygonStyles({ theme: 'default' })
    );

    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.styles).toBeDefined();
    expect(result.current.getStyle('alert-zone')).toBeDefined();
  });
});
```

## 🚨 Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Styles not loading | Firebase credentials | Check Firebase configuration |
| Theme not found | Invalid theme name | Check available themes list |
| Cache not updating | Stale cache | Call `invalidateCache()` |
| Colors not WCAG compliant | Old theme | Update to newer theme versions |

### Debugging

```typescript
// Enable debug mode
const { styles, error } = usePolygonStyles({
  theme: 'default',
  debug: true  // Enables console logging
});

// Check current cache
console.log(polygonStyleService.styleCache);

// Verify configuration
const config = await polygonStyleService.loadStyleConfigurations();
console.log('Current config:', config);
```

## 📝 Best Practices

### Performance

1. **Use preloading**: Preload themes during idle time
2. **Cache appropriately**: 10-minute cache για most use cases
3. **Batch style loading**: Load all styles at once για components
4. **Theme switching**: Use React.memo για style-dependent components

### Accessibility

1. **Test contrast ratios**: Ensure WCAG compliance
2. **Support high-contrast**: Provide high-contrast theme option
3. **Color-blind friendly**: Test με color-blind simulation tools
4. **Consistent styling**: Use consistent patterns across polygon types

### Configuration

1. **Use semantic IDs**: `polygon-style-type-theme` format
2. **Document metadata**: Include descriptions και accessibility info
3. **Environment separation**: Use environment-specific configurations
4. **Tenant isolation**: Ensure proper tenant filtering

### Development

1. **Type safety**: Use TypeScript types για all style operations
2. **Error handling**: Handle async loading gracefully
3. **Fallback support**: Always provide fallback styles
4. **Cache management**: Clear cache during development

## 🔮 Future Enhancements

- [ ] **Visual Theme Editor** - UI για creating και editing themes
- [ ] **A/B Testing** - Theme testing για UX optimization
- [ ] **Analytics Integration** - Track theme usage και performance
- [ ] **CSS Variables Export** - Export themes as CSS custom properties
- [ ] **Design System Integration** - Integration με design token systems
- [ ] **Animation Support** - Animated transitions between themes

---

## 📞 Support

For questions or issues με the Enterprise Polygon Styling System:

1. **Documentation**: Check this README και service code comments
2. **Migration**: Use provided migration scripts και guides
3. **Performance**: Monitor style loading metrics και cache usage
4. **Accessibility**: Test themes με accessibility tools

---

*Part of the Enterprise Configuration Management System*