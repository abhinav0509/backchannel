# Backchannel email templates

Paste these into Supabase > Authentication > Emails > Templates (editable once custom SMTP is set).
Both links go to `/auth/confirm`, which verifies the token on the server, so they work on any
device. The sign-in email also carries the 6-digit code, for when the link is opened elsewhere.

## Invite user

Subject:

```
You're invited to Backchannel
```

Body:

```html
<div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; color: #15171c; max-width: 480px; margin: 0 auto; padding: 32px 8px;">
  <p style="font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 16px;">You're invited to Backchannel</p>
  <p style="font-size: 15px; line-height: 1.55; color: #4b505b; margin: 0 0 12px;">
    Backchannel researches the companies that approach you: who owns and runs them, their money, layoffs, AI and press, each fact with its source. Add your CV and it shows how each role fits you, and what to ask in every interview round.
  </p>
  <p style="font-size: 15px; line-height: 1.55; color: #4b505b; margin: 0 0 24px;">It takes a minute to set up. Start by adding your CV.</p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite" style="display: inline-block; background: #4a2be8; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 20px; border-radius: 10px;">Accept the invitation</a>
  <p style="font-size: 13px; line-height: 1.5; color: #858b96; margin: 24px 0 0;">The link works once. Afterwards, sign in at {{ .SiteURL }} with this email address.</p>
</div>
```

## Magic link (sign in)

Subject:

```
Your Backchannel sign-in code: {{ .Token }}
```

Body:

```html
<div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; color: #15171c; max-width: 480px; margin: 0 auto; padding: 32px 8px;">
  <p style="font-size: 15px; color: #4b505b; margin: 0 0 8px;">Your sign-in code</p>
  <p style="font-size: 32px; font-weight: 700; letter-spacing: 0.2em; margin: 0 0 24px;">{{ .Token }}</p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email" style="display: inline-block; background: #4a2be8; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 20px; border-radius: 10px;">Sign in to Backchannel</a>
  <p style="font-size: 13px; line-height: 1.5; color: #858b96; margin: 24px 0 0;">The code and link expire in an hour. If you did not ask to sign in, ignore this email.</p>
</div>
```
