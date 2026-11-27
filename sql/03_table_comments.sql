-- =====================================================================================================
-- 03_table_comments.sql
-- Purpose : Replace the long, essay-style AI-generated TABLE descriptions with short, factual ones.
-- Why     : Genie reads table and column descriptions to understand the data. The AI generator wrote multi-section essays
--           ("Visualization", "Interpretation", "Conclusion") mentioning things NOT in the data (weather, market demand).
--           That text can mislead Genie. Good descriptions state the grain, units and join keys - nothing else.
-- Run in  : Databricks SQL editor (jumpbox), after generating COLUMN comments with "AI generate" in Catalog Explorer
--           (column comments were accurate and were kept; only table comments are overwritten here).
-- Needs   : Table owner or MODIFY on the tables.
-- =====================================================================================================

USE CATALOG dbw_genie_demo;

COMMENT ON TABLE drilling.wells IS
  'One row per well drilled (synthetic). Grain: well_id. Includes play (basin), rig, spud date, total depth in metres and drilling days.';

COMMENT ON TABLE completions.completions IS
  'One completion job per well (synthetic). Grain: well_id. Includes completion date, stage count, proppant in tonnes, fluid in cubic metres and completion duration in days. Join to completions.well_header on well_id for play and rig.';

COMMENT ON TABLE production.monthly_volumes IS
  'Monthly production per well for the first 12 months after completion (synthetic). Grain: well_id + month. oil_bbl is barrels of oil, gas_mcf is thousand cubic feet of gas.';
