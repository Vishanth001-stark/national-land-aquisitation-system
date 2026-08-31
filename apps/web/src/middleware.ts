import withAuth from 'next-auth/middleware'

export default withAuth


export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/projects/:path*',
    '/api/proposals/:path*',
    '/api/citizen/:path*',
    '/api/dashboard/:path*',
  ],
}
