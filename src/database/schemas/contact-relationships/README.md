# Enterprise Contact Relationships Schema

🏢 **Modular Enterprise Database Schema** for Contact Relationship Management System

## 📁 Structure Overview

This directory contains a **modularly architected** database schema split into focused, maintainable files following Enterprise best practices.

```
contact-relationships/
├── 01-tables.sql          # 📋 Core table definitions
├── 02-indexes.sql         # 🚀 Performance optimization indexes
├── 03-triggers.sql        # 🔄 Automated triggers & functions
├── 04-views.sql          # 📊 Business intelligence views
├── 05-procedures.sql     # 🔧 Stored procedures & functions
├── 06-seed-data.sql      # 🌱 Sample/test data
├── 07-maintenance.sql    # 🛠️ Database maintenance procedures
├── schema-info.sql       # 📋 Version tracking & metadata
└── README.md            # 📖 This documentation
```

## 🎯 Deployment Order

**IMPORTANT**: Execute files in numerical order for proper dependencies:

1. **01-tables.sql** - Core table structure
2. **02-indexes.sql** - Performance indexes
3. **03-triggers.sql** - Automated functions
4. **04-views.sql** - Business intelligence views
5. **05-procedures.sql** - Stored procedures
6. **06-seed-data.sql** - *(Optional)* Sample data for development
7. **07-maintenance.sql** - Maintenance procedures
8. **schema-info.sql** - Version tracking & validation

## 📋 File Descriptions

### 01-tables.sql
- **Primary tables**: `contact_relationships`, `relationship_change_history`
- **Document management**: `relationship_documents`
- **Performance cache**: `organization_hierarchy_cache`
- **Full constraints & data validation**
- **Enterprise-grade field structure**

### 02-indexes.sql
- **25+ performance indexes** for optimal query speed
- **Composite indexes** for complex relationship queries
- **Partial indexes** for active relationships only
- **Full-text search indexes** for content search
- **Audit & compliance indexes**

### 03-triggers.sql
- **Automatic timestamp updates** (`updated_at`)
- **Complete audit trail logging** (all changes tracked)
- **Hierarchy cache invalidation** (performance optimization)
- **Data validation & integrity enforcement**
- **Business rule automation**

### 04-views.sql
- **v_active_relationships** - Complete active relationships with contact details
- **v_employment_relationships** - Employment data with hierarchy
- **v_organization_hierarchy** - Organizational structure & management chains
- **v_shareholder_relationships** - Ownership & investment data
- **v_relationship_summary** - Dashboard & reporting metrics
- **v_contact_network** - Network analysis & relationship mapping

### 05-procedures.sql
- **get_organization_employees()** - Complete employee listings
- **get_person_employment_history()** - Career tracking
- **get_organization_hierarchy_tree()** - Recursive hierarchy analysis
- **search_relationships()** - Advanced search with relevance scoring
- **bulk_update_relationships()** - Mass operations support

### 06-seed-data.sql
- **Sample employment relationships** for testing
- **Example shareholder data**
- **Government/service relationships**
- **Audit trail examples**
- **Performance test datasets** *(commented)*

### 07-maintenance.sql
- **refresh_hierarchy_cache()** - Performance cache management
- **cleanup_old_audit_records()** - Compliance data retention
- **archive_old_terminated_relationships()** - Data lifecycle
- **comprehensive_maintenance()** - Complete system optimization
- **Daily/Weekly/Monthly** automated procedures

### schema-info.sql
- **Migration tracking** with full audit trail
- **Schema versioning** & environment management
- **Deployment validation** functions
- **Data integrity monitoring**
- **Documentation generation**

## 🏗️ Enterprise Features

### ✅ **Data Integrity**
- Comprehensive constraints & validation
- Referential integrity enforcement
- Business rule automation
- Audit trail for all changes

### ⚡ **Performance**
- Optimized indexing strategy
- Materialized hierarchy cache
- Query performance tuning
- Bulk operation support

### 🔒 **Security & Compliance**
- Data retention policies
- Audit trail retention
- GDPR compliance ready
- Sensitivity level tracking

### 🔄 **Maintainability**
- Modular architecture
- Automated maintenance procedures
- Version tracking
- Rollback capability

## 🚀 Quick Start

### Development Environment
```sql
-- Execute all files in order
\i 01-tables.sql
\i 02-indexes.sql
\i 03-triggers.sql
\i 04-views.sql
\i 05-procedures.sql
\i 06-seed-data.sql      -- Optional: test data
\i 07-maintenance.sql
\i schema-info.sql

-- Validate deployment
SELECT * FROM validate_deployment();
```

### Production Environment
```sql
-- Skip seed data in production
\i 01-tables.sql
\i 02-indexes.sql
\i 03-triggers.sql
\i 04-views.sql
\i 05-procedures.sql
\i 07-maintenance.sql
\i schema-info.sql

-- Set production environment
SELECT set_migration_environment('production');

-- Validate deployment
SELECT * FROM validate_deployment();
```

## 📊 Schema Statistics

- **4 Core Tables** with enterprise-grade structure
- **25+ Indexes** for optimal performance
- **6+ Triggers** for automation
- **6 Views** for business intelligence
- **8+ Stored Procedures** for complex operations
- **Complete Audit Trail** with change tracking
- **Hierarchical Cache** for organization performance

## 🛠️ Maintenance

### Daily
```sql
SELECT daily_relationship_maintenance();
```

### Weekly
```sql
SELECT weekly_relationship_maintenance();
```

### Monthly
```sql
SELECT monthly_relationship_maintenance();
```

### Comprehensive
```sql
SELECT * FROM run_comprehensive_maintenance();
```

## 📈 Monitoring

### Schema Health
```sql
SELECT * FROM validate_schema_integrity();
```

### Data Integrity
```sql
SELECT * FROM check_relationship_data_integrity();
```

### Statistics
```sql
SELECT * FROM get_schema_statistics();
```

## 🆙 Migration Support

### Check Version
```sql
SELECT * FROM get_schema_version();
```

### Apply Migration
```sql
SELECT record_migration(
    '003_new_feature',
    'Description of changes',
    'schema',
    'developer_name'
);
```

## ⚠️ Important Notes

1. **Execute in Order**: Files must be run in numerical sequence
2. **Test Environment**: Use seed data only in development/testing
3. **Backup First**: Always backup before applying to production
4. **Validate After**: Run validation functions after deployment
5. **Monitor Performance**: Regular maintenance required for optimal performance

## 📞 Support

For questions about this schema implementation, refer to:
- **Enterprise Documentation**: `src/subapps/dxf-viewer/docs/centralized_systems.md`
- **Contact Relationships Service**: `src/services/contact-relationships.service.ts`
- **Schema Validation**: Use built-in validation functions

---

**🏢 Enterprise Architecture** | **📊 Performance Optimized** | **🔒 Security Ready** | **⚡ Production Grade**