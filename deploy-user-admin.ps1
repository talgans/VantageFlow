Write-Host "🚀 VantageFlow User Administration Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "firebase.json")) {
    Write-Host "❌ Error: Must run from project root directory" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Step 1: Installing Cloud Functions dependencies..." -ForegroundColor Yellow
Set-Location functions
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Dependencies installed" -ForegroundColor Green
Write-Host ""

Write-Host "🔨 Step 2: Building TypeScript..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to build TypeScript" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build successful" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 Step 3: Deploying Cloud Functions to Firebase..." -ForegroundColor Yellow
Set-Location ..
firebase deploy --only functions

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to deploy functions" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Sign in to your app as an admin user"
Write-Host "2. Click the 'Admin' button in the header"
Write-Host "3. Start managing users!"
Write-Host ""
Write-Host "💡 Tip: If you see 'functions/not-found' error, wait a minute for deployment to propagate" -ForegroundColor Yellow
