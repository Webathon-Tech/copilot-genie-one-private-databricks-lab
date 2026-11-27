-- =====================================================================================================
-- 02_grants.sql
-- Purpose : Give each domain group read access to ITS OWN schema only; managers read everything.
--           This is what makes Genie answers differ per user: every Genie query runs as the signed-in user.
-- Run in  : Databricks SQL editor (jumpbox), after 01_schemas_and_tables.sql.
-- Needs   : - Entra groups grp-genie-drilling, grp-genie-completions, grp-genie-managers already ADDED to the workspace
--             (Settings > Identity and access > Groups > Add group). Add them first; otherwise GRANT reports
--             "principal does not exist" and the groups don't appear in permission dialogs.
--           - You own the catalog/schemas (or have MANAGE).
-- Notes   : - Databricks GRANT takes ONE principal per statement, hence the repetition.
--           - USE CATALOG + USE SCHEMA are "pass-through" privileges; SELECT on the schema covers every table AND view in it,
--             including views created later (e.g. completions.well_header in 04_well_header_view.sql).
-- =====================================================================================================

USE CATALOG dbw_genie_demo;

-- Let all three groups enter the catalog (seeing the catalog does not let anyone read a table).
GRANT USE CATALOG ON CATALOG dbw_genie_demo TO `grp-genie-drilling`;
GRANT USE CATALOG ON CATALOG dbw_genie_demo TO `grp-genie-completions`;
GRANT USE CATALOG ON CATALOG dbw_genie_demo TO `grp-genie-managers`;

-- Drilling users: drilling only
GRANT USE SCHEMA, SELECT ON SCHEMA drilling    TO `grp-genie-drilling`;

-- Completions users: completions only
GRANT USE SCHEMA, SELECT ON SCHEMA completions TO `grp-genie-completions`;

-- Managers: everything
GRANT USE SCHEMA, SELECT ON SCHEMA drilling    TO `grp-genie-managers`;
GRANT USE SCHEMA, SELECT ON SCHEMA completions TO `grp-genie-managers`;
GRANT USE SCHEMA, SELECT ON SCHEMA production  TO `grp-genie-managers`;

-- Check: every grant on the catalog and the three schemas.
-- Expected: catalog -> the three groups (+ the auto-created workspace users group) with USE_CATALOG only;
--           drilling -> drilling + managers; completions -> completions + managers; production -> managers only.
SELECT 'catalog' AS level, catalog_name AS object, grantee, privilege_type
FROM information_schema.catalog_privileges
UNION ALL
SELECT 'schema', schema_name, grantee, privilege_type
FROM information_schema.schema_privileges
WHERE schema_name IN ('drilling', 'completions', 'production')
ORDER BY level, object, grantee, privilege_type;

-- Critical check: nobody else must have SELECT / ALL_PRIVILEGES at catalog level,
-- otherwise every user could read every table and the permission tests would pass for the wrong reason.
SELECT grantee, privilege_type
FROM information_schema.catalog_privileges
ORDER BY grantee, privilege_type;
