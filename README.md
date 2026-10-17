# Confidential Voting

Private yes/no voting on Ethereum Sepolia, built on [Fhenix CoFHE](https://cofhe-docs.fhenix.zone/cofhe/get-started/introduction/fhenix) (Fully Homomorphic Encryption).

Votes are encrypted in the browser before they reach the chain. The contract adds them up while they are still encrypted, so only the final tally is ever revealed, and only after the proposal owner closes voting.

## Repository

| Folder | What it is |
| --- | --- |
| `fhevm-hardhat` | `ConfidentialVoting` Solidity contract, tests and deploy script |
| `voting-app` | Next.js frontend with WalletConnect and the CoFHE SDK |

## How it works

1. **Create:** `createProposal` sets up encrypted yes and no counters.
2. **Vote:** the browser encrypts `0` (yes) or `1` (no) with `@cofhe/sdk`, and `vote` stores the ciphertext. Whether an address has voted is public, but what it voted is not.
3. **Read your own vote:** `getMyVote` returns your encrypted ballot, and `decryptForView` unseals it with your local permit. No transaction is needed.
4. **Close:** the owner runs `makeVoteCountsPublic` (`FHE.allowPublic`), then `revealVoteCounts` publishes the Teecryptor-signed totals onchain. In the UI this is **Publish & close**.

## Quick start

### 1. Contract

```bash
cd fhevm-hardhat
npm install
cp .env.example .env   # set PRIVATE_KEY and optionally SEPOLIA_RPC_URL
npm run compile
npm test
npm run deploy:sepolia
```

Copy the deployed address for the next step.

### 2. Frontend

```bash
cd voting-app
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000.

## Environment

`fhevm-hardhat/.env`

| Variable | Purpose |
| --- | --- |
| `PRIVATE_KEY` | Deployer wallet (use a test key) |
| `SEPOLIA_RPC_URL` | Sepolia RPC endpoint |

`voting-app/.env`

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Deployed `ConfidentialVoting` address |
| `NEXT_PUBLIC_NETWORK` | `sepolia` |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | Sepolia RPC endpoint |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Reown (WalletConnect) project ID |

## Stack

- Solidity with `@fhenixprotocol/cofhe-contracts`
- `@cofhe/sdk` for encrypt and decrypt
- Next.js 15, React 19, Tailwind, shadcn/ui
- ethers v6 and Reown AppKit (WalletConnect)

## Credits

Built by Observer, [@0bserver_here](https://x.com/0bserver_here).
