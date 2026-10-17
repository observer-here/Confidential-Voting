"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { useWeb3 } from "@/contexts/web3-context"
import { WalletConnect } from "@/components/wallet-connect"
import { MobileNav, TABS } from "@/components/mobile-nav"
import { Magnetic } from "@/components/magnetic"
import { Shield, Lock, Check, X, BarChart3, Loader2, RefreshCw, LogOut } from "lucide-react"

interface UserVote {
  proposalId: number
  vote: "yes" | "no" | "unknown" | "error"
  votedAt: Date
}

const TITLE = "font-[family-name:var(--font-serif)] text-[28px] leading-none md:text-[32px]"
const PRIMARY_BTN = "rounded-xl bg-[#c5d9c2] px-4 py-2.5 text-sm font-medium text-[#121614] hover:bg-[#d5e6d2] disabled:opacity-40"

function MountainBg() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[50%] overflow-hidden">
      <div className="cv-grid absolute inset-0" />
      <svg
        viewBox="0 0 1200 420"
        className="absolute bottom-0 right-0 h-full w-full opacity-40 md:w-[72%] md:opacity-70"
        preserveAspectRatio="xMaxYMax meet"
      >
        <defs>
          <pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.7" fill="#9cbc9a" />
          </pattern>
        </defs>
        <path d="M0 420 L180 250 L280 310 L420 140 L540 250 L680 90 L820 220 L960 70 L1100 200 L1200 120 L1200 420 Z" fill="url(#dots)" opacity="0.35" />
        <path d="M220 420 L380 280 L500 340 L640 190 L790 300 L920 160 L1080 280 L1200 210 L1200 420 Z" fill="url(#dots)" opacity="0.55" />
        <circle cx="980" cy="118" r="26" fill="none" stroke="#9cbc9a" strokeWidth="2" opacity="0.45" />
      </svg>
    </div>
  )
}

export default function Component() {
  const {
    account,
    isConnected,
    isCorrectNetwork,
    proposals,
    isLoading,
    fheStatus,
    createProposal,
    vote,
    makeVoteCountsPublic,
    hasUserVoted,
    getMyVote,
    refreshProposals,
    switchToSepolia,
    disconnectWallet,
    isProposalOwner,
    fheUserDecrypt,
  } = useWeb3()

  const { toast } = useToast()
  const [newProposal, setNewProposal] = useState("")
  const [activeTab, setActiveTab] = useState("vote")
  const [userVotes, setUserVotes] = useState<UserVote[]>([])
  const [votingStates, setVotingStates] = useState<Record<number, string>>({})
  const [creatingProposal, setCreatingProposal] = useState(false)
  const [proposalOwnership, setProposalOwnership] = useState<Record<number, boolean>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const proposalsPerPage = 3

  useEffect(() => {
    if (isConnected && proposals.length > 0 && fheStatus.initialized) {
      const proposalsToCheck = proposals.filter((proposal) => !userVotes.some((vote) => vote.proposalId === proposal.id))
      if (proposalsToCheck.length > 0) checkVotingStatus()
      checkProposalOwnership()
    }
  }, [isConnected, proposals, fheStatus.initialized])

  useEffect(() => {
    if (!isConnected) {
      setUserVotes([])
      setVotingStates({})
      setProposalOwnership({})
      setActiveTab("vote")
    }
  }, [isConnected])

  useEffect(() => {
    setCurrentPage(1)
  }, [proposals.length])

  // switching tabs on a phone should start at the top
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [activeTab, currentPage])

  const checkProposalOwnership = async () => {
    const ownership: Record<number, boolean> = {}
    for (const proposal of proposals) {
      try {
        ownership[proposal.id] = await isProposalOwner(proposal.id)
      } catch {
        ownership[proposal.id] = false
      }
    }
    setProposalOwnership(ownership)
  }

  const checkVotingStatus = async () => {
    const votes: UserVote[] = []
    const votedProposals: number[] = []
    for (const proposal of proposals) {
      try {
        if (await hasUserVoted(proposal.id)) votedProposals.push(proposal.id)
      } catch {}
    }
    if (votedProposals.length > 0) {
      votes.push(...userVotes.filter((vote) => votedProposals.includes(vote.proposalId)))
      const newProposals = votedProposals.filter((id) => !userVotes.some((vote) => vote.proposalId === id))
      for (const proposalId of newProposals) {
        try {
          const encryptedVote = await getMyVote(proposalId)
          if (fheStatus.initialized && fheUserDecrypt) {
            const decryptedVote = await fheUserDecrypt(encryptedVote)
            votes.push({ proposalId, vote: decryptedVote === 0 ? "yes" : "no", votedAt: new Date() })
          } else {
            votes.push({ proposalId, vote: "unknown", votedAt: new Date() })
          }
        } catch {
          votes.push({ proposalId, vote: "error", votedAt: new Date() })
        }
      }
    }
    setUserVotes(votes)
  }

  const handleCreateProposal = async () => {
    if (!newProposal.trim()) return
    try {
      setCreatingProposal(true)
      await createProposal(newProposal.trim())
      setNewProposal("")
      setActiveTab("vote")
      toast({ title: "Proposal Created", description: "Your proposal is on-chain." })
    } catch {
      toast({ title: "Error", description: "Failed to create proposal.", variant: "destructive" })
    } finally {
      setCreatingProposal(false)
    }
  }

  const handleVote = async (proposalId: number, voteValue: "yes" | "no") => {
    setVotingStates((prev) => ({ ...prev, [proposalId]: "Encrypting..." }))
    try {
      await vote(proposalId, voteValue === "yes")
      setUserVotes((prev) => [...prev.filter((v) => v.proposalId !== proposalId), { proposalId, vote: voteValue, votedAt: new Date() }])
      toast({ title: "Vote Submitted", description: `Your ${voteValue} vote is encrypted on-chain.` })
      await refreshProposals()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit vote.",
        variant: "destructive",
      })
    } finally {
      setVotingStates((prev) => ({ ...prev, [proposalId]: "" }))
    }
  }

  const handleMakePublic = async (proposalId: number) => {
    try {
      await makeVoteCountsPublic(proposalId)
      toast({ title: "Proposal Closed", description: "Results are published." })
    } catch {
      toast({ title: "Error", description: "Failed to publish and close.", variant: "destructive" })
    }
  }

  const hasUserVotedOnProposal = (proposalId: number) => userVotes.some((vote) => vote.proposalId === proposalId)
  const getUserVote = (proposalId: number) => userVotes.find((vote) => vote.proposalId === proposalId)
  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`

  const currentProposals = proposals.slice((currentPage - 1) * proposalsPerPage, currentPage * proposalsPerPage)
  const totalPages = Math.ceil(proposals.length / proposalsPerPage)
  const totalVotes = proposals.reduce((acc, p) => acc + p.yesCount + p.noCount, 0)

  const voteDisabled = (proposal: (typeof proposals)[0]) =>
    !!votingStates[proposal.id] ||
    isLoading ||
    fheStatus.loading ||
    !fheStatus.initialized ||
    hasUserVotedOnProposal(proposal.id) ||
    proposal.isPublic

  const cofheState = fheStatus.error ? "Error" : fheStatus.initialized ? "Ready" : "Initializing"

  return (
    <div className="relative flex min-h-[100dvh] bg-[#090b0a] text-[#e7ece8]">
      {/* desktop sidebar */}
      <aside className="relative z-20 hidden w-[250px] shrink-0 flex-col border-r border-white/[0.06] px-4 py-5 md:flex">
        <div className="mb-8 flex items-start justify-center gap-2.5 px-1">
          <Shield className="mt-0.5 h-5 w-5 text-[#b7d0b4]" />
          <div className="text-center">
            <div className="font-[family-name:var(--font-serif)] whitespace-nowrap text-[22px] leading-6 tracking-tight">Confidential Voting</div>
            <p className="mt-3 text-[11px] leading-4 text-zinc-500">Every vote sealed.<br />Only the tally revealed.</p>
          </div>
        </div>

        {isConnected && (
          <nav className="flex flex-col gap-1">
            {TABS.filter((t) => t.id !== "account").map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm ${
                  activeTab === id ? "bg-[#1c241e] text-[#d7e6d4]" : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        )}

        <div className="mt-auto space-y-3 px-1">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className={`h-1.5 w-1.5 rounded-full ${isCorrectNetwork ? "bg-[#8fbf88]" : "bg-red-500"}`} />
            {isCorrectNetwork ? "Sepolia" : "Wrong network"}
          </div>
          {isConnected && account && (
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>{formatAddress(account)}</span>
              <button onClick={refreshProposals} className="rounded p-1 hover:text-zinc-200" title="Refresh">
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col">
        <MountainBg />

        {/* mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-[#090b0a]/85 px-4 py-3 backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#b7d0b4]" />
            <span className="font-[family-name:var(--font-serif)] text-lg">Confidential Voting</span>
          </div>
          <WalletConnect />
        </header>

        {/* desktop top bar */}
        <header className="relative z-10 hidden items-center justify-end gap-6 border-b border-white/[0.06] px-8 py-4 md:flex">
          <p className="text-right text-[13px] leading-4 text-zinc-500">
            Private today<br />for a fairer tomorrow.
          </p>
          <WalletConnect />
        </header>

        {isConnected && !isCorrectNetwork && (
          <div className="relative z-10 flex items-center justify-between gap-3 border-b border-red-500/20 bg-red-950/40 px-4 py-2 text-sm md:px-8">
            <span>Sepolia only.</span>
            <button onClick={switchToSepolia} className="rounded-full bg-[#c5d9c2] px-3 py-1 text-xs text-[#121614]">
              Switch to Sepolia
            </button>
          </div>
        )}

        {fheStatus.loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090b0a]/80 backdrop-blur-sm">
            <div className="text-center">
              <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#b7d0b4]" />
              <p className="font-[family-name:var(--font-serif)] text-xl">Initializing CoFHE</p>
              <p className="mt-1 text-sm text-zinc-500">Loading confidential voting...</p>
            </div>
          </div>
        )}

        <main className="relative z-10 flex-1 px-4 py-6 md:px-8 md:py-8">
          {!isConnected ? (
            <div className="pt-10 md:pt-16">
              <h1 className="font-[family-name:var(--font-serif)] text-4xl leading-tight">Connect to vote privately</h1>
              <p className="mt-3 max-w-md text-zinc-500">Your Yes/No is encrypted with Fhenix CoFHE before it hits the chain.</p>
              <div className="mt-6">
                <Magnetic>
                  <WalletConnect />
                </Magnetic>
              </div>
            </div>
          ) : activeTab === "vote" ? (
            <>
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className={TITLE}>Active Proposals</h1>
                    <span className="rounded-md bg-[#1c241e] px-1.5 py-0.5 text-[11px] text-[#b7d0b4]">{proposals.length}</span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-500">Cast a private vote. Results are revealed after voting ends.</p>
                </div>
                <div className="hidden md:block">
                  <Magnetic>
                    <button onClick={() => setActiveTab("create")} className={PRIMARY_BTN}>
                      + New Proposal
                    </button>
                  </Magnetic>
                </div>
              </div>

              {isLoading && proposals.length === 0 ? (
                <p className="py-16 text-center text-zinc-500">
                  <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                  Loading proposals...
                </p>
              ) : proposals.length === 0 ? (
                <p className="py-16 text-zinc-500">No proposals yet. Tap + to create the first one.</p>
              ) : (
                <div className="space-y-4">
                  {currentProposals.map((proposal) => {
                    const total = proposal.yesCount + proposal.noCount
                    const yesPct = total > 0 ? Math.round((proposal.yesCount / total) * 100) : 0
                    const noPct = total > 0 ? Math.round((proposal.noCount / total) * 100) : 0
                    const userVote = getUserVote(proposal.id)
                    return (
                      <div key={proposal.id} className="rounded-2xl border border-white/[0.07] bg-[#090b0a]/60 px-4 py-4 backdrop-blur-sm md:px-5 md:py-5">
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="inline-block rounded-md bg-[#1c241e] px-1.5 py-0.5 text-[11px] text-[#b7d0b4]">#{proposal.id}</span>
                            <h2 className="mt-2 break-words font-[family-name:var(--font-serif)] text-xl leading-7 md:text-[22px]">{proposal.description}</h2>
                          </div>
                          <span
                            className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${
                              proposal.isPublic ? "bg-red-950/50 text-red-300" : "bg-[#1c241e] text-[#8fbf88]"
                            }`}
                          >
                            {proposal.isPublic ? <Lock className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-[#8fbf88]" />}
                            {proposal.isPublic ? "Closed" : "Open"}
                          </span>
                        </div>

                        <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr] lg:gap-6">
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleVote(proposal.id, "yes")}
                              disabled={voteDisabled(proposal)}
                              className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border text-sm transition-transform active:scale-[0.97] ${
                                userVote?.vote === "yes"
                                  ? "border-[#8fbf88]/40 bg-[#1c241e] text-[#c5d9c2]"
                                  : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-[#8fbf88]/30 disabled:opacity-40"
                              }`}
                            >
                              {votingStates[proposal.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              Yes
                            </button>
                            <button
                              onClick={() => handleVote(proposal.id, "no")}
                              disabled={voteDisabled(proposal)}
                              className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border text-sm transition-transform active:scale-[0.97] ${
                                userVote?.vote === "no"
                                  ? "border-red-400/30 bg-red-950/30 text-red-200"
                                  : "border-red-900/40 bg-red-950/20 text-red-200/80 hover:border-red-400/30 disabled:opacity-40"
                              }`}
                            >
                              {votingStates[proposal.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                              No
                            </button>
                          </div>

                          <div className="border-t border-white/[0.06] pt-4 lg:border-t-0 lg:pt-0">
                            <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
                              <span className="flex items-center gap-1.5">
                                <BarChart3 className="h-3.5 w-3.5" /> Results
                              </span>
                              <span>{proposal.isPublic ? `${total} vote${total === 1 ? "" : "s"}` : "Encrypted"}</span>
                            </div>
                            {proposal.isPublic ? (
                              <div className="space-y-2 text-xs">
                                <div className="flex items-center gap-3">
                                  <span className="w-7 text-zinc-400">Yes</span>
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                                    <div className="h-full rounded-full bg-[#8fbf88] transition-all duration-500" style={{ width: `${yesPct}%` }} />
                                  </div>
                                  <span className="w-10 text-right text-[#8fbf88]">{yesPct}%</span>
                                  <span className="w-4 text-right text-zinc-500">{proposal.yesCount}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="w-7 text-zinc-400">No</span>
                                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                                    <div className="h-full rounded-full bg-zinc-500 transition-all duration-500" style={{ width: `${noPct}%` }} />
                                  </div>
                                  <span className="w-10 text-right text-red-400">{noPct}%</span>
                                  <span className="w-4 text-right text-zinc-500">{proposal.noCount}</span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-zinc-600">Tallies stay encrypted until the owner closes voting.</p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <p className="text-xs text-zinc-500">
                            {userVote && userVote.vote !== "unknown" && userVote.vote !== "error" && (
                              <>
                                You voted <span className={userVote.vote === "yes" ? "text-[#8fbf88]" : "text-red-400"}>{userVote.vote}</span>
                              </>
                            )}
                          </p>
                          {proposalOwnership[proposal.id] && !proposal.isPublic && (
                            <button
                              onClick={() => handleMakePublic(proposal.id)}
                              disabled={isLoading}
                              className="rounded-lg border border-[#8fbf88]/30 px-3 py-1.5 text-xs text-[#c5d9c2] hover:bg-[#1c241e] disabled:opacity-40"
                            >
                              Publish &amp; close
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2 text-sm">
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)} className="px-3 py-1 text-zinc-500 disabled:opacity-30">
                    Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`h-8 w-8 rounded-lg ${currentPage === page ? "bg-[#1c241e] text-[#c5d9c2]" : "text-zinc-500"}`}
                    >
                      {page}
                    </button>
                  ))}
                  <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="px-3 py-1 text-zinc-500 disabled:opacity-30">
                    Next
                  </button>
                </div>
              )}
            </>
          ) : activeTab === "create" ? (
            <div className="max-w-xl">
              <h1 className={TITLE}>Create Proposal</h1>
              <p className="mt-2 text-sm text-zinc-500">Votes stay encrypted until you close the proposal.</p>
              <input
                value={newProposal}
                onChange={(e) => setNewProposal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !creatingProposal && handleCreateProposal()}
                placeholder="Should we adopt proposal … ?"
                disabled={creatingProposal}
                className="mt-8 w-full border-b border-white/10 bg-transparent py-3 text-lg outline-none placeholder:text-zinc-600 focus:border-[#8fbf88]"
              />
              <button onClick={handleCreateProposal} disabled={!newProposal.trim() || creatingProposal} className={`mt-6 w-full md:w-auto ${PRIMARY_BTN}`}>
                {creatingProposal ? "Creating..." : "Create Proposal"}
              </button>
            </div>
          ) : activeTab === "analytics" ? (
            <div>
              <h1 className={TITLE}>Analytics</h1>
              <div className="mt-8 grid grid-cols-3 gap-4 text-sm md:gap-8">
                {[
                  ["Proposals", proposals.length],
                  ["Public votes", totalVotes],
                  ["Your votes", userVotes.length],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-zinc-500">{label}</p>
                    <p className="mt-1 font-[family-name:var(--font-serif)] text-3xl">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-10">
                {proposals.map((proposal) => (
                  <div key={proposal.id} className="flex items-center justify-between gap-4 border-b border-white/[0.06] py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{proposal.description}</p>
                      <p className="mt-1 text-xs text-zinc-500">#{proposal.id} · {proposal.isPublic ? "Public" : "Private"}</p>
                    </div>
                    {proposal.isPublic && (
                      <p className="shrink-0 text-xs text-zinc-500">
                        Yes {proposal.yesCount} · No {proposal.noCount}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === "history" ? (
            <div>
              <h1 className={TITLE}>My Votes</h1>
              {userVotes.length === 0 ? (
                <p className="mt-8 text-zinc-500">No votes yet.</p>
              ) : (
                <div className="mt-8">
                  {[...userVotes]
                    .sort((a, b) => b.votedAt.getTime() - a.votedAt.getTime())
                    .map((vote) => {
                      const proposal = proposals.find((p) => p.id === vote.proposalId)
                      if (!proposal) return null
                      return (
                        <div key={`${vote.proposalId}-${vote.votedAt.getTime()}`} className="flex items-start justify-between gap-4 border-b border-white/[0.06] py-4">
                          <div className="min-w-0">
                            <p className="break-words">{proposal.description}</p>
                            <p className="mt-1 text-xs text-zinc-500">{formatDate(vote.votedAt)}</p>
                          </div>
                          <span className={`text-sm ${vote.vote === "yes" ? "text-[#8fbf88]" : "text-red-400"}`}>{vote.vote}</span>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          ) : (
            // account tab (mobile only entry point)
            <div className="max-w-md">
              <h1 className={TITLE}>Account</h1>
              <div className="mt-8 divide-y divide-white/[0.06] text-sm">
                {[
                  ["Wallet", account ? formatAddress(account) : "-"],
                  ["Network", isCorrectNetwork ? "Sepolia" : "Wrong network"],
                  ["CoFHE", cofheState],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between py-3">
                    <span className="text-zinc-500">{label}</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-col gap-3">
                {!isCorrectNetwork && (
                  <button onClick={switchToSepolia} className={PRIMARY_BTN}>
                    Switch to Sepolia
                  </button>
                )}
                <button
                  onClick={refreshProposals}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 active:scale-[0.98]"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh proposals
                </button>
                <button
                  onClick={disconnectWallet}
                  className="flex items-center justify-center gap-2 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-2.5 text-sm text-red-200 active:scale-[0.98]"
                >
                  <LogOut className="h-4 w-4" /> Disconnect
                </button>
              </div>
            </div>
          )}
        </main>

        <footer
          className={`relative z-10 space-y-1.5 border-t border-white/[0.06] px-4 pt-6 text-center text-xs text-zinc-500 md:pb-6 ${
            isConnected ? "pb-24" : "pb-6"
          }`}
        >
          <p>© 2026 Confidential Voting. All rights reserved.</p>
          <p>Powered by Fhenix CoFHE · Fully Homomorphic Encryption on Sepolia</p>
          <p>
            Built by Observer ·{" "}
            <a href="https://x.com/0bserver_here" target="_blank" rel="noreferrer" className="text-zinc-300 hover:text-[#c5d9c2]">
              @0bserver_here
            </a>
          </p>
        </footer>
      </div>

      {/* mobile fixed bottom bar */}
      {isConnected && <MobileNav active={activeTab} onChange={setActiveTab} />}
    </div>
  )
}
