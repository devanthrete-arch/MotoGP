# Privacy and deletion notes

Autoflex web MVP stores the minimum needed for the community loop:

- Posts, comments, likes, reports, and uploaded cover images.
- Lightweight profile display name.
- Hashed recovery code for profile recovery.
- Saved posts attached to a profile/save token.
- Profile ownership token for posts created while signed in.
- Blocked browser/profile tokens used for moderation.
- Product feedback messages, optional feedback name, page context, and browser/profile
  token when submitted.
- Client-side error messages, source, stack trace, page path, and browser/profile
  token when the webapp reports an error.

The MVP does not collect passwords, phone numbers, email addresses, service
center requests, payment data, or OBD/vehicle telemetry.

## Delete profile

Users can delete their lightweight profile from the Profile dialog. This removes:

- Profile display name.
- Recovery-code hash.
- Saved posts for that profile token.
- Posts created under that profile token, including their comments and reports.
- Any moderation block stored for that exact profile token.
- Local browser profile state.

Older posts created before profile ownership may still be controlled only by
their local per-post edit token.
