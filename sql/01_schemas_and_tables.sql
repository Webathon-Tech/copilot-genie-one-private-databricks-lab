-- =====================================================================================================
-- 01_schemas_and_tables.sql
-- Purpose : Create three domain schemas and fill them with SYNTHETIC oil & gas data for the Genie lab.
--           drilling.wells (200 rows) -> completions.completions (200 rows) -> production.monthly_volumes (2,400 rows)
-- Run in  : Databricks SQL editor (from the jumpbox), on the Serverless Starter Warehouse. Use "Run all".
-- Needs   : - Workspace catalog dbw_genie_demo exists (check with SHOW CATALOGS;)
--           - You are a workspace admin / catalog owner (CREATE SCHEMA, CREATE TABLE)
-- Notes   : - Synthetic sample data only. rand(n) uses a fixed seed per column so values look varied but are reproducible.
--           - Each table is derived from the previous one, so well_id joins line up across domains.
--           - Safe to re-run: CREATE OR REPLACE recreates the tables.
-- =====================================================================================================

USE CATALOG dbw_genie_demo;

-- One schema per data domain. Schemas are the permission boundary used later in 02_grants.sql.
CREATE SCHEMA IF NOT EXISTS drilling    COMMENT 'Drilling operations (synthetic sample data)';
CREATE SCHEMA IF NOT EXISTS completions COMMENT 'Well completions (synthetic sample data)';
CREATE SCHEMA IF NOT EXISTS production  COMMENT 'Monthly production volumes (synthetic sample data)';

-- Drilling domain: one row per well.
-- range(1, 201) generates ids 1..200; play and rig are assigned round-robin so every value has ~equal counts.
CREATE OR REPLACE TABLE drilling.wells COMMENT 'One row per well drilled' AS
SELECT concat('W-', lpad(cast(id AS STRING), 4, '0'))                                   AS well_id,
       element_at(array('Montney','Duvernay','Permian','Anadarko'), cast(id % 4 + 1 AS INT)) AS play,
       element_at(array('Rig 12','Rig 21','Rig 34'), cast(id % 3 + 1 AS INT))          AS rig,
       date_add(DATE'2024-01-01', cast(id * 3 AS INT))                                AS spud_date,
       round(2500 + rand(1) * 2500, 0)                                                AS total_depth_m,
       round(8 + rand(2) * 20, 1)                                                     AS drilling_days
FROM range(1, 201);

-- Completions domain: one completion job per well, completed 10-40 days after drilling finished.
CREATE OR REPLACE TABLE completions.completions COMMENT 'One completion job per well' AS
SELECT well_id,
       date_add(spud_date, cast(drilling_days + 10 + rand(3) * 30 AS INT)) AS completion_date,
       cast(20 + rand(4) * 40 AS INT)                                     AS stage_count,
       round(1500 + rand(5) * 3500, 0)                                    AS proppant_tonnes,
       round(10000 + rand(6) * 30000, 0)                                  AS fluid_m3,
       round(3 + rand(7) * 12, 1)                                         AS completion_days
FROM drilling.wells;

-- Production domain: 12 months per well starting at the completion month (month 0),
-- with an exponential decline so "decline" questions have realistic answers.
CREATE OR REPLACE TABLE production.monthly_volumes COMMENT 'Monthly oil and gas volumes per well' AS
SELECT c.well_id,
       add_months(trunc(c.completion_date, 'MM'), m.id)       AS month,
       round((800 + rand(8) * 1200) * exp(-0.08 * m.id), 0)   AS oil_bbl,
       round((2000 + rand(9) * 4000) * exp(-0.06 * m.id), 0)  AS gas_mcf
FROM completions.completions c
CROSS JOIN range(0, 12) AS m;

-- Check: expected 200 / 200 / 2400.
SELECT 'wells' AS table_name, count(*) AS row_count FROM drilling.wells
UNION ALL SELECT 'completions', count(*) FROM completions.completions
UNION ALL SELECT 'monthly_volumes', count(*) FROM production.monthly_volumes;
