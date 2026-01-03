# VantageFlow Deployment Checklist

Use this checklist to ensure a smooth deployment to production.

## 🔧 Pre-Deployment Setup

### Firebase Configuration
- [ ] Firebase project created
- [ ] Firestore database enabled in production mode
- [ ] Firebase Authentication enabled (Email/Password provider)
- [ ] Firebase Hosting enabled (if using)
- [ ] Billing account linked (if expecting high traffic)

### Environment Variables
- [ ] `.env.local` created with all required variables
- [ ] `VITE_FIREBASE_API_KEY` set
- [ ] `VITE_FIREBASE_AUTH_DOMAIN` set
- [ ] `VITE_FIREBASE_PROJECT_ID` set
- [ ] `VITE_FIREBASE_STORAGE_BUCKET` set
- [ ] `VITE_FIREBASE_MESSAGING_SENDER_ID` set
- [ ] `VITE_FIREBASE_APP_ID` set
- [ ] `GEMINI_API_KEY` set

### Security Rules
- [ ] `firestore.rules` reviewed and customized
- [ ] Security rules deployed: `firebase deploy --only firestore:rules`
- [ ] Rules tested with Firebase Emulator (optional)

### Database Setup
- [ ] Initial data seeded: `npm run seed` (in firestore-admin)
- [ ] Test projects created and verified
- [ ] Database indexes created (if needed)

### User Management
- [ ] Admin user created via signup
- [ ] Admin role assigned: `npm run set-role admin@example.com admin`
- [ ] Test users created for each role (Admin, Manager, Member)
- [ ] Role permissions tested in UI

---

## 🧪 Testing Checklist

### Authentication Testing
- [ ] Sign up creates new user
- [ ] Sign in works with correct credentials
- [ ] Sign out clears session
- [ ] Invalid credentials show error
- [ ] Password reset works (if implemented)

### Role-Based Access Testing
- [ ] Member can view but not edit/delete
- [ ] Manager can create and edit but not delete
- [ ] Admin has full access
- [ ] Unauthorized actions blocked in UI
- [ ] Firestore rules enforce permissions

### Real-Time Sync Testing
- [ ] Changes sync across multiple browser windows
- [ ] Project creation appears immediately
- [ ] Project updates reflect instantly
- [ ] Project deletion syncs correctly
- [ ] No data loss during rapid updates

### UI/UX Testing
- [ ] All pages load correctly
- [ ] Loading states display properly
- [ ] Error messages are user-friendly
- [ ] Toast notifications work
- [ ] Mobile responsive design verified
- [ ] Charts render correctly
- [ ] Gantt chart displays properly
- [ ] AI insights load and display

### Browser Compatibility
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile browsers (iOS Safari, Chrome)

---

## 🚀 Deployment Steps

### Option 1: Firebase Hosting

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Test production build locally:**
   ```bash
   npm run preview
   ```

3. **Initialize Firebase Hosting (first time):**
   ```bash
   firebase init hosting
   ```
   - Select your Firebase project
   - Set public directory to: `dist`
   - Configure as single-page app: Yes
   - Don't overwrite index.html

4. **Deploy:**
   ```bash
   firebase deploy
   ```

5. **Verify deployment:**
   - [ ] Visit deployed URL
   - [ ] Test authentication
   - [ ] Test project operations
   - [ ] Check browser console for errors

### Option 2: Google AI Studio CDN

1. **Build for production:**
   ```bash
   npm run build
   ```

2. **Upload to AI Studio:**
   - Package dist/ folder contents
   - Upload to AI Studio
   - Dependencies load from aistudiocdn.com

3. **Configure environment:**
   - Set environment variables in AI Studio settings
   - Test deployed version

### Option 3: Custom Hosting

1. **Build:**
   ```bash
   npm run build
   ```

2. **Deploy dist/ folder to your hosting provider:**
   - Netlify
   - Vercel
   - AWS S3 + CloudFront
   - Azure Static Web Apps
   - etc.

3. **Configure environment variables** in hosting dashboard

4. **Set up redirects** for SPA routing

---

## 🔒 Security Checklist

### Firebase Security
- [ ] Service account keys never committed to Git
- [ ] `.env.local` in `.gitignore`
- [ ] `firestore-admin/serviceAccountKey.json` in `.gitignore`
- [ ] Firestore rules restrict write access
- [ ] Firestore rules validate data structure
- [ ] API keys restricted to specific domains

### Authentication Security
- [ ] Password requirements enforced (min 6 chars)
- [ ] Email verification enabled (optional)
- [ ] Rate limiting configured (optional)
- [ ] Session timeout configured

### Code Security
- [ ] No hardcoded credentials
- [ ] Dependencies updated: `npm audit`
- [ ] No console.log with sensitive data
- [ ] HTTPS enforced

---

## 📊 Monitoring & Analytics

### Firebase Console
- [ ] Enable Firestore usage monitoring
- [ ] Enable Authentication monitoring
- [ ] Set up budget alerts
- [ ] Configure error reporting

### Performance
- [ ] Test page load times
- [ ] Optimize images (if any)
- [ ] Enable caching headers
- [ ] Monitor bundle size

---

## 📝 Post-Deployment

### Documentation
- [ ] Update README.md with live URL
- [ ] Document any custom configuration
- [ ] Create runbook for common issues
- [ ] Update team on deployment

### User Onboarding
- [ ] Send invite emails to team
- [ ] Create initial admin users
- [ ] Provide user guide/training
- [ ] Set up support channel

### Backup & Recovery
- [ ] Set up Firestore automatic backups
- [ ] Document recovery procedures
- [ ] Test backup restoration (optional)

---

## 🐛 Troubleshooting

### Deployment Issues

**Build fails:**
```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Environment variables not working:**
- Check variable names start with `VITE_`
- Rebuild after changing `.env.local`
- Verify variables in build output

**Firebase deployment fails:**
```bash
# Re-authenticate
firebase login --reauth
# Try deploying specific services
firebase deploy --only hosting
firebase deploy --only firestore:rules
```

### Runtime Issues

**"Permission denied" errors:**
- Deploy security rules
- Verify user role assignments
- Check custom claims

**Real-time sync not working:**
- Check Firestore rules
- Verify auth state
- Check browser console

**AI insights not loading:**
- Verify Gemini API key
- Check API quota limits
- Review browser console errors

---

## ✅ Final Verification

Before going live:

- [ ] All tests passing
- [ ] Security rules deployed and tested
- [ ] Admin users set up
- [ ] Documentation updated
- [ ] Team notified
- [ ] Monitoring enabled
- [ ] Backup strategy in place
- [ ] Support process defined

---

## 🎉 Success!

Your VantageFlow dashboard is now live! 🚀

**Next steps:**
1. Monitor usage in Firebase Console
2. Gather user feedback
3. Iterate and improve
4. Scale as needed

**Support:**
- Firebase Status: https://status.firebase.google.com/
- Documentation: See FIREBASE_SETUP.md
- Issues: GitHub repository

---

*Last updated: November 8, 2025*
