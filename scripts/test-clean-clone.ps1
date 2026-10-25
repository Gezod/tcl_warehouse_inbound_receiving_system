# Clean Clone Validation Script for Warehouse Receiving System (PowerShell)
# Verifies that a clean environment can install, migrate, seed, test, verify consistency, and build.

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Warehouse Receiving System: Clean Clone Validation Test" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Step 1: Ensure .env exists
if (-not (Test-Path ".env")) {
    Write-Host "[1/7] .env not found. Copying .env.example to .env..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
} else {
    Write-Host "[1/7] .env already exists." -ForegroundColor Green
}

# Step 2: Install dependencies
Write-Host "[2/7] Checking Node dependencies..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    npm ci
} else {
    Write-Host "Dependencies already installed." -ForegroundColor Green
}

# Step 3: Run Database Migrations
Write-Host "[3/7] Running database migrations..." -ForegroundColor Yellow
npm run db:migrate
if ($LASTEXITCODE -ne 0) { throw "Migrations failed!" }
Write-Host "Migrations completed." -ForegroundColor Green

# Step 4: Seed Initial Accounts
Write-Host "[4/7] Seeding initial operator and supervisor accounts..." -ForegroundColor Yellow
npm run db:seed
if ($LASTEXITCODE -ne 0) { throw "Seed failed!" }
Write-Host "Seed completed." -ForegroundColor Green

# Step 5: Run Automated Test Suites (Unit, Integration, Concurrency)
Write-Host "[5/7] Running Vitest test suites..." -ForegroundColor Yellow
npm test
if ($LASTEXITCODE -ne 0) { throw "Vitest test suite failed!" }
Write-Host "All tests passed." -ForegroundColor Green

# Step 6: Verify Data Invariant Consistency (NFR-01)
Write-Host "[6/7] Running data consistency invariant verifier..." -ForegroundColor Yellow
npm run verify
if ($LASTEXITCODE -ne 0) { throw "Consistency verifier failed!" }
Write-Host "Consistency verified." -ForegroundColor Green

# Step 7: Lint and Production Build Validation
Write-Host "[7/7] Validating linter and production Next.js build..." -ForegroundColor Yellow
npm run lint
if ($LASTEXITCODE -ne 0) { throw "Lint failed!" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed!" }
Write-Host "Build completed successfully." -ForegroundColor Green

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "[OK] CLEAN CLONE VALIDATION COMPLETED SUCCESSFULLY" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
