# Axios Integration for Request/Response Logging

## Overview

This project now uses Axios for API calls with comprehensive request and response logging capabilities. The Axios client provides:

- **Automatic request/response logging** (enabled in development mode)
- **Automatic token refresh** on 401 responses
- **Request/response interceptors** for consistent behavior
- **Error handling** with detailed error information

## Files

### Core Axios Client
- `lib/axiosClient.ts` - Main Axios client with logging interceptors

### Updated API Files
All files in `lib/api/` have been updated to use the new Axios client:
- `lib/api/me.ts`
- `lib/api/vendorBusinesses.ts`
- `lib/api/leads.ts`
- `lib/api/categories.ts`
- `lib/api/documentTypes.ts`
- `lib/api/reviews.ts`
- `lib/api/vendors.ts`
- `lib/api/offers.ts`
- `lib/api/fileStorage.ts`
- `lib/api/packages.ts`
- `lib/api/media.ts`
- `lib/api/notifications.ts`
- `lib/api/verificationDocuments.ts`

## Usage

### Basic API Calls

```typescript
import { axiosFunctionsCall } from '../axiosClient';

// Call an Edge Function
const { data, error } = await axiosFunctionsCall<MyResponseType>(
  'function-name',
  { param1: 'value1', param2: 'value2' },
  'responseKey' // Optional: unwrap response by key
);
```

### Direct Axios Instance Usage

```typescript
import { apiAxios, functionsAxios } from '../axiosClient';

// Using the API Axios instance
const response = await apiAxios.get('/endpoint');
const response = await apiAxios.post('/endpoint', { data: 'value' });

// Using the Functions Axios instance (for Edge Functions)
const response = await functionsAxios.post('function-name', { body: 'value' });
```

## Logging Output

### Request Logging
When a request is made, you'll see in the console:
```
📡 [API Request] 2026-04-07T11:00:00.000Z
  GET https://api.example.com/endpoint
  Headers: { "Content-Type": "application/json", ... }
  Payload: { ... }
  Payload Size: 1.23 KB
```

### Response Logging
When a response is received:
```
✅ [API Response] 2026-04-07T11:00:01.000Z
  GET https://api.example.com/endpoint - 200 OK
  Response Data: { ... }
  Response Size: 2.45 KB
```

### Error Logging
When an error occurs:
```
❌ [API Error] 2026-04-07T11:00:02.000Z
  POST https://api.example.com/endpoint
  Status: 400 Bad Request
  Response Data: { error: "Invalid data" }
```

## Configuration

### Enabling/Disabling Logging

Logging is automatically enabled in development mode (`__DEV__` is true) and disabled in production.

To modify this behavior, edit `lib/axiosClient.ts`:

```typescript
// Change this line to control logging
const API_LOGGING_ENABLED = __DEV__; // Set to true to always enable, false to always disable
```

### Custom Axios Instance

You can create a custom Axios instance with the same logging capabilities:

```typescript
import { createAxiosInstance } from '../axiosClient';

const customAxios = createAxiosInstance('https://custom-api.example.com');
```

## Features

### 1. Automatic Token Management
- Automatically adds Bearer token to requests
- Automatically refreshes expired tokens
- Handles 401 responses with token retry

### 2. Request/Response Interceptors
- Request interceptor: Logs request details and adds authentication
- Response interceptor: Logs response details
- Error interceptor: Logs errors and handles authentication failures

### 3. Error Handling
All API calls return a consistent error format:
```typescript
{
  success: false,
  error: string,
  code?: string,
  retryAfter?: number
}
```

### 4. Size Formatting
Request and response sizes are automatically formatted in human-readable format (B, KB, MB, GB).

## Migration from Fetch

If you have existing code using `fetch` or `apiFetch`, here's how to migrate:

### Before (using apiFetch):
```typescript
import { apiFetch } from '../apiClient';

const response = await apiFetch('/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: 'value' })
});
const data = await response.json();
```

### After (using axiosFunctionsCall):
```typescript
import { axiosFunctionsCall } from '../axiosClient';

const { data, error } = await axiosFunctionsCall<MyType>(
  'endpoint',
  { data: 'value' }
);
```

### After (using apiAxios directly):
```typescript
import { apiAxios } from '../axiosClient';

const response = await apiAxios.post('/endpoint', { data: 'value' });
const data = response.data;
```

## Best Practices

1. **Use `axiosFunctionsCall` for Edge Functions** - It handles response unwrapping automatically
2. **Use `apiAxios` for REST endpoints** - Direct Axios usage for standard API calls
3. **Always handle errors** - Check for `error` in the response
4. **Keep logging enabled in development** - It helps debug API issues
5. **Consider disabling in production** - Logging may expose sensitive data

## Troubleshooting

### Logs not appearing?
- Check that `API_LOGGING_ENABLED` is set to `true` in `lib/axiosClient.ts`
- Ensure you're running in development mode (`__DEV__` is true)
- Check browser/device console for filtered logs

### Token refresh not working?
- Verify `refreshToken.ts` is properly configured
- Check that tokens are stored correctly in `tokenStorage.ts`
- Ensure the refresh endpoint is accessible

### 401 errors persisting?
- The token may be invalid - try logging out and back in
- Check that the backend is accepting the token format
- Verify the Authorization header is being set correctly (check logs)