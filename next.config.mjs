const backendOrigin =
  process.env.BACKEND_PROXY_ORIGIN ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  `http://127.0.0.1:${process.env.BACKEND_PORT || process.env.PORT || "3101"}`;

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`
      },
      {
        source: "/socket.io/:path*",
        destination: `${backendOrigin}/socket.io/:path*`
      }
    ];
  }
};

export default nextConfig;
