#!/usr/bin/env bash
# Clean Clone Validation Script for Warehouse Receiving System (POSIX/Bash)
# Verifies that a clean environment can install, migrate, seed, test, verify consistency, and build.

set -euo pipefail

echo "=========================================================="
echo "Warehouse Receiving System: Clean Clone Validation Test"
echo "=========================================================="

# Step 1: Ensure .env exists
if [ ! -f ".env" ]; then
    echo "[1/7] .env not found. Copying .env.example to .env..."
    cp .env.example .env
else
    echo "[1/7] .env already exists."
fi

# Step 2: Install dependencies
echo "[2/7] Checking Node dependencies..."
if [ ! -d "node_modules" ]; then
    npm ci
else
    echo "Dependencies already installed."
fi

# Step 3: Run Database Migrations
echo "[3/7] Running database migrations..."
npm run db:migrate

# Step 4: Seed Initial Accounts
echo "[4/7] Seeding initial operator and supervisor accounts..."
npm run db:seed

# Step 5: Run Automated Test Suites (Unit, Integration, Concurrency)
echo "[5/7] Running Vitest test suites..."
npm test

# Step 6: Verify Data Invariant Consistency (NFR-01)
echo "[6/7] Running data consistency invariant verifier..."
npm run verify

# Step 7: Lint and Production Build Validation
echo "[7/7] Validating linter and production Next.js build..."
npm run lint
npm run build

echo "=========================================================="
echo "✓ CLEAN CLONE VALIDATION COMPLETED SUCCESSFULLY"
echo "=========================================================="
