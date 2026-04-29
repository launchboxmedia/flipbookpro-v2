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
}

export default nextConfig
