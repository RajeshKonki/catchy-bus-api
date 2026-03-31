#!/bin/bash

# Deployment script for Catchy Bus API Server
# Steps to host your API server on AWS EC2

# === ENV CONFIG ===
# You need to have Node.js and PM2 already installed on your EC2 instance.
# (See the manual instructions I provided earlier)

echo "🚀 Starting Deployment Process..."

# 1. Update project and dependencies
npm install

# 2. Setup Database Environment
# Prisma needs the DATABASE_URL to generate the client properly
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found. Create it with your RDS details first."
    exit 1
fi

# 3. Generate Prisma Client
echo "💎 Generating Prisma Client..."
npx prisma generate

# 4. Build TypeScript to JavaScript
echo "🏗️ Building the project..."
npm run build

# 5. Start / Restart the server with PM2
echo "📡 Starting server with PM2..."
pm2 delete catchy-api || true
pm2 start dist/index.js --name "catchy-api"

# 6. Save PM2 state
pm2 save

echo "✅ Deployment Successful! Your API is running."
echo "🔗 View logs with: pm2 logs catchy-api"
