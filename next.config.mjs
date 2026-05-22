import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow next/image to load remote covers / chapter illustrations from
    // any Supabase Storage bucket. The hostname suffix match covers every
    // Supabase project URL (`<project-ref>.supabase.co`) so we don't have
    // to pin a single project.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

// org/project come from env (SENTRY_ORG / SENTRY_PROJECT) so no
// account-specific slug is committed. Source-map upload only runs when
// SENTRY_AUTH_TOKEN is also present in the build env (Vercel); without
// it the plugin silently skips upload and the build still succeeds.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
})

