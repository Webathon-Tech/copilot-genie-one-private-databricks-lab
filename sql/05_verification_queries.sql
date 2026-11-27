-- =====================================================================================================
-- 05_verification_queries.sql
-- Purpose : Queries used during the lab to confirm the catalog, grants and Genie One access.
-- Run in  : Databricks SQL editor (jumpbox). Run statements one at a time and read each result.
-- =====================================================================================================

-- 1) Which catalogs exist? The workspace catalog (named after the workspace, hyphens -> underscores) is used for the lab.
--    Result in the lab: dbw_genie_demo, samples, system.
SHOW CATALOGS;

-- 2) Row counts (expected 200 / 200 / 2400).
SELECT 'wells' AS table_name, count(*) AS row_count FROM dbw_genie_demo.drilling.wells
UNION ALL SELECT 'completions', count(*) FROM dbw_genie_demo.completions.completions
UNION ALL SELECT 'monthly_volumes', count(*) FROM dbw_genie_demo.production.monthly_volumes;

-- 3) Catalog-level grants. Lab result: _workspace_users_dbw_genie_demo_<id> and the three groups, all USE_CATALOG only.
SELECT grantee, privilege_type
FROM dbw_genie_demo.information_schema.catalog_privileges
ORDER BY grantee, privilege_type;

-- 4) Schema-level grants for the three domain schemas.
SELECT schema_name, grantee, privilege_type
FROM dbw_genie_demo.information_schema.schema_privileges
WHERE schema_name IN ('drilling', 'completions', 'production')
ORDER BY schema_name, grantee, privilege_type;

-- 5) Access needed to call Genie One MCP (system.ai.genie_one_mcp).
--    Lab result: account users already had USE CATALOG on `system`, and USE SCHEMA, EXECUTE, SELECT, READ VOLUME on `system.ai`
--    (EXECUTE is inherited by system.ai.genie_one_mcp), so NO grants were required.
SHOW GRANTS ON CATALOG system;
SHOW GRANTS ON SCHEMA system.ai;
