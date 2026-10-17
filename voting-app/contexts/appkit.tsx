"use client"

import { useEffect, type ReactNode } from "react"
import { createAppKit } from "@reown/appkit/react"
import { EthersAdapter } from "@reown/appkit-adapter-ethers"
import { sepolia } from "@reown/appkit/networks"
import { StorageUtil } from "@reown/appkit-controllers"

StorageUtil.isCacheExpired = () => false
StorageUtil.getNativeBalanceCacheForCaipAddress = (caipAddress) => {
  try {
    return StorageUtil.getNativeBalanceCache()[caipAddress]
  } catch {
    return undefined
  }
}
StorageUtil.getBalanceCacheForCaipAddress = (caipAddress) => {
  try {
    return StorageUtil.getBalanceCache()[caipAddress]?.balance
  } catch {
    return undefined
  }
}

const projectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "b56e18d47c72ab683b10814fe9495694"

const metadata = {
  name: "Confidential Voting",
  description: "Privacy-preserving voting with Fhenix CoFHE",
  url: "http://localhost:3000",
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
}

// runs on server too so useAppKit works during prerender; globalThis guard survives HMR
const globalRef = globalThis as { __cvAppKit?: unknown }
if (!globalRef.__cvAppKit) {
  globalRef.__cvAppKit = createAppKit({
    adapters: [new EthersAdapter()],
    projectId,
    networks: [sepolia],
    defaultNetwork: sepolia,
    metadata,
    features: {
      analytics: false,
      email: false,
      socials: false,
      onramp: false,
      swaps: false,
      history: false,
    },
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#9cbc9a",
    },
  })
}

export function AppKitProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const mountModal = async () => {
      try {
        await import("@reown/appkit-scaffold-ui/w3m-modal")
        if (!document.querySelector("w3m-modal")) {
          document.body.appendChild(document.createElement("w3m-modal"))
        }
      } catch (error) {
        console.error("Failed to mount WalletConnect modal", error)
      }
    }
    mountModal()
  }, [])

  return <>{children}</>
}
