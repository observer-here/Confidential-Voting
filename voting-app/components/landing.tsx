"use client"

import { ArrowRight, ArrowUpRight, Check, Eye, Link2, Loader2, Lock, Shield, X } from "lucide-react"
import { useWeb3 } from "@/contexts/web3-context"
import { Magnetic } from "@/components/magnetic"
import { MountainBg } from "@/components/mountain-bg"
import { SiteFooter } from "@/components/site-footer"

const FEATURES = [
  { icon: Lock, title: "Encrypted votes", text: "Your choices are stored using Fhenix CoFHE on-chain." },
  { icon: Eye, title: "Controlled reveal", text: "Results stay encrypted until the proposal owner closes voting and reveals the tally." },
  { icon: Link2, title: "On-chain verifiable", text: "All logic and final results are published on-chain for transparency." },
]

const SERIF = "font-[family-name:var(--font-serif)]"

export function Landing() {
  const { connectWallet, isConnecting } = useWeb3()

  // opens the wallet modal; CoFHE SDK connects once the wallet is in
  const launch = (
    <button
      onClick={connectWallet}
      disabled={isConnecting}
      className="flex items-center gap-2 rounded-xl bg-[#c5d9c2] px-6 py-3 text-sm font-medium text-[#121614] hover:bg-[#d5e6d2] disabled:opacity-60"
    >
      {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Launch App <ArrowUpRight className="h-4 w-4" /></>}
    </button>
  )

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-[#090b0a] text-[#e7ece8]">
      <MountainBg />

      <header className="relative z-10 flex items-center justify-between border-b border-white/[0.06] px-4 py-4 md:px-10">
        <div className="flex items-center gap-2.5">
          <Shield className="h-5 w-5 text-[#b7d0b4]" />
          <span className={`${SERIF} text-xl`}>Confidential Voting</span>
        </div>
        <button
          onClick={connectWallet}
          disabled={isConnecting}
          className="flex items-center gap-1.5 rounded-xl border border-[#8fbf88]/40 px-4 py-2 text-sm text-[#c5d9c2] hover:bg-[#1c241e] disabled:opacity-60"
        >
          {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Launch App <ArrowUpRight className="h-3.5 w-3.5" /></>}
        </button>
      </header>

      <main className="relative z-10 flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 md:px-10 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[10px] tracking-[0.18em] text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8fbf88]" />
              POWERED BY FHENIX COFHE
            </span>
            <h1 className={`${SERIF} mt-6 text-[44px] leading-[1.05] md:text-6xl lg:text-[68px]`}>
              Vote freely.
              <br />
              <span className="text-[#8fbf88]">Reveal only the result.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-zinc-500">
              Private yes/no voting with encrypted tallies. Your choice stays confidential while the proposal is open.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-6">
              <Magnetic>{launch}</Magnetic>
              <a href="#how" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-[#c5d9c2]">
                Explore how it works <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* static preview of a proposal card */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0b0e0c]/70 p-5 backdrop-blur-sm md:p-6">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Proposal #08</span>
              <span className="flex items-center gap-1.5 rounded-full bg-[#1c241e] px-2.5 py-1 text-[10px] tracking-wider text-[#8fbf88]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8fbf88]" />
                VOTING ACTIVE
              </span>
            </div>
            <h2 className={`${SERIF} mt-4 text-2xl leading-8`}>Should we ship the next release?</h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#8fbf88]/40 bg-[#1c241e] text-sm text-[#c5d9c2]">
                <Check className="h-4 w-4" /> Yes
              </div>
              <div className="flex h-12 items-center justify-center gap-2 rounded-xl border border-red-900/50 bg-red-950/20 text-sm text-red-200/80">
                <X className="h-4 w-4" /> No
              </div>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-zinc-500">
              <Lock className="h-3 w-3" /> Your vote is encrypted and private.
            </p>
            <div className="mt-5 border-t border-white/[0.06] pt-4 text-xs text-zinc-500">
              <p className="flex items-center gap-2 text-zinc-300">
                <Lock className="h-3.5 w-3.5" /> Tally encrypted
              </p>
              {["Yes", "No"].map((label) => (
                <div key={label} className="mt-3 flex items-center gap-3">
                  <span className="w-7">{label}</span>
                  <div className="h-1.5 flex-1 rounded-full bg-white/10" />
                  <span>-</span>
                </div>
              ))}
              <p className="mt-4">Results become public after the vote closes and the tally is revealed.</p>
            </div>
          </div>
        </section>

        <section id="how" className="border-t border-white/[0.06]">
          <div className="mx-auto grid max-w-6xl divide-y divide-white/[0.06] px-4 md:px-10 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4 py-8 lg:px-8 lg:first:pl-0 lg:last:pr-0">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#141816] text-[#b7d0b4]">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className={`${SERIF} text-lg`}>{title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-zinc-500">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
