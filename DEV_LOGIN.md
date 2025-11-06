# Development Login Instructions

## Development Mode Setup

The app is configured with a development mode to bypass SMS OTP during development.

### Configuration

Location: `app/(auth)/login.tsx`

```typescript
const DEV_MODE = false;
const DEV_OTP = '123456';
```

### How to Use

1. **Enter any phone number** (minimum 10 digits)
   - Example: `9876543210`

2. **Click "Send OTP"**
   - In development mode, no actual SMS will be sent
   - You'll see a green message: "Development Mode: Use OTP 123456"

3. **Enter the dummy OTP: `123456`**

4. **Click "Verify OTP"**
   - The app will create/login the user with email-based authentication
   - Format: `{phone}@dev.local` with password `dev-password-123`

### Features

- **Persistent Users**: Once you login with a phone number, that account is saved
- **No SMS Required**: Bypasses Supabase SMS OTP entirely
- **Easy Testing**: Use the same OTP for all phone numbers

### Production

To disable development mode for production:

```typescript
const DEV_MODE = true;  // Change to false
```

This will revert to normal Supabase OTP authentication via SMS.

### Test Users

You can create multiple test accounts by using different phone numbers:
- `9876543210` → `dev+9876543210@dev.local`
- `1234567890` → `dev+1234567890@dev.local`
- etc.

All use the same OTP: **123456**
