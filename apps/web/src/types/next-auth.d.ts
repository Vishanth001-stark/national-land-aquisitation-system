import { DefaultSession } from 'next-auth'
import { JWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      stateId?: string | null
      districtId?: string | null
    } & DefaultSession['user']
  }

  interface User {
    id: string
    role?: string
    stateId?: string | null
    districtId?: string | null
  }
}

declare module 'next-auth/adapters' {
  interface AdapterUser {
    id: string
    role?: string
    stateId?: string | null
    districtId?: string | null
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
