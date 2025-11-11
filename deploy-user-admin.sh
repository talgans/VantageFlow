#!/bin/bash

echo "🚀 VantageFlow User Administration Setup"
echo "========================================"
echo ""

# Check if we're in the right directory
if [ ! -f "firebase.json" ]; then
    echo "❌ Error: Must run from project root directory"
    exit 1
fi

echo "📦 Step 1: Installing Cloud Functions dependencies..."
cd functions
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"
echo ""

echo "🔨 Step 2: Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Failed to build TypeScript"
    exit 1
fi

echo "✅ Build successful"
echo ""

echo "🚀 Step 3: Deploying Cloud Functions to Firebase..."
cd ..
firebase deploy --only functions

if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy functions"
    exit 1
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Sign in to your app as an admin user"
echo "2. Click the 'Admin' button in the header"
echo "3. Start managing users!"
echo ""
echo "💡 Tip: If you see 'functions/not-found' error, wait a minute for deployment to propagate"
