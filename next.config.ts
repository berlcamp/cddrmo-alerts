import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  redirects() {
    return [{ source: '/admin/zones', destination: '/admin/options?tab=zones', permanent: true }];
  },
  outputFileTracingIncludes: {
    '/reports/[id]/og': ['./assets/fonts/**'],
  },
};

export default nextConfig;
