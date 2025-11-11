<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# VantageFlow - KPI Dashboard with AI Analytics

A comprehensive project management dashboard with real-time collaboration, AI-powered insights, and role-based access control.

**View in AI Studio:** https://ai.studio/apps/drive/1h2lLvvvX3zwTfAahmrN0dIEyprH4kUg7

## ✨ Features

- 📊 **Real-time Project Tracking** - Live updates across all users
- 🔐 **Role-Based Access Control** - Admin, Manager, and Member roles
- 🤖 **AI-Powered Insights** - Project health analysis via Google Gemini
- 📈 **Interactive Charts** - Status pie charts and analytics
- 📅 **Gantt Timeline View** - Visual project scheduling
- 🔄 **Real-time Sync** - Powered by Firestore
- 🎨 **Modern UI** - Beautiful dark theme with Tailwind CSS

## 🚀 Quick Start

See **[QUICKSTART.md](./QUICKSTART.md)** for a 5-minute setup guide!

**Basic steps:**
```bash
# Install dependencies
npm install

# Configure environment
cp .env.local.template .env.local
# Edit .env.local with your Firebase and Gemini credentials

# Seed database (optional)
cd firestore-admin && npm install && npm run seed && cd ..

# Run the app
npm run dev
```

## 📚 Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Get started in 5 minutes
- **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)** - Complete Firebase integration guide
- **[firestore-admin/README.md](./firestore-admin/README.md)** - Admin scripts & user management
- **[.github/copilot-instructions.md](./.github/copilot-instructions.md)** - AI coding agent guide

## 🏗 Architecture

- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS (CDN)
- **Database:** Firebase Firestore
- **Authentication:** Firebase Auth with custom claims
- **AI:** Google Gemini 2.5 Flash
- **Charts:** Recharts
- **Deployment:** Google AI Studio CDN / Firebase Hosting

## 🔑 User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access - create, edit, delete projects |
| **Manager** | Create and edit projects |
| **Member** | View-only access |

Set roles via admin script:
```bash
cd firestore-admin
npm run set-role user@example.com admin
```

## 🛠 Development

**Prerequisites:**
- Node.js 18+
- Firebase account
- Google AI Studio API key

**Run locally:**
```bash
npm install
npm run dev
```