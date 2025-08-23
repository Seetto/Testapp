import GoogleProvider from 'next-auth/providers/google'

// @ts-expect-error NextAuth type compatibility with Next.js 15
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
    async redirect({ url, baseUrl }) {
      // Redirect to success page after successful login
      if (url === baseUrl || url === `${baseUrl}/`) {
        return `${baseUrl}/auth/success`
      }
      // Allow same-origin URLs
      if (url.startsWith(baseUrl)) return url
      return baseUrl
    },
    async session({ session, token }) {
      // Pass the access token to the session
      session.accessToken = token.accessToken
      return session
    },
    async jwt({ token, account }) {
      // Store the access token from Google
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
  },
}
