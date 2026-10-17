# Confidential Voting: Frontend 🗳️

Next.js dApp for private yes/no voting on Ethereum Sepolia. Votes are encrypted in the browser with [Fhenix CoFHE](https://cofhe-docs.fhenix.zone/get-started/introduction/what-is-cofhe) before they reach the chain.

## 🚀 Run

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000 and connect a wallet on Sepolia.

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Lint |

## 📝 Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Deployed `ConfidentialVoting` address (see `../fhevm-hardhat`) |
| `NEXT_PUBLIC_NETWORK` | `sepolia` |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | Sepolia RPC endpoint |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Reown (WalletConnect) project ID |

## 📁 Where things live

| File | Role |
| --- | --- |
| `voting-app.tsx` | Main UI: desktop sidebar, mobile tab bar, proposal cards |
| `contexts/web3-context.tsx` | Wallet, contract calls: create, vote, publish & close |
| `contexts/appkit.tsx` | Reown AppKit (WalletConnect) setup |
| `lib/fheService.ts` | CoFHE encrypt, decrypt and permit (ACP) handling |
| `hooks/useFHE.ts` | CoFHE lifecycle hook |
| `lib/contracts.ts` | Contract address and ABI |
| `components/mobile-nav.tsx` | Fixed bottom tab bar on mobile |
| `components/wallet-connect.tsx` | Connect and account button |

## 🔐 How a vote moves

1. Click Yes or No, and `@cofhe/sdk` encrypts the choice (`0` = Yes, `1` = No) in the browser
2. The ciphertext handle and input proof go to `vote(...)`, never the plaintext
3. After a refresh, `decryptForView` unseals your own ballot, no transaction needed
4. The owner clicks **Publish & close**, and Teecryptor-signed totals are written on-chain

Open the browser console to watch the CoFHE steps (`🔐 Encrypting...`, `🛰️ Teecryptor...`, `✅ Decrypted`).

## ☁️ Vercel

- Set the Root Directory to `voting-app`
- Add the four `NEXT_PUBLIC_*` variables
- Keep Next.js on a patched version and commit `pnpm-lock.yaml` with any `package.json` change

Full docs, architecture and contract details are in the [root README](../README.md).
