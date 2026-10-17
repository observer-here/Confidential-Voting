"use client"

import { useWeb3 } from "@/contexts/web3-context"
import { ChevronDown, Loader2, Wallet } from "lucide-react"

function shortAddr(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function identicon(address: string) {
  return `linear-gradient(135deg, #${address.slice(2, 8)}, #${address.slice(-6)})`
}

export function WalletConnect() {
  const { account, isConnected, isConnecting, connectWallet, disconnectWallet } = useWeb3()

  if (!isConnected) {
    return (
      <button
        onClick={connectWallet}
        disabled={isConnecting}
        className="flex items-center gap-2 rounded-full bg-[#c8e6c0] px-4 py-2 text-sm font-medium text-[#0b0d0c] hover:bg-[#d7efd0] disabled:opacity-60"
      >
        {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>
    )
  }

  return (
    <button
      onClick={disconnectWallet}
      className="flex items-center gap-2 rounded-full border border-white/10 bg-[#141716] px-2 py-1.5 text-sm text-zinc-200 hover:border-white/20"
    >
      <span className="h-6 w-6 rounded-full" style={{ background: identicon(account!) }} />
      {shortAddr(account!)}
      <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
    </button>
  )
}
