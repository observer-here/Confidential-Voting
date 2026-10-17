"use client"

import { useWeb3 } from "@/contexts/web3-context"
import { ChevronDown, Loader2 } from "lucide-react"

export function WalletConnect() {
  const { account, isConnected, isConnecting, connectWallet, disconnectWallet } = useWeb3()

  const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`

  if (!isConnected) {
    return (
      <button
        onClick={connectWallet}
        disabled={isConnecting}
        className="rounded-full bg-[#c5d9c2] px-4 py-2 text-sm font-medium text-[#121614] hover:bg-[#d5e6d2] disabled:opacity-60"
      >
        {isConnecting ? <Loader2 className="inline h-4 w-4 animate-spin" /> : "Connect Wallet"}
      </button>
    )
  }

  return (
    <button
      onClick={disconnectWallet}
      className="flex items-center gap-2 rounded-full border border-white/10 bg-[#141816] px-2.5 py-1.5 text-sm text-zinc-200 hover:border-white/20"
    >
      <span
        className="h-5 w-5 rounded-full"
        style={{
          background: `conic-gradient(from 120deg, #7aa37a, #c9a27a, #6d8fbf, #7aa37a)`,
        }}
      />
      <span className="font-medium">{formatAddress(account!)}</span>
      <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
    </button>
  )
}
