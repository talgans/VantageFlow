# Email Configuration for VantageFlow

VantageFlow uses **Resend** for transactional emails.

## Setup Resend

1.  **Create a Resend Account:**
    - Go to [https://resend.com](https://resend.com) and sign up.
    - Verify your domain (recommended for production).

2.  **Get API Key:**
    - Go to API Keys in the dashboard.
    - Create a new API Key with "Sending" permissions.
    - Copy the key (e.g., `re_123456789...`).

## Configure Firebase Functions

Run this command to set the Resend API key:

```bash
firebase functions:config:set resend.api_key="re_123456789..."
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
  "resend": {
    "api_key": "re_..."
  }
}
```

