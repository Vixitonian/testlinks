<!-- bein:lessons:start -->
## Lessons from earlier chats (the user's corrections and preferences: follow them)
- 2026-11-12: Admin email: dominicharry9@gmail.com
- 2026-11-12: SupaBein email (verified on project 138): a per-project `resend` integration is required (API refuses without a secret); the hub's verified sender is noreply@dxinnovationhub.com. Sessions: the API gateway eats Authorization and CORS blocks custom headers, so function calls must send the token in the POST body.
- 2026-11-12: NogTrack (SupaBein 138): Resend email delivery confirmed working by the user on 2026-11-12; send_otp now emails the code only (never returns it, 502 on provider failure).
<!-- bein:lessons:end -->
