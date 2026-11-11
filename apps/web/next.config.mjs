const API = process.env.API_INTERNAL_URL || 'http://localhost:4100';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@sf/templates'],
  // Browser → /api/* → NestJS. Same origin, so the httpOnly session cookie just works.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API}/:path*` }];
  },
  images: { unoptimized: true },
};
export default nextConfig;
