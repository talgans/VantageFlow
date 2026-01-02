# Email Setup Guide for VantageFlow

## Firebase Email Extension Setup

The Firebase Trigger Email extension has been partially installed. To complete the setup and enable automatic email sending for user invitations, follow these steps:

## Option 1: Gmail SMTP (Recommended for Testing)

### Step 1: Create Gmail App Password
1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification** (enable if not already)
3. Scroll down to **App passwords**
4. Select **Mail** and **Other (Custom name)** → Enter "VantageFlow"
5. Copy the 16-character password generated

### Step 2: Complete Extension Configuration
Run this command to update the extension configuration:

```bash
firebase ext:configure firestore-send-email
```

When prompted:
- **SMTP connection URI**: `smtps://your-email@gmail.com:YOUR_APP_PASSWORD@smtp.gmail.com:465`
  - Replace `your-email@gmail.com` with your Gmail address
  - Replace `YOUR_APP_PASSWORD` with the 16-character password from Step 1
- **Default FROM address**: `your-email@gmail.com` or `VantageFlow <your-email@gmail.com>`

### Step 3: Deploy the Extension
```bash
firebase deploy --only extensions
```

## Option 2: Gmail OAuth2 (More Secure, Production)

### Step 1: Get OAuth2 Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Choose **Web application**
6. Add authorized redirect URI: `https://developers.google.com/oauthplayground`
7. Copy the **Client ID** and **Client Secret**

### Step 2: Get Refresh Token
1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (⚙️) in top right
3. Check "Use your own OAuth credentials"
4. Enter your **Client ID** and **Client Secret**
5. In Step 1, scroll to "Gmail API v1" → Select `https://mail.google.com/`
6. Click "Authorize APIs"
7. Sign in with your Gmail account
8. Click "Exchange authorization code for tokens"
9. Copy the **Refresh Token**

### Step 3: Update Extension Secrets
```bash
firebase ext:configure firestore-send-email
```

When prompted, provide:
- **OAuth2 Client ID**: Your Client ID from Step 1
- **OAuth2 Client Secret**: Your Client Secret from Step 1
- **OAuth2 Refresh Token**: Your Refresh Token from Step 2
- **OAuth2 SMTP User**: Your Gmail address

### Step 4: Deploy the Extension
```bash
firebase deploy --only extensions
```

## Testing Email Delivery

After setup is complete:

1. Go to VantageFlow → **User Administration** → **Invite Users** tab
2. Enter an email address and select a role
3. Click **Send Invitation**
4. Check Firestore Console → `mail` collection to verify email document was created
5. Check the recipient's inbox for the invitation email

## Email Template

The invitation email includes:
- Welcome message with role assignment
- "Set Your Password" button linked to Firebase password reset
- 1-hour expiration notice
- VantageFlow branding

## Troubleshooting

### Email Not Sending?
1. Check Firebase Console → Extensions → `firestore-send-email` → View in Cloud Functions
2. Look for errors in function logs
3. Verify the `mail` collection has documents with `delivery` field showing status

### Common Issues:
- **"Invalid login"**: Double-check Gmail App Password or OAuth2 credentials
- **Port blocked**: Use port 465 (SMTPS) or 587 (STARTTLS), not port 25
- **No email received**: Check spam folder, verify FROM address is correct
- **OAuth2 error**: Ensure refresh token is valid and Gmail API is enabled

## Security Notes

- Never commit SMTP passwords or OAuth2 secrets to Git
- Use Cloud Secret Manager (already configured by the extension)
- Rotate credentials periodically
- For production, consider a dedicated email service (SendGrid, Mailgun, etc.)

## Current Configuration

Extension ID: `firestore-send-email`
Collection: `mail`
FROM address: `talgans@gmail.com`
SMTP: Gmail (smtp.gmail.com:465)
