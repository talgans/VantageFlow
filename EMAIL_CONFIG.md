# Email Configuration for VantageFlow

## Setup Gmail App Password

1. **Enable 2-Step Verification on your Gmail account:**
   - Go to https://myaccount.google.com/security
   - Click on "2-Step Verification" and follow the setup process

2. **Create an App Password:**
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "VantageFlow" as the name
   - Click "Generate"
   - Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

## Configure Firebase Functions

Run these commands to set the email configuration:

```bash
# Set your Gmail address
firebase functions:config:set email.user="your-email@gmail.com"

# Set your Gmail App Password (remove spaces from the 16-character password)
firebase functions:config:set email.password="abcdefghijklmnop"
```

**Example:**
```bash
firebase functions:config:set email.user="talgans@gmail.com"
firebase functions:config:set email.password="wxyz1234abcd5678"
```

## Deploy the Configuration

After setting the configuration, redeploy the functions:

```bash
firebase deploy --only functions
```

## Verify Configuration

Check your current configuration:

```bash
firebase functions:config:get
```

You should see:
```json
{
  "email": {
    "user": "your-email@gmail.com",
    "password": "your-app-password"
  }
}
```

## Test Email Sending

1. Log into VantageFlow as admin
2. Go to **User Administration** → **Invite Users** tab
3. Enter an email address and select a role
4. Click **Send Invitation**
5. Check the recipient's inbox (and spam folder)

## Troubleshooting

### Email not sending?
- Check Cloud Functions logs: `firebase functions:log`
- Verify the App Password is correct (no spaces)
- Make sure 2-Step Verification is enabled on your Gmail account
- Check if Gmail is blocking the sign-in attempt

### "Invalid credentials" error?
- Regenerate the App Password and update the config
- Make sure you're using an App Password, not your regular Gmail password

### Email goes to spam?
- Add SPF/DKIM records (requires custom domain)
- Ask recipients to mark as "Not Spam"
- Consider using a dedicated email service for production (SendGrid, Mailgun)

## Security Notes

- **Never commit email credentials to Git**
- Firebase Functions config is stored securely in Google Cloud
- App Passwords are safer than using your main Gmail password
- Rotate App Passwords periodically
- For production, consider a dedicated transactional email service

## Current Implementation

- **Service**: Gmail SMTP via Nodemailer
- **Function**: `inviteUser` Cloud Function
- **Template**: HTML email with password reset link
- **Link Expiration**: 1 hour (Firebase default)
