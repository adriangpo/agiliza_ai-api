-- database/setup/create_roles.sql
-- INFRA-04: Two DB roles.
-- Run as superuser (postgres) ONCE during initial environment setup.
-- migrator: owns tables, runs DDL, sets up RLS policies.
--           Subject to FORCE ROW LEVEL SECURITY on tenant tables.
-- app: DML only (SELECT, INSERT, UPDATE, DELETE). RLS-restricted.
--      Used by the running application. Never owns tables. Never runs DDL.

-- Create roles (idempotent — skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'migrator') THEN
    CREATE ROLE migrator LOGIN PASSWORD 'migrator_password' NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app') THEN
    CREATE ROLE app LOGIN PASSWORD 'app_password' NOINHERIT;
  END IF;
END $$;

-- Grant migrator schema creation rights on the database
GRANT CREATE ON DATABASE agiliza_ai TO migrator;
GRANT CREATE ON DATABASE agiliza_ai_test TO migrator;

-- Grant app role connect access only (DML grants happen inside each migration,
-- after the table is created, scoped to the specific table)
GRANT CONNECT ON DATABASE agiliza_ai TO app;
GRANT CONNECT ON DATABASE agiliza_ai_test TO app;

-- Note: After each migration creates a table, the migration itself grants:
-- GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app;
-- This keeps grants minimal and explicit per table (D-07: app is DML only).
