-- Initialize database for Training Track
-- This script runs when PostgreSQL container starts for the first time

-- Force PostgreSQL to use md5 hashing for passwords (instead of scram-sha-256)
ALTER SYSTEM SET password_encryption = 'md5';

-- Create user only if it doesn't exist (avoid dropping current user)
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'training_user') THEN
        CREATE ROLE training_user LOGIN PASSWORD 'training_password';
    END IF;
END $$;

-- Create database owned by that user (only if it doesn't exist)
SELECT 'CREATE DATABASE training_track OWNER training_user'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'training_track')\gexec

-- Connect to the training_track database
\c training_track;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE training_track TO training_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO training_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO training_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO training_user; 