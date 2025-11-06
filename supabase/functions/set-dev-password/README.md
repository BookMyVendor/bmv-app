# Set Dev Password Edge Function

This Edge Function sets a password for a user using Supabase Admin API.

## Usage

Called from the client app when creating a dev user. The function:
1. Receives `userId` and `password` in the request body
2. Uses admin API to update the user's password
3. Returns success or error

## Deployment

Deploy using Supabase CLI:

```bash
supabase functions deploy set-dev-password
```

Or deploy all functions:

```bash
supabase functions deploy
```

## Environment Variables

Requires `SUPABASE_SERVICE_ROLE_KEY` to be set in Supabase Dashboard:
1. Go to Project Settings → API
2. Copy the `service_role` key (not the anon key)
3. Go to Edge Functions → Settings
4. Add secret: `SUPABASE_SERVICE_ROLE_KEY` = `<your-service-role-key>`

## Testing

Test locally:

```bash
supabase functions serve set-dev-password
```

Then call:

```bash
curl -X POST http://localhost:54321/functions/v1/set-dev-password \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid", "password": "test-password"}'
```

