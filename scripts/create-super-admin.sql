-- Super Admin Setup Script
-- This script creates or updates a super admin user

-- First, let's check if the user exists
-- If you're using this in a SQL client, run these commands one by one

-- Option 1: Update existing user to super admin
-- Replace 'your-email@example.com' with your actual email
UPDATE users 
SET 
  role = 'SUPER_ADMIN',
  "tenantId" = NULL
WHERE email = 'your-email@example.com';

-- Option 2: Create new super admin user
-- Note: You'll need to hash the password first using bcrypt
-- The password below is 'Admin@123456' hashed with bcrypt (10 rounds)
-- Hash: $2a$10$YourHashedPasswordHere

INSERT INTO users (id, email, password, name, role, "tenantId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'admin@saaah.com',
  '$2a$10$rOZJQGXGJ5vYxGxGxGxGxOZJQGXGJ5vYxGxGxGxGxGxGxGxGxGxGx', -- Replace with actual hash
  'Super Administrator',
  'SUPER_ADMIN',
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE
SET 
  role = 'SUPER_ADMIN',
  "tenantId" = NULL,
  "updatedAt" = NOW();

-- Verify the super admin was created/updated
SELECT id, email, name, role, "tenantId", "createdAt"
FROM users
WHERE role = 'SUPER_ADMIN';
