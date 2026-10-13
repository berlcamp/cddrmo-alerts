import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  redirects() {
    return [{ source: '/admin/zones', destination: '/admin/options?tab=zones', permanent: true }];
  },
  experimental: {
    // Pop-up image uploads go through a Server Action: a 2 MB image plus form overhead.
    serverActions: { bodySizeLimit: '3mb' },
  },
  outputFileTracingIncludes: {
    '/reports/[id]/og': ['./assets/fonts/**'],
  },
};

export default nextConfig;
