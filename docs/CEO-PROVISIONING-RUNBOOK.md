# CEO Provisioning Runbook

This is an explicit, manual runbook. It documents the required order without calling Firebase, Postgres, email, or any external service. Never commit real credentials, service-account JSON, ID tokens, reset links, or production user data.

## Preconditions

- Confirm the target Firebase project and database environment separately.
- Use a real operator-approved CEO email. Do not use `seed:*` users or dummy emails from the database seed.
- Keep server-only `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY` in a secret manager or local environment. Never paste them into this runbook or shell history.
- Run `pnpm check:ceo-provisioning` before any real action.

## Provisioning Order

### 1. Create or locate the Firebase user

In the Firebase Admin console, create an Email/Password user for the approved email, or locate the existing user by email. Record the Firebase UID in a temporary protected note. Do not create or send a password in a script. Use the normal Firebase password-reset invitation flow.

If the email maps to a different person or unexpected existing account, stop. Do not overwrite or delete that account.

### 2. Set the CEO custom claim

Canonical wire claim:

```json
{
  "role": "authenticated",
  "app_role": "CEO",
  "tenant_id": null,
  "parent_tenant_id": null
}
```

`role` is the Supabase Postgres role, not the application role. The application role is `app_role`. Use `buildCustomClaims({ appRole: 'CEO' })` and server-only `setUserClaims(uid, claims)` when automating. Never use `setCustomUserClaims` from browser code.

After changing claims, force an ID-token refresh during verification. Existing tokens can remain stale until Firebase issues a new token.

### 3. Insert or verify the matching `users` row

Create or verify exactly one active row in `users`:

| Column             | Required value           |
| ------------------ | ------------------------ |
| `firebase_uid`     | Firebase UID from step 1 |
| `email`            | Approved Firebase email  |
| `full_name`        | Operator-approved name   |
| `role`             | `CEO`                    |
| `tenant_id`        | `NULL`                   |
| `parent_tenant_id` | `NULL`                   |
| `disabled`         | `false`                  |
| `deleted_at`       | `NULL`                   |

UID and email must identify the same person. Do not attach a CEO to a tenant. Do not reuse seed rows whose UID starts with `seed:`.

### 4. Send the invitation

Generate a Firebase password-reset link server-side with `generatePasswordResetLink(email)`, then deliver it through the approved email path. Never log or commit the link. The CEO chooses the password; provisioning does not handle or store it.

### 5. Verify login and session acceptance

Use a private browser session:

1. Sign in at `/login` with the invited Firebase account.
2. Refresh the Firebase ID token before exchanging it.
3. Confirm `POST /api/auth/session` succeeds and redirects to `/ceo-dashboard`.
4. Confirm the session contains the DB user ID, Firebase UID, `CEO` role, and null tenant IDs. It must not contain a raw Firebase ID token or secret.
5. Confirm a direct CEO route succeeds after server-side `requireCeo()`.

## Negative Role Tests

Each case must be rejected, not silently repaired:

| Case                                                 | Expected result                                                |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| `app_role: OWNER`, CEO DB row                        | Session rejected as stale claims                               |
| `app_role: STAFF`, CEO DB row                        | Session rejected as stale claims                               |
| `app_role: CEO` with non-null `tenant_id`            | Claim validation rejected                                      |
| `role: "CEO"`, `app_role: "CEO"`                     | Claim validation rejected; wire `role` must be `authenticated` |
| Valid Firebase token, no matching active `users` row | Session rejected as user not found                             |
| Matching UID, DB role `OWNER`                        | Session rejected as stale claims                               |
| Matching UID, `disabled = true` or `deleted_at` set  | Session rejected as inactive                                   |
| CEO session calling an owner/staff-only flow         | Flow-specific authorization rejected                           |

## Completion Record

Record only non-secret evidence: operator, timestamp, Firebase project ID, Firebase UID, DB user ID, claim refresh completed, session route result, and negative-test results. Do not record passwords, private keys, ID tokens, or reset URLs.

```bash
pnpm check:ceo-provisioning
```
