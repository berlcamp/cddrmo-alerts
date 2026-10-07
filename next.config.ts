import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/reports/[id]/og': ['./assets/fonts/**'],
  },
};

export default nextConfig;
