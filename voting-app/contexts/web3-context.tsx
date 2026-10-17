"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { ethers } from "ethers"
import { useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitProvider, useDisconnect } from "@reown/appkit/react"
import { sepolia } from "@reown/appkit/networks"
import { VOTE_OPTIONS, handleFHEError } from "@/lib/fheService"
import { useFHE } from "@/hooks/useFHE"
import { CONFIDENTIAL_VOTING_ABI, CONFIDENTIAL_VOTING_ADDRESS } from "@/lib/contracts"

// Sepolia network configuration
const SEPOLIA_CHAIN_ID = 11155111
const SEPOLIA_NETWORK_NAME = "Sepolia"

interface Proposal {
  id: number
  description: string
  yesCount: number
  noCount: number
  isPublic: boolean
  createdAt: Date
  encryptedYesCount?: string
  encryptedNoCount?: string
  totalVotes?: number
}

interface Web3ContextType {
  // Wallet state
  account: string | null
  isConnected: boolean
  isConnecting: boolean
  chainId: number | null

  // Network state
  isCorrectNetwork: boolean
  networkName: string | null

  // Contract state
  contract: ethers.Contract | null
  proposals: Proposal[]
  isLoading: boolean

  // FHE state
  fheStatus: {
    initialized: boolean
    loading: boolean
    error: string | null
    sdkAvailable: boolean
  }

  // Functions
  connectWallet: () => Promise<void>
  disconnectWallet: () => void
  switchToSepolia: () => Promise<void>
  createProposal: (description: string) => Promise<void>
  vote: (proposalId: number, voteValue: boolean) => Promise<void>
  makeVoteCountsPublic: (proposalId: number) => Promise<void>
  hasUserVoted: (proposalId: number) => Promise<boolean>
  getMyVote: (proposalId: number) => Promise<string>
  getPublicVoteCounts: (proposalId: number) => Promise<{yesCount: number, noCount: number, isPublic: boolean}>
  decryptVoteCounts: (proposalId: number) => Promise<{yesCount: number, noCount: number}>
  refreshProposals: () => Promise<void>
  isProposalOwner: (proposalId: number) => Promise<boolean>
  fheDecrypt?: (encryptedValue: any) => Promise<number>
  fheUserDecrypt?: (encryptedValue: any) => Promise<number>
  decryptForTx?: (encryptedValue: any) => Promise<{ ctHash: string; decryptedValue: bigint; signature: string }>
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined)

export function Web3Provider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [chainId, setChainId] = useState<number | null>(null)
  const [contract, setContract] = useState<ethers.Contract | null>(null)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { open } = useAppKit()
  const { address, isConnected: kitConnected, status } = useAppKitAccount()
  const { walletProvider } = useAppKitProvider<ethers.Eip1193Provider>("eip155")
  const { disconnect } = useDisconnect()
  const { chainId: kitChainId, switchNetwork } = useAppKitNetwork()
  const isConnecting = status === "connecting" || status === "reconnecting"

  const isCorrectNetwork = chainId === SEPOLIA_CHAIN_ID
  const networkName = chainId ? (chainId === SEPOLIA_CHAIN_ID ? SEPOLIA_NETWORK_NAME : `Chain ID ${chainId}`) : null

  const fheConfig = useMemo(
    () =>
      isConnected && account && walletProvider
        ? { account, chainId: chainId || undefined, provider: walletProvider }
        : undefined,
    [isConnected, account, chainId, walletProvider]
  )

  const {
    isInitialized: fheInitialized,
    isLoading: fheLoading,
    error: fheError,
    encrypt: fheEncrypt,
    decrypt: fheDecrypt,
    userDecrypt: fheUserDecrypt,
    decryptForTx,
    isSDKAvailable,
  } = useFHE(fheConfig)

  useEffect(() => {
    const bindWallet = async () => {
      if (!kitConnected || !address || !walletProvider) {
        setAccount(null)
        setIsConnected(false)
        setChainId(null)
        setContract(null)
        setProposals([])
        return
      }
      try {
        const provider = new ethers.BrowserProvider(walletProvider)
        const signer = await provider.getSigner()
        const network = await provider.getNetwork()
        const currentChainId = Number(kitChainId || network.chainId)
        const contractCode = await provider.getCode(CONFIDENTIAL_VOTING_ADDRESS)
        if (contractCode === "0x") {
          console.error("Contract not found at address:", CONFIDENTIAL_VOTING_ADDRESS)
          alert("Contract not found at this address. Please check deployment.")
          return
        }
        const contractInstance = new ethers.Contract(
          CONFIDENTIAL_VOTING_ADDRESS,
          CONFIDENTIAL_VOTING_ABI,
          signer
        )
        setAccount(address)
        setChainId(currentChainId)
        setContract(contractInstance)
        setIsConnected(true)
      } catch (error) {
        console.error("Error binding wallet:", error)
      }
    }
    bindWallet()
  }, [kitConnected, address, walletProvider, kitChainId])

  useEffect(() => {
    if (fheInitialized && isConnected && contract && proposals.length === 0) {
      loadProposals()
    }
  }, [fheInitialized, isConnected, contract])

  const connectWallet = async () => {
    await open()
  }

  const disconnectWallet = async () => {
    await disconnect()
    setAccount(null)
    setIsConnected(false)
    setChainId(null)
    setContract(null)
    setProposals([])
  }

  const loadProposals = async (contractInstance?: ethers.Contract) => {
    const contractToUse = contractInstance || contract
    if (!contractToUse) return

    try {
      setIsLoading(true)

      // Get proposal count
      const count = await contractToUse.proposalCount()
      const proposalCount = Number(count)

      const loadedProposals: Proposal[] = []

      // Load each proposal
      for (let i = 0; i < proposalCount; i++) {
        try {
          const proposal = await contractToUse.proposals(i)
          const [yesCount, noCount, isPublic, isRevealed] = await contractToUse.getPublicVoteCounts(i)

          let actualYesCount = Number(yesCount)
          let actualNoCount = Number(noCount)
          let totalVotes = actualYesCount + actualNoCount
          let encryptedYesCount, encryptedNoCount

          if (isPublic && isRevealed) {
            totalVotes = actualYesCount + actualNoCount
          } else if (isPublic && fheInitialized) {
            try {
              const decrypted = await decryptVoteCounts(i)
              actualYesCount = decrypted.yesCount
              actualNoCount = decrypted.noCount
              totalVotes = actualYesCount + actualNoCount
            } catch {
              try {
                const [encYes, encNo] = await contractToUse.getEncryptedVoteCount(i)
                encryptedYesCount = encYes
                encryptedNoCount = encNo
              } catch {}
              actualYesCount = 0
              actualNoCount = 0
              totalVotes = 0
            }
          } else {
            try {
              const [encYes, encNo] = await contractToUse.getEncryptedVoteCount(i)
              encryptedYesCount = encYes
              encryptedNoCount = encNo
            } catch {}
          }
      
          loadedProposals.push({
            id: i,
            description: proposal.description,
            yesCount: actualYesCount,
            noCount: actualNoCount,
            isPublic,
            createdAt: new Date(),
            encryptedYesCount,
            encryptedNoCount,
            totalVotes,
          })
        } catch (error) {
          console.error(`Error loading proposal ${i}:`, error)
        }
      }
      

      setProposals(loadedProposals.reverse()) // Show newest first
    } catch (error) {
      console.error("Error loading proposals:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const createProposal = async (description: string) => {
    if (!contract || !account) {
      throw new Error("Wallet not connected")
    }

    try {
      setIsLoading(true)
      // creating proposal
      console.log("Creating proposal...")
      const tx = await contract.createProposal(description)
      await tx.wait()
      console.log("Proposal created")
      await loadProposals()
    } catch (error) {
      console.error("Error creating proposal:", error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const validateNetwork = () => {
    if (!isCorrectNetwork) {
      alert(`This app only supports ${SEPOLIA_NETWORK_NAME} network. Please switch to ${SEPOLIA_NETWORK_NAME} in your wallet.`)
      return false
    }
    return true
  }

  const vote = async (proposalId: number, voteValue: boolean) => {
    if (!contract || !account) {
      throw new Error("Wallet not connected")
    }

    if (!fheInitialized) {
      throw new Error("FHE service not initialized. Please wait for initialization to complete.")
    }

    // Validate network before voting
    if (!validateNetwork()) {
      return
    }

    try {
      setIsLoading(true)

      // Check if proposal is public - if so, voting is closed
      const [, , isPublic] = await contract.getPublicVoteCounts(proposalId)
      if (isPublic) {
        throw new Error("Voting is closed for this proposal. Results have been made public.")
      }

      const numericVote = voteValue ? VOTE_OPTIONS.YES : VOTE_OPTIONS.NO
      if (numericVote !== 0 && numericVote !== 1) {
        throw new Error(`Invalid vote value: ${numericVote}. Must be 0 (Yes) or 1 (No)`)
      }
      if (!fheEncrypt) {
        throw new Error("FHE encrypt function not available")
      }
      const encryptedVote = await fheEncrypt(numericVote)
      const tx = await contract.vote(proposalId, encryptedVote.encryptedValue, encryptedVote.proof)
      await tx.wait()

      // Refresh proposals
      await loadProposals()
    } catch (error: any) {
      console.error("Error voting:", error)
      
      // Handle specific contract errors
      if (error?.message?.includes('Already voted')) {
        throw new Error('You have already voted on this proposal. Each user can only vote once.')
      }
      
      if (error?.message?.includes('Invalid proposal')) {
        throw new Error('Invalid proposal ID. Please refresh and try again.')
      }
      
      if (error?.message?.includes('Voting is closed')) {
        throw new Error('Voting is closed for this proposal. Results have been made public.')
      }
      
      const errorMessage = handleFHEError(error)
      throw new Error(`Voting failed: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const makeVoteCountsPublic = async (proposalId: number) => {
    if (!contract || !account) {
      throw new Error("Wallet not connected")
    }

    try {
      setIsLoading(true)
      const [, , isPublic] = await contract.getPublicVoteCounts(proposalId)
      if (isPublic) {
        throw new Error("Vote counts are already public")
      }

      const tx = await contract.makeVoteCountsPublic(proposalId)
      await tx.wait()

      if (fheInitialized && decryptForTx) {
        const [encryptedYes, encryptedNo] = await contract.getEncryptedVoteCount(proposalId)
        const yesResult = await decryptForTx(encryptedYes)
        const noResult = await decryptForTx(encryptedNo)
        const revealTx = await contract.revealVoteCounts(
          proposalId,
          yesResult.decryptedValue,
          yesResult.signature,
          noResult.decryptedValue,
          noResult.signature
        )
        await revealTx.wait()
      }

      await loadProposals()
    } catch (error: any) {
      console.error("Error making vote counts public:", error)
      
      // Handle specific contract errors
      if (error?.message?.includes('Vote counts already public')) {
        throw new Error('Vote counts are already public for this proposal.')
      }
      
      if (error?.message?.includes('Invalid proposal')) {
        throw new Error('Invalid proposal ID. Please refresh and try again.')
      }
      
      if (error?.message?.includes('Custom error:')) {
        throw error // Re-throw custom error messages
      }
      
      throw new Error(`Failed to make vote counts public: ${error?.message || 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const hasUserVoted = async (proposalId: number): Promise<boolean> => {
    if (!contract || !account) {
      return false
    }

    try {
      return await contract.hasUserVoted(proposalId, account)
    } catch (error: any) {
      console.error("Error checking if user voted:", error)
      // Return false on error to allow user to try voting
      return false
    }
  }

  const getMyVote = async (proposalId: number): Promise<string> => {
    if (!contract || !account) {
      throw new Error("Wallet not connected")
    }

    try {
      const encryptedVote = await contract.getMyVote(proposalId)
      // ciphertext of caller's ballot
      console.log("Encrypted vote:")
      console.log(encryptedVote)
      return encryptedVote
    } catch (error: any) {
      console.error("Error getting my vote:", error)
      
      // Handle custom errors
      if (error?.data) {
        const errorData = error.data
        
        // Check for custom error signatures
        if (errorData.includes('0x4e487b71')) {
          throw new Error('Invalid proposal ID')
        }
        
        if (errorData.includes('0x4e487b72')) {
          throw new Error('You have not voted on this proposal yet')
        }
        
        if (errorData.includes('0xd0d25976')) {
          throw new Error('FHE permission denied - you may not have voted or FHE is not properly initialized')
        }
      }
      
      throw new Error(`Failed to get my vote: ${error?.message || 'Unknown error'}`)
    }
  }

  const getPublicVoteCounts = async (proposalId: number): Promise<{yesCount: number, noCount: number, isPublic: boolean}> => {
    if (!contract) {
      throw new Error("Contract not connected")
    }

    try {
      const [yesCount, noCount, isPublic] = await contract.getPublicVoteCounts(proposalId)
      return {
        yesCount: Number(yesCount),
        noCount: Number(noCount),
        isPublic: Boolean(isPublic)
      }
    } catch (error) {
      console.error("Error getting public vote counts:", error)
      return { yesCount: 0, noCount: 0, isPublic: false }
    }
  }

  const isProposalOwner = async (proposalId: number): Promise<boolean> => {
    if (!contract || !account) return false;
    try {
      const result = await contract.isProposalOwner(proposalId, account);
      return result;
    } catch (error: any) {
      console.error("Error checking proposal ownership:", error);
      return false;
    }
  };

  const decryptVoteCounts = async (proposalId: number): Promise<{yesCount: number, noCount: number}> => {
    if (!contract) {
      throw new Error("Contract not connected")
    }

    const [yesCount, noCount, isPublic, isRevealed] = await contract.getPublicVoteCounts(proposalId)
    if (isRevealed) {
      return { yesCount: Number(yesCount), noCount: Number(noCount) }
    }
    if (!isPublic) {
      throw new Error("Vote counts are not public")
    }
    if (!fheInitialized || !decryptForTx) {
      throw new Error("CoFHE is not initialized")
    }

    const [encryptedYes, encryptedNo] = await contract.getEncryptedVoteCount(proposalId)
    const decryptedYes = await decryptForTx(encryptedYes)
    const decryptedNo = await decryptForTx(encryptedNo)
    return {
      yesCount: Number(decryptedYes.decryptedValue),
      noCount: Number(decryptedNo.decryptedValue),
    }
  }

  const refreshProposals = async () => {
    await loadProposals()
  }

  const switchToSepolia = async () => {
    await switchNetwork(sepolia)
  }

  const value: Web3ContextType = {
    account,
    isConnected,
    isConnecting,
    chainId,
    isCorrectNetwork,
    networkName,
    contract,
    proposals,
    isLoading,
    fheStatus: {
      initialized: fheInitialized,
      loading: fheLoading,
      error: fheError,
      sdkAvailable: isSDKAvailable && fheInitialized && !fheError
    },
    connectWallet,
    disconnectWallet,
    switchToSepolia,
    createProposal,
    vote,
    makeVoteCountsPublic,
    hasUserVoted,
    getMyVote,
    getPublicVoteCounts,
    decryptVoteCounts,
    refreshProposals,
    isProposalOwner,
    fheDecrypt,
    fheUserDecrypt,
    decryptForTx,
  }

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>
}

export function useWeb3() {
  const context = useContext(Web3Context)
  if (context === undefined) {
    throw new Error("useWeb3 must be used within a Web3Provider")
  }
  return context
}
