/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // API configuration
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
    responseLimit: '2mb',
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    COINBASE_API_BASE_URL: process.env.COINBASE_API_BASE_URL,
  },
  
  // Enable experimental features if needed
  experimental: {
    // esmExternals: 'loose',
  },
}

module.exports = nextConfig
