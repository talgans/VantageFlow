# VantageFlow - Quick Start Guide

Get VantageFlow up and running with Firebase in 5 minutes!

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
cd firestore-admin && npm install && cd ..
```

### 2. Configure Environment
Copy the template and add your API keys:
```bash
cp .env.local.template .env.local
```

Edit `.env.local` with your credentials:
- **Firebase**: Get from [Firebase Console](https://console.firebase.google.com/) → Project Settings
- **Gemini AI**: Get from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 3. Setup Firebase Admin (One-time)
Download service account key:
1. Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Save as `firestore-admin/serviceAccountKey.json`

### 4. Deploy Security Rules
```bash
firebase deploy --only firestore:rules
```
Or copy `firestore.rules` content to Firebase Console → Firestore → Rules

### 5. Seed Initial Data
```bash
cd firestore-admin
npm run seed
cd ..
```

### 6. Run the App
```bash
npm run dev
```
Visit `http://localhost:3000` 🎉

---

## 👤 User Setup

### Create Your First Admin
1. Click "Sign In" and create an account
2. Run in terminal:
   ```bash
   cd firestore-admin
   npm run set-role your-email@example.com admin
   cd ..
   ```
3. Sign out and back in to see admin permissions

### View All Users
```bash
cd firestore-admin
npm run list-users
```

---

## 🎯 What You Get

✅ **Authentication**
- Email/password sign in/up
- Role-based access control (Admin, Manager, Member)
- Automatic token refresh

✅ **Real-time Database**
- Live project synchronization
- Instant updates across all users
- Secure Firestore rules

✅ **KPI Dashboard**
- Project management with phases and tasks
- Gantt chart timeline view
- AI-powered insights via Gemini
- Interactive charts and analytics

---

## 🔑 User Roles & Permissions

| Feature | Member | Manager | Admin |
|---------|--------|---------|-------|
| View Projects | ✅ | ✅ | ✅ |
| Create Projects | ❌ | ✅ | ✅ |
| Edit Projects | ❌ | ✅ | ✅ |
| Delete Projects | ❌ | ❌ | ✅ |
| AI Insights | ✅ | ✅ | ✅ |

---

## 📚 Documentation

- **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)** - Complete Firebase integration guide
- **[firestore-admin/README.md](./firestore-admin/README.md)** - Admin scripts documentation
- **[.github/copilot-instructions.md](./.github/copilot-instructions.md)** - AI coding agent guide

---

## 🛠 Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build

# Admin Scripts
cd firestore-admin
npm run seed             # Seed database
npm run set-role <email> <role>  # Set user role
npm run list-users       # List all users
cd ..

# Firebase
firebase deploy --only firestore:rules  # Deploy security rules
firebase deploy --only hosting          # Deploy to Firebase Hosting
```

---

## 🐛 Troubleshooting

### App won't start
- Check `.env.local` has all required variables
- Run `npm install` to ensure dependencies are installed

### "Permission denied" in Firestore
- Deploy security rules: `firebase deploy --only firestore:rules`
- Verify user has correct role via `npm run list-users`

### Role not showing
- Sign out and sign in again
- Or wait 10 minutes for auto token refresh

### Changes not syncing
- Check browser console for errors
- Verify Firestore rules are deployed
- Ensure user is authenticated

---

## 🚢 Production Deployment

### Option 1: Firebase Hosting (Recommended)
```bash
npm run build
firebase deploy
```

### Option 2: Google AI Studio CDN
The app is designed for AI Studio's CDN deployment:
1. Build: `npm run build`
2. Upload to AI Studio
3. Dependencies load from `https://aistudiocdn.com/`

### Option 3: Other Hosting
```bash
npm run build
# Deploy dist/ folder to your hosting provider
```

---

## 💡 Tips

- **Test with multiple users**: Open app in incognito mode to test different roles
- **Monitor Firestore usage**: Check Firebase Console → Firestore → Usage tab
- **Customize security rules**: Edit `firestore.rules` for your needs
- **Add more projects**: Use the "New Project" button in the dashboard

---

## 🆘 Need Help?

1. Check documentation in `FIREBASE_SETUP.md`
2. Review Firestore admin scripts: `firestore-admin/README.md`
3. Examine security rules: `firestore.rules`
4. Check GitHub issues: [VantageFlow Issues](https://github.com/talgans/VantageFlow/issues)

---

## ✨ Next Steps

- [ ] Customize the dashboard for your use case
- [ ] Add more project templates
- [ ] Set up Firebase Hosting
- [ ] Configure custom domain
- [ ] Add analytics and monitoring
- [ ] Invite your team members

**Happy project tracking! 🎊**
