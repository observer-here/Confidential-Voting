# Confidential Voting 🗳️🔐

A decentralized private voting dApp built on Ethereum using Fully Homomorphic Encryption (FHE) powered by [Fhenix CoFHE](https://cofhe-docs.fhenix.zone/get-started/introduction/what-is-cofhe). This platform lets people vote Yes or No on proposals while every ballot stays encrypted on-chain. Only the final tally is revealed, and only after the proposal owner closes voting.

## 🌟 Features

### For Voters
- **Encrypted Ballots**: Your Yes/No is encrypted in your browser before it reaches the blockchain
- **Private Voting**: Nobody, including the contract, explorers and the proposal owner, can read your vote
- **Self-Decryption**: Re-read your own vote after a refresh with `decryptForView`, no transaction needed
- **One Vote Per Address**: Double voting is blocked on-chain
- **My Votes**: Track every proposal you voted on in one place

### For Proposal Owners
- **Create Proposals**: Open a new yes/no proposal with encrypted counters starting at zero
- **Encrypted Tallies**: Yes/No totals are updated with FHE math and never decrypted mid-vote
- **Publish & Close**: One action closes voting and publishes Teecryptor-signed totals on-chain
- **Owner-Only Control**: Only the proposal creator can close and reveal

### Security & Privacy
- 🔒 **End-to-End Encryption**: Votes are encrypted client-side with `@cofhe/sdk`
- 🔐 **On-Chain Privacy**: The chain stores ciphertext handles (`euint8`), never plaintext votes
- 🛡️ **No Data Leaks**: Running tallies stay encrypted until the owner publishes
- ✅ **Verifiable Reveal**: Final totals are checked on-chain with `FHE.publishDecryptResult` against Teecryptor signatures

### Experience
- 📱 **Responsive UI**: Desktop sidebar plus a fixed mobile bottom tab bar
- 👛 **WalletConnect**: Connect any wallet through Reown AppKit
- 🧾 **Console Monitoring**: Live emoji logs for CoFHE init, encrypt steps and decrypt polling

## 🏗️ Architecture

```
Confidential Voting/
├── fhevm-hardhat/        # Smart contract & deployment
│   ├── contracts/        # Solidity contract (ConfidentialVoting.sol)
│   ├── deploy/           # Deployment script
│   ├── test/             # Contract tests
│   └── scripts/          # Helper scripts
│
└── voting-app/           # Next.js frontend
    ├── app/              # App Router (layout, page, global styles)
    ├── components/       # UI: wallet button, mobile nav, magnetic hover, shadcn/ui
    ├── contexts/         # AppKit (WalletConnect) + Web3 context
    ├── hooks/            # useFHE and UI hooks
    └── lib/              # CoFHE service, contract address + ABI
```

### How the pieces talk

```
Browser + wallet            ConfidentialVoting.sol          Fhenix CoFHE
(@cofhe/sdk)                (Ethereum Sepolia)              (off-chain)
─────────────────           ────────────────────            ───────────────────
encrypt Yes/No              stores ciphertext handles       coprocessor:
  → ciphertext + proof      ACL: who may decrypt              FHE add / eq / select
decryptForView              FHE.allowThis / allowSender     Teecryptor:
  (own ballot, no tx)       FHE.allowPublic                   TEE decrypt, seal or sign
decryptForTx                FHE.publishDecryptResult
  (signed tally for tx)
```

- 🧠 **`@cofhe/sdk`** runs in the browser: encrypts inputs, manages permits, requests decrypts
- 📜 **`FHE.sol`** (`@fhenixprotocol/cofhe-contracts`) is the Solidity API for encrypted handles
- 🛰️ **Coprocessor** runs FHE operations on ciphertexts off-chain and returns new handles
- 🔐 **Teecryptor** checks the on-chain ACL, decrypts inside a TEE, then seals to the caller (`decryptForView`) or signs the plaintext (`decryptForTx`)

## 🚀 Quick Start

### Prerequisites
- Node.js >= 20
- npm >= 7.0.0 (backend) and npm or pnpm (frontend)
- A wallet with Sepolia ETH for gas
- An Ethereum Sepolia RPC URL (the public node in `.env.example` works)
- MetaMask or any WalletConnect-compatible wallet
- A free [Reown](https://cloud.reown.com/) project ID for WalletConnect

### Installation & Deployment

#### 1. Backend Setup

```bash
# Navigate to the contract project
cd fhevm-hardhat

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Add your PRIVATE_KEY and SEPOLIA_RPC_URL

# Compile contracts
npm run compile

# Run tests on the local CoFHE mock
npm test

# Deploy to Sepolia
npm run deploy:sepolia
```

Copy the deployed contract address. You need it for the frontend.

#### 2. Frontend Setup

```bash
# Navigate to the frontend
cd voting-app

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Add NEXT_PUBLIC_CONTRACT_ADDRESS and NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

# Run the development server
npm run dev
```

Open http://localhost:3000 and connect a wallet on Sepolia.

### 📋 Complete Setup Sequence

```bash
# 1. Backend
cd fhevm-hardhat
npm install
cp .env.example .env        # set PRIVATE_KEY and SEPOLIA_RPC_URL
npm run compile
npm run deploy:sepolia

# 2. Copy the contract address from the deployment output

# 3. Frontend
cd ../voting-app
npm install
cp .env.example .env        # set NEXT_PUBLIC_CONTRACT_ADDRESS
npm run dev
```

## 🛠️ Technology Stack

### Backend
- **Hardhat**: Ethereum development environment
- **Solidity 0.8.28** (`evmVersion: cancun`): Smart contract language
- **Fhenix CoFHE**: `@fhenixprotocol/cofhe-contracts` (`FHE.sol`) and `@cofhe/hardhat-plugin` for local mocks
- **TypeScript**: Type-safe tests and deploy scripts
- **Ethers.js v6**: Ethereum library
- **TypeChain**: Typed contract bindings

### Frontend
- **Next.js 15 (App Router)** and **React 19**: UI framework
- **TypeScript**: Type-safe development
- **Tailwind CSS 3** and **shadcn/ui**: Styling and components
- **`@cofhe/sdk` 0.8**: Client-side encryption, permits and decryption
- **Reown AppKit** with the Ethers adapter: WalletConnect wallet connection
- **Ethers.js v6** and **viem**: Contract calls and SDK adapters
- **lucide-react**: Icons

## 🔐 How It Works

### Encryption Flow

1. **Create Proposal**: `createProposal` stores the description and sets both counters to `FHE.asEuint8(0)`
2. **Encrypt Vote**: The browser encrypts `0` (Yes) or `1` (No) with `@cofhe/sdk`
3. **On-Chain Storage**: The contract stores the ciphertext handle as `euint8` and sets the public `hasVoted` flag
4. **Encrypted Tally**: The contract adds to the Yes or No counter using `FHE.eq`, `FHE.select` and `FHE.add` on ciphertexts
5. **Self-Decrypt**: The voter calls `getMyVote` and decrypts their own ballot with `decryptForView`
6. **Publish & Close**: The owner calls `makeVoteCountsPublic`, then the dApp decrypts the totals and calls `revealVoteCounts`

### Step 1: Encrypting a vote in the browser

Implemented in `voting-app/lib/fheService.ts` → `encrypt()`.

1. 🚀 **Initialize**: the SDK loads on dApp open (`createCofheClient` on `chains.sepolia`)
2. 🔗 **Connect**: `client.connect(publicClient, walletClient)` once a wallet is connected
3. 🪪 **ACP (Access Control Permission)**: `client.acp.getOrCreateSelfACP()` creates or loads an EIP-712 permit plus a sealing keypair, kept in `localStorage` under `cofhesdk-acps`
4. 🔒 **Encrypt**: `encryptInputs([Encryptable.uint8(0 or 1)])` bound to the voting contract with `setConsumingContract(address)`

| Step | What happens |
| --- | --- |
| 🔧 Init TFHE | Load the TFHE wasm runtime in the browser |
| 🔑 Fetch keys | Pull the Fhenix FHE public keys for Sepolia |
| 📦 Pack | Encrypt the uint8 vote under those keys |
| 🧮 Prove | Build a ZK proof that the ciphertext is well-formed |
| 🛰️ Verify | The CoFHE coprocessor verifies the ciphertext and proof |

5. 📤 **Submit**: the dApp sends only two values to `vote(...)`:
   - `encryptedValue`: the ciphertext handle (`externalEuint8`)
   - `proof`: the input proof for the coprocessor

Plaintext Yes/No never appears in the transaction calldata.

### Step 2: What the contract does

`ConfidentialVoting.vote(proposalId, encryptedVote, inputProof)`:

1. ⛔ Rejects invalid proposals, double votes and votes after close
2. 🛰️ `FHE.asEuint8(encryptedVote, inputProof)` accepts the ciphertext once the proof checks out
3. 🔒 Stores `encryptedVotes[proposalId][msg.sender]`
4. 👁️ Sets `hasVoted[proposalId][msg.sender] = true` (that an address voted is public, what it voted is not)
5. 🪪 Grants decrypt rights:
   - `FHE.allowThis(v)`: the contract can keep using the ciphertext for tally updates
   - `FHE.allowSender(v)`: the voter can later decrypt their own ballot
6. ➕ Updates the counters without ever decrypting:

```solidity
p.yesCount = FHE.add(p.yesCount, FHE.select(FHE.eq(v, yes), one, zero));
p.noCount  = FHE.add(p.noCount,  FHE.select(FHE.eq(v, no),  one, zero));
```

If the vote equals Yes, an encrypted `1` is added to `yesCount`, otherwise an encrypted `0`. The same applies to No. No node, explorer or the contract itself can read the numbers.

### Step 3: Reading your own vote after a refresh

Your Yes/No is not stored in plaintext anywhere. After a refresh:

1. 👁️ `hasUserVoted(proposalId, account)` returns a public boolean
2. 🔒 `getMyVote(proposalId)` returns your encrypted handle
3. 📬 The client calls `decryptForView(handle, FheTypes.Uint8)`, no transaction

Teecryptor then:

1. ✅ Checks the on-chain ACL (`FHE.allowSender` for your address)
2. 🧾 Checks the ciphertext commitment
3. 🛰️ Decrypts inside the TEE and seals the result to your ACP public key
4. 🔑 Your browser unseals it with the local ACP private key

Any other wallet fails the ACL check and cannot decrypt your handle.

### Step 4: Publish & Close (decrypting the tally)

Only the proposal owner can do this. The UI button is **Publish & close**.

**4a. `makeVoteCountsPublic`**
- Requires `msg.sender` to be the proposal owner
- `FHE.allowPublic` on `yesCount` and `noCount`
- Sets `isPublic = true`, which closes voting. Individual ballots stay private, only the two totals become decryptable

**4b. `decryptForTx` then `revealVoteCounts`**

```ts
client.decryptForTx(handle).withoutACP()   // returns { decryptedValue, signature }
```

Teecryptor checks the public ACL, fetches the ciphertext, verifies the commitment, decrypts in the TEE and signs the result. Then:

```ts
contract.revealVoteCounts(proposalId, yes, yesSig, no, noSig)
```

On-chain `FHE.publishDecryptResult` verifies each signature against the handle. If valid, the contract stores `publicYesCount`, `publicNoCount` and sets `isRevealed = true`.

### Data Visibility

| Data | Visibility |
| --- | --- |
| Proposal description, id, owner | 🟢 Public |
| Whether an address has voted | 🟢 Public (`hasVoted`) |
| Individual Yes/No ballot | 🔒 Encrypted, only the voter can decrypt |
| Running Yes/No totals | 🔒 Encrypted until Publish & close |
| Final Yes/No totals | 🟢 Public after `revealVoteCounts` |

### FHE Types Used
- `euint8`: Encrypted 8-bit integers (the vote and the Yes/No counters)
- `externalEuint8`: Encrypted input handle accepted by `vote`
- Vote encoding: `0` = Yes ✅, `1` = No ❌

### Contract Functions

| Function | Who | Purpose |
| --- | --- | --- |
| `createProposal(description)` | Anyone | Create a proposal with zeroed encrypted counters |
| `vote(id, encryptedVote, inputProof)` | Anyone, once per proposal | Store the encrypted ballot and update the tallies |
| `getMyVote(id)` | Voter | Return your encrypted ballot handle |
| `getEncryptedVoteCount(id)` | Anyone | Return the encrypted Yes/No handles |
| `hasUserVoted(id, voter)` | Anyone | Whether an address has voted |
| `isProposalOwner(id, user)` | Anyone | Ownership check |
| `makeVoteCountsPublic(id)` | Owner | Allow public decryption and close voting |
| `revealVoteCounts(id, yes, yesSig, no, noSig)` | Anyone with valid signatures | Publish verified plaintext totals |
| `getPublicVoteCounts(id)` | Anyone | Read revealed totals and status flags |
| `proposalCount()` | Anyone | Number of proposals |

## 📁 Project Structure

```
Confidential Voting/
├── README.md                              # This file
│
├── fhevm-hardhat/                         # Smart contract project
│   ├── contracts/
│   │   └── ConfidentialVoting.sol         # Encrypted voting contract
│   ├── deploy/
│   │   └── deploy-confidential-vote.ts    # Deployment script
│   ├── test/
│   │   └── ConfidentialVoting.test.ts     # Contract tests (CoFHE mock)
│   ├── scripts/
│   │   └── test-private-key.ts            # Check deployer key and balance
│   ├── hardhat.config.ts                  # Networks, Solidity 0.8.28, CoFHE plugin
│   ├── tsconfig.json                      # TypeScript config
│   ├── package.json                       # Scripts: compile, test, deploy:*
│   ├── package-lock.json
│   ├── .env.example                       # PRIVATE_KEY, SEPOLIA_RPC_URL
│   ├── .gitignore
│   ├── LICENSE
│   └── README.md                          # Contract-only notes
│
└── voting-app/                            # Next.js frontend
    ├── app/
    │   ├── layout.tsx                     # Fonts, viewport, providers
    │   ├── page.tsx                       # Renders the voting UI
    │   └── globals.css                    # Dark mint theme + grid background
    ├── components/
    │   ├── wallet-connect.tsx             # Connect / account pill
    │   ├── mobile-nav.tsx                 # Fixed mobile bottom tab bar
    │   ├── magnetic.tsx                   # Magnetic hover wrapper
    │   ├── theme-provider.tsx
    │   └── ui/                            # shadcn/ui primitives
    │       ├── button.tsx, input.tsx, card.tsx, badge.tsx, label.tsx
    │       ├── dialog.tsx, drawer.tsx, sheet.tsx, popover.tsx, tooltip.tsx
    │       ├── select.tsx, tabs.tsx, table.tsx, progress.tsx, skeleton.tsx
    │       ├── toast.tsx, toaster.tsx, sonner.tsx
    │       └── ... (accordion, calendar, chart, form, sidebar and more)
    ├── contexts/
    │   ├── appkit.tsx                     # Reown AppKit (WalletConnect) setup
    │   └── web3-context.tsx               # Wallet, contract, vote / reveal actions
    ├── hooks/
    │   ├── useFHE.ts                      # CoFHE lifecycle hook
    │   ├── use-toast.ts
    │   └── use-mobile.tsx
    ├── lib/
    │   ├── fheService.ts                  # CoFHE encrypt / decrypt service
    │   ├── contracts.ts                   # Contract address + ABI export
    │   ├── ConfidentialVotingABI.json     # Contract ABI
    │   └── utils.ts                       # cn() class helper
    ├── public/                            # Static assets (placeholders)
    ├── styles/
    │   └── globals.css
    ├── voting-app.tsx                     # Main voting UI (desktop + mobile)
    ├── next.config.mjs                    # Webpack, wasm, transpile packages
    ├── tailwind.config.ts                 # Tailwind theme
    ├── postcss.config.mjs
    ├── components.json                    # shadcn/ui config
    ├── tsconfig.json                      # Path alias @/*
    ├── vercel.json                        # Vercel build settings
    ├── package.json                       # Scripts: dev, build, start, lint
    ├── pnpm-lock.yaml                     # Lockfile used by Vercel
    ├── .env.example                       # NEXT_PUBLIC_* variables
    └── .gitignore
```

### Where to look

| Concern | File |
| --- | --- |
| Encrypt, decrypt, ACP, console logs | `voting-app/lib/fheService.ts` |
| Vote, create, publish & close flows | `voting-app/contexts/web3-context.tsx` |
| WalletConnect setup | `voting-app/contexts/appkit.tsx` |
| Voting UI (desktop and mobile) | `voting-app/voting-app.tsx` |
| Solidity and FHE operations | `fhevm-hardhat/contracts/ConfidentialVoting.sol` |

## 🧪 Testing

### Backend Tests

```bash
cd fhevm-hardhat
npm test                    # Run tests on the local CoFHE mock
npm run test:private-key    # Verify your deployer key and balance
```

The suite covers:
- Starts with zero proposals
- Creates proposals and emits `ProposalCreated`
- Casts encrypted votes and lets the voter decrypt their own vote
- Rejects a second vote from the same address
- Reveals encrypted tallies after the owner makes them public
- Only lets the owner make results public
- Reverts for an invalid proposal id

### Frontend Development

```bash
cd voting-app
npm run dev                 # Development server
npm run lint                # Lint
npm run build               # Production build
npm run start               # Serve the production build
```

## 🌐 Network Configuration

- **Development**: Hardhat local network (chainId: 31337)
- **Testnet**: Ethereum Sepolia (chainId: 11155111)

CoFHE is also live on Arbitrum Sepolia and Base Sepolia, but this app is configured for Ethereum Sepolia only. Make sure your wallet is connected to Sepolia when using the dApp.

## 📝 Environment Variables

### Backend (`.env` in `fhevm-hardhat/`)

```env
PRIVATE_KEY=your_private_key
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

### Frontend (`.env` in `voting-app/`)

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0xYourDeployedContractAddress
NEXT_PUBLIC_NETWORK=sepolia
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_reown_project_id
```

⚠️ Never commit a funded private key. Use a throwaway test wallet for `PRIVATE_KEY`.

## ☁️ Deploying the Frontend (Vercel)

1. Import the repo in Vercel and set the **Root Directory** to `voting-app`
2. Add the four `NEXT_PUBLIC_*` variables above in Project Settings
3. Keep Next.js on a patched version. Vercel blocks new deployments of vulnerable Next.js releases
4. Commit `pnpm-lock.yaml` together with `package.json` changes, because Vercel installs with a frozen lockfile

## 🔒 Security Considerations

- **Private Keys**: Never share or commit private keys. Deploy with a test wallet only
- **Environment Variables**: Keep backend `.env` files out of version control
- **Network**: Currently deployed on Sepolia testnet (not mainnet)
- **FHE Security**: All sensitive operations go through Fhenix CoFHE encryption
- **Wallet Security**: Users control their own wallets, the app stores no keys
- **Public Metadata**: Whether an address voted, and when, is visible on-chain. Only the choice is private
- **ACP Storage**: The sealing keypair lives in the browser `localStorage`. Clearing it means signing a new permit to decrypt your ballot again
- **Tally Limits**: Counters are `uint8`, so a proposal supports up to 255 votes per side

## 🐛 Troubleshooting

### Backend Issues
- **Insufficient funds**: Get Sepolia ETH from a faucet
- **Deployment fails**: Check `SEPOLIA_RPC_URL` and `PRIVATE_KEY` in `.env`, then run `npm run test:private-key`
- **Tests fail to start**: Run `npm install` again so `@cofhe/hardhat-plugin` is present

### Frontend Issues
- **Contract not found**: Verify `NEXT_PUBLIC_CONTRACT_ADDRESS` in `.env` and that your wallet is on Sepolia
- **CoFHE not initializing**: Open the browser console and look for the `🚀 Initializing CoFHE SDK...` and `✅ CoFHE connected + ACP ready` logs
- **Encryption or decryption is slow**: The Teecryptor poll logs show progress (`⏳ ... attempt N`), wait for them to finish
- **Wallet modal does not open**: Check `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- **Build error `Please call createAppKit before using useAppKit`**: AppKit must be created at module load, see `contexts/appkit.tsx`
- **Vercel `ERR_PNPM_OUTDATED_LOCKFILE`**: Regenerate `pnpm-lock.yaml` and commit it with `package.json`

## 📚 Documentation

- [What is CoFHE?](https://cofhe-docs.fhenix.zone/get-started/introduction/what-is-cofhe) - CoFHE overview
- [Fhenix CoFHE Docs](https://cofhe-docs.fhenix.zone/) - Full documentation
- [Support & Feedback](https://cofhe-docs.fhenix.zone/get-started/introduction/support-and-feedback) - Help channels
- [Hardhat Docs](https://hardhat.org/docs) - Hardhat documentation
- [Next.js Docs](https://nextjs.org/docs) - Next.js documentation
- [Reown AppKit Docs](https://docs.reown.com/appkit/overview) - WalletConnect integration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (`npm test` in `fhevm-hardhat`, `npm run build` in `voting-app`)
5. Submit a pull request

## 📄 License

See the `LICENSE` file in `fhevm-hardhat/`. Individual packages (`@cofhe/sdk`, `@fhenixprotocol/cofhe-contracts`, Reown AppKit and others) carry their own licenses.

## 🙏 Acknowledgments

- **Fhenix**: For CoFHE and the FHE tooling
- **Hardhat**: For the development framework
- **Reown**: For AppKit and WalletConnect
- **shadcn/ui** and **Tailwind CSS**: For the UI foundation

## 📞 Support

For issues or questions:
- Check the troubleshooting section above
- Review the browser console for CoFHE logs
- Check deployment logs for backend issues
- Ask in the Fhenix community channels below

## 🟣 Fhenix

| | |
| --- | --- |
| 🌐 Website | [fhenix.io](https://www.fhenix.io/) |
| 📚 CoFHE docs | [cofhe-docs.fhenix.zone](https://cofhe-docs.fhenix.zone/) |
| 🎓 Learn | [learn.fhenix.io](https://learn.fhenix.io/) |
| ✍️ Blog | [fhenix.io/blog](https://www.fhenix.io/blog) |
| 💻 GitHub | [github.com/FhenixProtocol](https://github.com/FhenixProtocol) |
| 🐦 X | [@fhenix](https://x.com/fhenix) |
| 💬 Discord | [discord.com/invite/FuVgxrvJMY](https://discord.com/invite/FuVgxrvJMY) |
| ✈️ Telegram | [t.me/+OEO4CItQYh8xYzNh](https://t.me/+OEO4CItQYh8xYzNh) |

## 👤 Built by

Observer — [x.com/0bserver_here](https://x.com/0bserver_here)

---

Built with 🔐 Fhenix CoFHE | Deployed on Ethereum Sepolia Testnet
