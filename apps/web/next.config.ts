import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,

  // Workspace packages are built to `dist` and consumed via their exports map,
  // so they resolve as normal dependencies. `server-only` guards in
  // @dbi/database and @dbi/auth keep server paths out of client bundles.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default config;