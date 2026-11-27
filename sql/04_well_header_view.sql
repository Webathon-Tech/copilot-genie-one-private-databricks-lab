-- =====================================================================================================
-- 04_well_header_view.sql
-- Purpose : Give completions users the shared well attributes they need (play, rig) WITHOUT access to drilling data.
-- Why     : Genie DISABLES an agent for any user who cannot read ALL of its tables (banner: "You don't have SELECT
--           access on ...", and the user cannot ask anything). So the Completions agent must not include drilling.wells,
--           which completions users cannot read. A curated view inside the completions schema gives them play and rig only.
-- How it works:
--           A Unity Catalog view runs with its OWNER's access to the underlying tables. Readers only need SELECT on the view
--           (already covered by the schema-level SELECT that grp-genie-completions has on `completions`).
--           The view exposes only well_id, play, rig - drilling performance columns (depth, drilling_days) stay hidden.
-- Then    : In the Completions agent: Configure > Resources -> add completions.well_header (not drilling.wells);
--           and use the instruction "Join completions to completions.well_header on well_id when play or rig is needed."
-- Run in  : Databricks SQL editor (jumpbox) as the admin who owns drilling.wells.
-- =====================================================================================================

USE CATALOG dbw_genie_demo;

CREATE OR REPLACE VIEW completions.well_header
COMMENT 'Reference attributes per well (well_id, play, rig) for completions analysis. Sourced from drilling.wells; excludes drilling performance columns.'
AS SELECT well_id, play, rig FROM drilling.wells;

-- Optional check (as admin): 200 rows, three columns only.
SELECT count(*) AS row_count FROM completions.well_header;
