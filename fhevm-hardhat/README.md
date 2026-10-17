# Confidential Voting (Fhenix CoFHE)

Confidential yes/no voting on Ethereum Sepolia using [Fhenix CoFHE](https://cofhe-docs.fhenix.zone/cofhe/get-started/introduction/fhenix). Votes stay encrypted onchain; tallies are revealed only after the proposal owner makes them public.

## Stack

- `@fhenixprotocol/cofhe-contracts` (`FHE.sol`)
- `@cofhe/sdk` for encrypt / decrypt
- `@cofhe/hardhat-plugin` for local mocks

## Setup

```bash
npm install
cp .env.example .env
```

Set `PRIVATE_KEY` and optionally `SEPOLIA_RPC_URL`.

```bash
npm run compile
npm test
npm run deploy:sepolia
```

Copy the deployed address into `voting-app/.env` as `NEXT_PUBLIC_CONTRACT_ADDRESS`.

## Flow

1. `createProposal` — initializes encrypted yes/no counters
2. `vote(proposalId, encryptedVote, inputProof)` — client encrypts `0` (yes) or `1` (no) with `@cofhe/sdk`
3. `makeVoteCountsPublic` — owner marks tallies for public decrypt (`FHE.allowPublic`)
4. `revealVoteCounts` — client runs `decryptForTx` and publishes the Teecryptor signatures
5. `getMyVote` — voter decrypts their own ballot with `decryptForView`

Frontend lives in `../voting-app`.
