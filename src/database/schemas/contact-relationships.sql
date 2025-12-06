-- ============================================================================
-- ENTERPRISE CONTACT RELATIONSHIPS - SCHEMA POINTER
-- ============================================================================
--
-- ⚠️ IMPORTANT: This monolithic file has been REPLACED with modular structure
--
-- 🏢 NEW ENTERPRISE MODULAR STRUCTURE:
-- Please use: src/database/schemas/contact-relationships/ directory
--
-- ============================================================================

-- ⚠️ DEPRECATION NOTICE
-- This single-file schema has been refactored into Enterprise modular structure
-- for better maintainability, deployment flexibility, and team collaboration.

-- 🚨 DO NOT USE THIS FILE FOR DEPLOYMENT
-- Use the modular structure instead:

-- 📁 NEW LOCATION:
-- src/database/schemas/contact-relationships/

-- 📋 MODULAR COMPONENTS:
-- ├── 01-tables.sql          # Core table definitions
-- ├── 02-indexes.sql         # Performance optimization indexes
-- ├── 03-triggers.sql        # Automated triggers & functions
-- ├── 04-views.sql          # Business intelligence views
-- ├── 05-procedures.sql     # Stored procedures & functions
-- ├── 06-seed-data.sql      # Sample/test data (optional)
-- ├── 07-maintenance.sql    # Database maintenance procedures
-- ├── schema-info.sql       # Version tracking & metadata
-- ├── deploy.sql           # Master deployment script
-- └── README.md            # Complete documentation

-- ============================================================================
-- MIGRATION INSTRUCTIONS
-- ============================================================================

-- 🚀 FOR QUICK DEPLOYMENT:
-- Execute in the contact-relationships/ directory:
-- \i deploy.sql

-- 🔧 FOR MANUAL DEPLOYMENT:
-- Execute files in numerical order:
-- \i 01-tables.sql
-- \i 02-indexes.sql
-- \i 03-triggers.sql
-- \i 04-views.sql
-- \i 05-procedures.sql
-- \i 06-seed-data.sql      -- Optional: development only
-- \i 07-maintenance.sql
-- \i schema-info.sql

-- 🏗️ FOR PRODUCTION:
-- Set environment variables and use deploy.sql with production settings

-- ============================================================================
-- BENEFITS OF MODULAR STRUCTURE
-- ============================================================================

-- ✅ SEPARATION OF CONCERNS: Each file has a single responsibility
-- ✅ EASIER MAINTENANCE: Find and modify specific components quickly
-- ✅ TEAM COLLABORATION: Multiple developers can work on different modules
-- ✅ FLEXIBLE DEPLOYMENT: Install only what you need
-- ✅ BETTER TESTING: Test individual components
-- ✅ VERSION CONTROL: Cleaner git history and merges
-- ✅ ENTERPRISE READY: Production-grade deployment and validation

-- ============================================================================
-- ERROR PREVENTION
-- ============================================================================

-- Prevent accidental execution of this deprecated file
DO $$
BEGIN
    RAISE EXCEPTION '
🚨 DEPRECATED FILE - DO NOT USE 🚨

This monolithic schema file has been replaced with Enterprise modular structure.

📁 NEW LOCATION: src/database/schemas/contact-relationships/

🚀 QUICK START:
   cd src/database/schemas/contact-relationships/
   \i deploy.sql

📖 DOCUMENTATION: README.md in the new directory

🏢 This change follows Enterprise architecture best practices.
';
END $$;

-- End of Deprecated File