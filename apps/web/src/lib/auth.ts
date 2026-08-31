import NextAuth, { NextAuthOptions, getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

// Extend NextAuth types to include custom fields
declare module 'next-auth' {
  interface User {
    role?: string
    stateId?: string | null
    districtId?: string | null
  }
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      role: string
      stateId?: string | null
      districtId?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: string
    stateId?: string | null
    districtId?: string | null
  }
}

export const authOptions: NextAuthOptions = {
  // NOTE: PrismaAdapter removed — it is incompatible with JWT session strategy.
  // JWT strategy manages sessions entirely in signed tokens without DB session tables.
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { role: true, state: true, district: true }
        })

        if (!user || !user.passwordHash) {
          throw new Error('Invalid credentials')
        }

        const isCorrectPassword = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isCorrectPassword) {
          throw new Error('Invalid credentials')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.name,
          stateId: user.stateId,
          districtId: user.districtId,
        }
      }
    })
  ],
  pages: {
    signIn: '/auth/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.stateId = user.stateId
        token.districtId = user.districtId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || (token.sub as string)
        session.user.role = token.role as string
        session.user.stateId = token.stateId as string | null | undefined
        session.user.districtId = token.districtId as string | null | undefined
      }
      return session
    }
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

// Export auth function for server-side usage
export const auth = () => getServerSession(authOptions)

export default NextAuth(authOptions)