# 🗳️ Confidential Voting

Private yes/no voting on Ethereum Sepolia, built on [Fhenix CoFHE](https://cofhe-docs.fhenix.zone/get-started/introduction/what-is-cofhe) (Fully Homomorphic Encryption).

A vote is encrypted in the browser before it ever leaves the wallet. The smart contract never sees Yes or No in plaintext. The CoFHE coprocessor adds encrypted votes into encrypted tallies. Only after the proposal owner publishes and closes do Teecryptor-signed totals appear on-chain.

This is FHE, not zero-knowledge proofs of the ballot. The chain stores ciphertext handles. Arithmetic on those handles happens off-chain in CoFHE and the encrypted result is written back.

## 📁 Repository

| Folder | What it is |
| --- | --- |
| `fhevm-hardhat` | `ConfidentialVoting.sol`, Hardhat tests and Sepolia deploy |
| `voting-app` | Next.js dApp: WalletConnect, `@cofhe/sdk`, vote / create / reveal UI |

🌐 Live network: Ethereum Sepolia. Contract address goes in `voting-app/.env` as `NEXT_PUBLIC_CONTRACT_ADDRESS`.

## 🏗️ Architecture

Four pieces talk to each other:

```
Wallet + browser          ConfidentialVoting.sol         Fhenix CoFHE
(@cofhe/sdk)              (Sepolia)                      (off-chain)
─────────────────         ────────────────────           ────────────────
encrypt Yes/No            stores ciphertext handles      coprocessor:
  → ciphertext + ZK proof   ACL: who may decrypt           FHE add / eq / select
decryptForView            FHE.allowThis / allowSender    Teecryptor:
  (own ballot, no tx)     FHE.allowPublic                  TEE decrypt + seal / sign
decryptForTx              publishDecryptResult
  (signed tally for tx)
```

- 🧠 **`@cofhe/sdk`** runs in the browser. It encrypts inputs, talks to the coprocessor, and requests decrypts.
- 📜 **`FHE.sol`** (`@fhenixprotocol/cofhe-contracts`) is the Solidity API. The contract only holds handles (`euint8`), never plaintext votes.
- 🛰️ **Coprocessor** executes FHE ops (`add`, `eq`, `select`) on ciphertexts and returns a new handle.
- 🔐 **Teecryptor** is the decrypt service. It checks the on-chain ACL, decrypts inside a TEE, then either seals the result to the caller’s ACP key (`decryptForView`) or returns plaintext plus an enclave signature (`decryptForTx`).

Vote encoding used everywhere: **`0` = Yes ✅, `1` = No ❌**.

---

## 🔐 How a vote is encrypted

Triggered when the user clicks Yes or No. Implementation: `voting-app/lib/fheService.ts` → `encrypt()`, then `web3-context.tsx` → `contract.vote(...)`.

1. 🚀 **Connect CoFHE.** On first wallet connect the SDK loads (`createCofheClient` on `chains.sepolia`), then `client.connect(publicClient, walletClient)`.
2. 🪪 **ACP (Access Control Permission).** `client.acp.getOrCreateSelfACP()` creates or loads an EIP-712 permit plus a sealing keypair (stored in `localStorage` under `cofhesdk-acps`). Teecryptor later seals decrypts to this key so only this browser can unseal them.
3. 🔒 **Encrypt locally.** `encryptInputs([Encryptable.uint8(0|1)])` bound to the voting contract via `setConsumingContract(address)`. SDK steps:

   | Step | What happens |
   | --- | --- |
   | 🔧 Init TFHE | Load the TFHE wasm runtime in the browser |
   | 🔑 Fetch keys | Pull Fhenix FHE public keys for Sepolia |
   | 📦 Pack | Encrypt the uint8 vote under those keys |
   | 🧮 Prove | Build a ZK proof that the ciphertext is well-formed |
   | 🛰️ Verify | CoFHE coprocessor verifies the ciphertext + proof |

4. 📤 **Submit on-chain.** The dApp sends two things, not the vote:
   - `encryptedValue` — ciphertext **handle** (`externalEuint8`)
   - `proof` — input proof for the coprocessor

   Plaintext Yes/No never appears in the transaction calldata.

---

## 🧾 What the contract does with an encrypted vote

`ConfidentialVoting.vote(proposalId, encryptedVote, inputProof)`:

1. ⛔ Rejects invalid proposals, double votes, and votes after close (`isPublic`).
2. 🛰️ `FHE.asEuint8(encryptedVote, inputProof)` accepts the ciphertext if the proof checks out. Coprocessor is involved here.
3. 🔒 Stores `encryptedVotes[proposalId][msg.sender] = v`.
4. 👁️ Sets public `hasVoted[proposalId][msg.sender] = true`. **That an address voted is public. What it voted is not.**
5. 🪪 Grants decrypt rights:
   - `FHE.allowThis(v)` — the contract may keep using this ciphertext (needed for tally updates).
   - `FHE.allowSender(v)` — the voter may later `decryptForView` their own ballot.
6. ➕ Updates encrypted counters **without decrypting**:

```solidity
p.yesCount = FHE.add(p.yesCount, FHE.select(FHE.eq(v, yes), one, zero));
p.noCount  = FHE.add(p.noCount,  FHE.select(FHE.eq(v, no),  one, zero));
```

`eq` / `select` / `add` all run on ciphertexts. If the vote equals Yes, encrypted `1` is added to `yesCount`; otherwise encrypted `0`. Same for No. Nodes, explorers, and the contract itself still cannot read the numbers.

`createProposal` starts both counters at `FHE.asEuint8(0)` and `FHE.allowThis` on each so the contract can keep adding.

---

## 🔓 Reading your own vote after a refresh

The ballot is not stored in plaintext anywhere (not localStorage, not the UI cache for the actual vote). After a refresh:

1. 👁️ `hasUserVoted(proposalId, account)` is a **public** bool.
2. 🔒 If true, `getMyVote(proposalId)` returns the **encrypted handle** (only the voter, because of `FHE.allowSender`).
3. 📬 The client calls `decryptForView(handle, FheTypes.Uint8)`. **No transaction.**

Teecryptor then:

1. ✅ Checks on-chain ACL (`FHE.allowSender` for this address).
2. 🧾 Checks the ciphertext commitment (handle still matches the stored ciphertext).
3. 🛰️ Decrypts inside the TEE and **seals** the plaintext to the caller’s ACP public key.
4. 🔑 The browser unseals with the local ACP private key and shows Yes or No.

Anyone else’s wallet cannot pass the ACL, so they cannot decrypt that handle.

---

## 📣 Publish & close (decrypting the tally)

Only the proposal owner can close. UI button: **Publish & close**. Two transactions.

### 1. `makeVoteCountsPublic`

- Requires `msg.sender == proposalOwner`.
- `FHE.allowPublic(p.yesCount)` and `FHE.allowPublic(p.noCount)` — Teecryptor may now decrypt those two handles for anyone who asks.
- Sets `isPublic = true`. Voting is closed. Individual ballots stay private; only the **totals** are marked public.

### 2. `decryptForTx` + `revealVoteCounts`

The dApp fetches the two tally handles with `getEncryptedVoteCount`, then for each:

```
client.decryptForTx(handle).withoutACP()
```

Teecryptor:

1. ✅ Checks public ACL (`FHE.allowPublic`).
2. 🧾 Fetches ciphertext, verifies the commitment.
3. ✍️ Decrypts in the TEE and returns `{ decryptedValue, signature }` (enclave signature over the result).

Then the dApp calls:

```
revealVoteCounts(proposalId, yes, yesSig, no, noSig)
```

On-chain `FHE.publishDecryptResult` verifies each Teecryptor signature against the handle. If valid, the contract writes `publicYesCount` / `publicNoCount` and `isRevealed = true`.

From that point the UI reads plaintext totals from `getPublicVoteCounts`. Individual `encryptedVotes` are still handles and still only decryptable by the original voter.

---

## 👁️ What is public vs private

| Data | Visibility |
| --- | --- |
| Proposal description, id, owner | 🟢 Public |
| Whether an address has voted | 🟢 Public (`hasVoted`) |
| Yes / No ballot | 🔒 Encrypted handle; only the voter can `decryptForView` |
| Running yes / no totals | 🔒 Encrypted until Publish & close |
| Final yes / no totals | 🟢 Public after `revealVoteCounts` |

---

## 🗺️ Developer map

| Concern | Where |
| --- | --- |
| Encrypt / decrypt / ACP | `voting-app/lib/fheService.ts` |
| Contract calls, vote, reveal | `voting-app/contexts/web3-context.tsx` |
| Solidity + FHE ops | `fhevm-hardhat/contracts/ConfidentialVoting.sol` |
| Deploy | `fhevm-hardhat` → `npm run deploy:sepolia` |
| WalletConnect | `voting-app/contexts/appkit.tsx` |

📚 Useful CoFHE docs:

- [What is CoFHE?](https://cofhe-docs.fhenix.zone/get-started/introduction/what-is-cofhe)
- [Fhenix / CoFHE intro](https://cofhe-docs.fhenix.zone/cofhe/get-started/introduction/fhenix)
- [Support](https://cofhe-docs.fhenix.zone/get-started/introduction/support-and-feedback)

---

## ⚡ Quick start

### 1️⃣ Contract

```bash
cd fhevm-hardhat
npm install
cp .env.example .env   # set PRIVATE_KEY and optionally SEPOLIA_RPC_URL
npm run compile
npm test
npm run deploy:sepolia
```

Copy the deployed address into the frontend env.

### 2️⃣ Frontend

```bash
cd voting-app
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000. Use a Sepolia wallet with test ETH.

## 🔑 Environment

`fhevm-hardhat/.env`

| Variable | Purpose |
| --- | --- |
| `PRIVATE_KEY` | Deployer wallet (test key only) |
| `SEPOLIA_RPC_URL` | Sepolia RPC |

`voting-app/.env`

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | Deployed `ConfidentialVoting` |
| `NEXT_PUBLIC_NETWORK` | `sepolia` |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | Sepolia RPC |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Reown / WalletConnect project ID |

## 🧰 Stack

- Solidity `^0.8.25` + `@fhenixprotocol/cofhe-contracts` (`FHE.sol`, `euint8`)
- `@cofhe/sdk` 0.8 — encrypt, ACP, `decryptForView`, `decryptForTx`
- Next.js 15, React 19, Tailwind, ethers v6
- Reown AppKit (WalletConnect)

---

## 🟣 Fhenix

| | |
| --- | --- |
| 🌐 Website | [fhenix.io](https://www.fhenix.io/) |
| 📚 CoFHE docs | [cofhe-docs.fhenix.zone](https://cofhe-docs.fhenix.zone/) |
| 🎓 Learn | [learn.fhenix.io](https://learn.fhenix.io/) |
| ✍️ Blog | [fhenix.io/blog](https://www.fhenix.io/blog) |
| 💻 GitHub | [github.com/FhenixProtocol](https://github.com/FhenixProtocol) |
| 🐦 X | [@FhenixIO](https://x.com/FhenixIO) |
| 💬 Discord | [discord.com/invite/FuVgxrvJMY](https://discord.com/invite/FuVgxrvJMY) |
| ✈️ Telegram | [t.me/+OEO4CItQYh8xYzNh](https://t.me/+OEO4CItQYh8xYzNh) |

## 👤 Built by

Observer — [x.com/0bserver_here](https://x.com/0bserver_here)
