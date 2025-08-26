# Environment Variables Configuration

For your Vercel deployment at: `https://testapp-git-main-steel2xs-3124s-projects.vercel.app`

## Required Environment Variables

Add these to your Vercel project settings:

```
NEXTAUTH_URL=https://testapp-git-main-steel2xs-3124s-projects.vercel.app
NEXTAUTH_SECRET=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
```

### For Local Development (.env.local):
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
```

## Google Cloud Console Settings

### Authorized JavaScript Origins:
```
https://testapp-git-main-steel2xs-3124s-projects.vercel.app
```

### Authorized Redirect URIs:
```
https://testapp-git-main-steel2xs-3124s-projects.vercel.app/api/auth/callback/google
```

## Steps to Configure:

1. **Vercel Environment Variables:**
   - Go to your Vercel project dashboard
   - Navigate to Settings → Environment Variables
   - Add the environment variables listed above

2. **Google Cloud Console:**
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Select your OAuth 2.0 Client ID
   - Update the settings with the URLs above

3. **Google Maps API Setup:**
   - Go to Google Cloud Console → APIs & Services → Library
   - Enable "Maps JavaScript API" and "Places API"
   - Go to APIs & Services → Credentials
   - Create a new API Key or use existing one
   - Restrict the API key to your domains for security

4. **Generate NEXTAUTH_SECRET:**
   ```bash
   openssl rand -base64 32
   ```
