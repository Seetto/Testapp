import GoogleProvider from 'next-auth/providers/google'

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.readonly'
        }
      }
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  // Dynamic URL configuration to support both localhost and IP access
  url: process.env.NEXTAUTH_URL,
  callbacks: {
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      // Redirect to calendar page after successful login
      if (url === baseUrl || url === `${baseUrl}/`) {
        return `${baseUrl}/calendar`
      }
      // Allow same-origin URLs
      if (url.startsWith(baseUrl)) return url
      return baseUrl
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: { session: any; token: any }) {
      // Pass the access token to the session
      session.accessToken = token.accessToken
      return session
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, account }: { token: any; account: any }) {
      // Store the access token from Google
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
  },
}
