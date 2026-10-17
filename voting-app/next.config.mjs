/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@cofhe/sdk", "@reown/appkit", "@reown/appkit-adapter-ethers"],
  webpack: (config, { isServer, webpack }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
      topLevelAwait: true,
    }
    config.plugins.push(
      new webpack.IgnorePlugin({ resourceRegExp: /^@base-org\/account$/ })
    )
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    })
    config.output.webassemblyModuleFilename = isServer
      ? "./../static/wasm/[modulehash].wasm"
      : "static/wasm/[modulehash].wasm"
    return config
  },
}

export default nextConfig
