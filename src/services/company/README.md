# 🏢 Enterprise Company Settings System

## 📋 Overview

Το Enterprise Company Settings System αντικαθιστά τα hardcoded company information με μια πλήρως configurable, database-driven λύση για multi-tenant deployments με enterprise-grade features.

## ✨ Features

### 🎯 Core Features
- **Database-driven configuration** - Όλα τα company settings αποθηκεύονται στη Firebase
- **Multi-tenant support** - Διαφορετικά settings ανά εταιρεία/tenant
- **Environment-specific** - Διαφορετικά settings για dev/staging/production
- **Real-time updates** - Setting changes χωρίς restart
- **Performance optimization** - Smart caching με 15-minute TTL
- **Fallback support** - Environment variables ως fallback

### 🏢 Enterprise Features
- **Template variable generation** - Automatic generation για communication templates
- **Quick contact API** - Fast access σε essential company contact info
- **Branding support** - Colors, logos, fonts configuration
- **Business operations** - Working hours, licenses, service areas
- **Communication templates** - Email signatures, auto-responders

## 🚀 Quick Start

### 1. Initialize Company Settings

```bash
# Run migration script to setup company settings configuration
node scripts/migrate-company-settings.js --tenant=your-company --environment=production
```

### 2. Use in React Components

```typescript
import { companySettingsService } from '@/services/company/EnterpriseCompanySettingsService';
import type { CompanySettings, CompanyQuickContact } from '@/services/company/EnterpriseCompanySettingsService';

// Load full company settings
const settings = await companySettingsService.loadCompanySettings('tenant-id');

// Get quick contact info για headers/footers
const quickContact = await companySettingsService.getQuickContact('tenant-id');

// Get template variables για communications
const templateVars = await companySettingsService.getTemplateVariables('tenant-id');
```

### 3. Integration με Communications Service

```typescript
import { companySettingsService } from '@/services/company/EnterpriseCompanySettingsService';

// Automatic template variable replacement
const templateVariables = await companySettingsService.getTemplateVariables();

// Use in message content
const messageContent = `
Dear {{clientName}},

Thank you for contacting {{companyName}}.

Best regards,
{{companyName}}
📧 {{companyEmail}}
📞 {{companyPhone}}
`;

// Variables will be replaced automatically
const processedMessage = replaceTemplateVariables(messageContent, templateVariables);
```

## 📊 Configuration Categories

### 1. Basic Settings (company-basic-settings)

```typescript
interface BasicCompanySettings {
  companyName: string;
  legalName: string;
  vatNumber: string;
  businessType: string;

  // Contact information
  email: string;
  phone: string;
  mobile: string;
  fax: string;

  // Address
  address: {
    street: string;
    city: string;
    postalCode: string;
    region: string;
    country: string;
    countryCode: string;
  };

  // Website & Social
  website: string;
  socialMedia: {
    facebook: string;
    instagram: string;
    linkedin: string;
    youtube: string;
  };
}
```

### 2. Branding Settings (company-branding-settings)

```typescript
interface BrandingSettings {
  // Brand identity
  logo: string;
  favicon: string;

  // Brand colors
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };

  // Typography
  fonts: {
    primary: string;
    secondary: string;
  };

  // Marketing
  slogan: string;
  description: string;
}
```

### 3. Business Settings (company-business-settings)

```typescript
interface BusinessSettings {
  // ⚠️ Working hours ΔΕΝ ζουν εδώ (ADR-841 §7 Α21.21): το SSoT είναι το `WeeklyHours` +
  // `SpecialDay[]` ανά κατάστημα της κάρτας (`lib/calendar/weekly-hours.ts` · `special-hours.ts`).

  // Licenses & Certifications
  licenses: Array<{
    type: string;
    number: string;
    issuer: string;
    expiryDate: string;
    isActive: boolean;
  }>;

  // Service areas
  serviceAreas: string[];

  // Property specializations
  specializations: string[];

  // Commission rates
  commissionRates: {
    sales: number;
    rentals: number;
    commercial: number;
  };
}
```

### 4. Communication Settings (company-communication-templates)

```typescript
interface CommunicationSettings {
  // Email templates
  emailSignature: string;

  // Template variables
  templateVariables: Record<string, string>;

  // Auto-responders
  autoResponders: {
    [key: string]: {
      subject: string;
      content: string;
    };
  };
}
```

## 🏢 Multi-Tenant Configuration

### Tenant-Specific Settings

```typescript
// Company A - Professional blue theme
const companyASettings = await companySettingsService.loadCompanySettings(
  'company-a',
  'production'
);

// Company B - Modern green theme
const companyBSettings = await companySettingsService.loadCompanySettings(
  'company-b',
  'production'
);
```

### Environment-Specific Settings

```typescript
// Development - Test company data
const devSettings = await companySettingsService.loadCompanySettings(
  tenantId,
  'development'
);

// Production - Real company data
const prodSettings = await companySettingsService.loadCompanySettings(
  tenantId,
  'production'
);
```

## 📈 Performance Optimization

### Caching Strategy

```typescript
// Settings cached για 15 minutes
const settings = await companySettingsService.loadCompanySettings('tenant-id');

// Manual cache control
companySettingsService.invalidateCache();
companySettingsService.clearCacheForTenant('tenant-id');

// Cache status check
const isCached = companySettingsService.isCached('tenant-id', 'production');
```

### Quick Access Methods

```typescript
// Fast access για frequently used data
const quickContact = await companySettingsService.getQuickContact(); // Cached
const templateVars = await companySettingsService.getTemplateVariables(); // Cached

// Bulk operations
const allSettings = await companySettingsService.loadCompanySettings(); // Single query
```

## 🔄 Migration Guide

### From Hardcoded Values

**Before:**
```typescript
// ❌ Hardcoded values
const companyName = 'Real Estate Company';
const companyEmail = 'info@company.local';
const companyPhone = '+30 210 000 0000';
```

**After:**
```typescript
// ✅ Database-driven settings
const { companyName, email, phone } = await companySettingsService.getQuickContact();
```

### Migration Steps

1. **Run migration script:**
   ```bash
   node scripts/migrate-company-settings.js --tenant=your-company --environment=production
   ```

2. **Update component imports:**
   ```typescript
   // Old
   const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || 'Company';

   // New
   import { companySettingsService } from '@/services/company/EnterpriseCompanySettingsService';
   const { companyName } = await companySettingsService.getQuickContact();
   ```

3. **Replace hardcoded usage:**
   ```typescript
   // Old
   const emailSignature = `Best regards,\nReal Estate Company\ninfo@company.local`;

   // New
   const templateVars = await companySettingsService.getTemplateVariables();
   const emailSignature = companySettingsService.getEmailSignature();
   ```

## 📚 API Reference

### EnterpriseCompanySettingsService

#### Core Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `loadCompanySettings()` | Load all settings για tenant/environment | `tenantId?: string, environment?: string` |
| `getCompanySettings()` | Get settings by category | `category: string, tenantId?: string, environment?: string` |
| `getQuickContact()` | Get essential contact info | `tenantId?: string` |
| `getTemplateVariables()` | Get template variables για communications | `tenantId?: string` |
| `updateCompanySettings()` | Update company settings | `category: string, updates: Partial<CompanySettings>, tenantId?: string` |

#### Cache Management

| Method | Description |
|--------|-------------|
| `invalidateCache()` | Clear all settings caches |
| `clearCacheForTenant()` | Clear cache for specific tenant |
| `isCached()` | Check if settings are cached |

#### Helper Methods

| Method | Description | Return Type |
|--------|-------------|-------------|
| `getEmailSignature()` | Get formatted email signature | `string` |
| `getWorkingHours()` | Get current business hours | `WorkingHours` |
| `getServiceAreas()` | Get available service areas | `string[]` |
| `getBrandColors()` | Get brand color scheme | `BrandColors` |

### React Integration

```typescript
// Custom hook για company settings (future enhancement)
function useCompanySettings(tenantId?: string) {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await companySettingsService.loadCompanySettings(tenantId);
        setSettings(data);
      } catch (error) {
        console.error('Failed to load company settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [tenantId]);

  return { settings, loading };
}
```

## 🧪 Testing

### Unit Tests

```typescript
describe('Enterprise Company Settings Service', () => {
  beforeEach(() => {
    companySettingsService.invalidateCache();
  });

  it('should load company settings από Firebase', async () => {
    const settings = await companySettingsService.loadCompanySettings();

    expect(settings).toBeDefined();
    expect(settings.basic).toBeDefined();
    expect(settings.basic.companyName).toBeTruthy();
  });

  it('should cache settings για performance', async () => {
    const spy = jest.spyOn(companySettingsService, 'loadCompanySettings');

    await companySettingsService.loadCompanySettings('test-tenant');
    await companySettingsService.loadCompanySettings('test-tenant');

    expect(spy).toHaveBeenCalledTimes(1); // Second call uses cache
  });

  it('should generate template variables correctly', async () => {
    const variables = await companySettingsService.getTemplateVariables();

    expect(variables.companyName).toBeDefined();
    expect(variables.companyEmail).toBeDefined();
    expect(variables.companyPhone).toBeDefined();
  });
});
```

### Integration Testing

```typescript
describe('CommunicationsService Integration', () => {
  it('should use company settings for message preparation', async () => {
    const message = {
      content: 'Contact us at {{companyEmail}} or call {{companyPhone}}',
      to: 'client@example.com',
      channel: 'email'
    };

    const preparedMessage = await communicationsService.prepareMessage(message);

    expect(preparedMessage.content).not.toContain('{{companyEmail}}');
    expect(preparedMessage.content).not.toContain('{{companyPhone}}');
    expect(preparedMessage.content).toContain('@'); // Should contain actual email
  });
});
```

## 🚨 Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Settings not loading | Firebase credentials | Check Firebase configuration |
| Template variables empty | Missing configuration | Run migration script |
| Cache not updating | Stale cache | Call `invalidateCache()` |
| Tenant not found | Invalid tenant ID | Verify tenant configuration |

### Debugging

```typescript
// Enable debug mode για detailed logging
const settings = await companySettingsService.loadCompanySettings('tenant-id');
console.log('Loaded settings:', settings);

// Check current cache status
console.log('Cache status:', companySettingsService.getCacheStatus());

// Verify template variables
const variables = await companySettingsService.getTemplateVariables();
console.log('Template variables:', variables);
```

## 📝 Best Practices

### Configuration Management

1. **Environment Separation**: Use different configurations for dev/staging/production
2. **Tenant Isolation**: Ensure proper tenant filtering in multi-tenant setups
3. **Cache Strategy**: Use caching για performance, invalidate when settings change
4. **Fallback Values**: Always provide fallback values using environment variables

### Security

1. **Data Validation**: Validate all settings before saving
2. **Access Control**: Implement proper permissions για settings modification
3. **Audit Trail**: Log all settings changes για compliance
4. **Sensitive Data**: Never store sensitive information in settings (use secrets)

### Performance

1. **Batch Loading**: Load related settings in single requests
2. **Selective Loading**: Only load required categories
3. **Cache Management**: Monitor cache hit rates and TTL effectiveness
4. **Lazy Loading**: Load settings only when needed

### Development

1. **Type Safety**: Use TypeScript interfaces για all settings
2. **Documentation**: Document all setting categories and fields
3. **Migration Scripts**: Provide migration scripts για easy setup
4. **Testing**: Test all settings scenarios and fallbacks

## 🔮 Future Enhancements

- [ ] **React Hooks** - Custom hooks για easy component integration
- [ ] **Settings UI** - Admin interface για editing company settings
- [ ] **Version Control** - Track settings history and rollback capability
- [ ] **A/B Testing** - Settings variations για testing
- [ ] **Real-time Updates** - WebSocket support για live settings updates
- [ ] **Settings Validation** - Advanced validation rules and constraints
- [ ] **Import/Export** - Bulk settings import/export functionality

---

## 📞 Support

For questions or issues με the Enterprise Company Settings System:

1. **Documentation**: Check this README and service code comments
2. **Migration**: Use provided migration scripts and guides
3. **Testing**: Run unit tests και integration tests
4. **Performance**: Monitor cache usage και response times

---

*Part of the Enterprise Configuration Management System*