import NextAuth from 'next-auth'
import { authOptions } from '../../../../lib/auth'

// @ts-expect-error NextAuth import compatibility issue with latest Next.js
const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
