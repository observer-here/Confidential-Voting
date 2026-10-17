"use client";

import { ethers } from "ethers";
import { createCofheConfig, createCofheClient } from "@cofhe/sdk/web";
import { Encryptable, EncryptStep, FheTypes, isCofheError, type CofheClient } from "@cofhe/sdk";
import { chains } from "@cofhe/sdk/chains";
import { Ethers6Adapter } from "@cofhe/sdk/adapters";
import { CONFIDENTIAL_VOTING_ADDRESS } from "./contracts";

export interface FHEConfig {
  account?: string;
  chainId?: number;
  provider?: ethers.Eip1193Provider;
}

export interface EncryptedVote {
  encryptedValue: string;
  proof: string;
}

export interface DecryptTxResult {
  ctHash: string;
  decryptedValue: bigint;
  signature: string;
}

export const VOTE_OPTIONS = {
  YES: 0,
  NO: 1,
} as const;

const ENCRYPT_STEP_LOG: Record<EncryptStep, string> = {
  [EncryptStep.InitTfhe]: "🔧 Init TFHE runtime",
  [EncryptStep.FetchKeys]: "🔑 Fetch Fhenix FHE public keys",
  [EncryptStep.Pack]: "📦 Pack encrypted Yes/No input",
  [EncryptStep.Prove]: "🧮 Generate ZK proof of encryption",
  [EncryptStep.Verify]: "🛰️ CoFHE coprocessor verifying ciphertext",
};

function logEncryptStep(step: EncryptStep, ctx?: { isStart?: boolean; isEnd?: boolean; duration?: number }) {
  const label = ENCRYPT_STEP_LOG[step] ?? step;
  if (ctx?.isStart) console.log(`${label}...`);
  if (ctx?.isEnd) console.log(`✅ ${label}${ctx.duration ? ` (${ctx.duration}ms)` : ""}`);
}

function logDecryptPoll(ctx: {
  operation: string;
  requestId: string;
  attemptIndex: number;
  elapsedMs: number;
}) {
  const node = ctx.operation === "sealoutput" ? "Teecryptor sealoutput" : "Teecryptor decrypt";
  console.log(
    `⏳ Fhenix ${node} processing... attempt ${ctx.attemptIndex + 1}` +
      `${ctx.requestId ? ` [${ctx.requestId.slice(0, 10)}…]` : ""} (${ctx.elapsedMs}ms)`
  );
}

function toCtHash(value: unknown): `0x${string}` {
  if (typeof value === "bigint") {
    return `0x${value.toString(16).padStart(64, "0")}` as `0x${string}`;
  }
  if (typeof value === "string") {
    return (value.startsWith("0x") ? value : `0x${value}`) as `0x${string}`;
  }
  if (typeof value === "number") {
    return toCtHash(BigInt(value));
  }
  throw new Error("Invalid ciphertext handle");
}

class FHEService {
  private client: CofheClient | null = null;
  private account: string | null = null;
  private connecting: Promise<CofheClient> | null = null;
  private sdkLoaded = false;
  private decryptCache = new Map<string, { value: number; timestamp: number }>();
  private readonly DECRYPT_CACHE_DURATION = 30000;

  preload(): void {
    if (typeof window === "undefined" || this.client) return;
    // initializing CoFHE SDK on dapp open
    console.log("🚀 Initializing CoFHE SDK...");
    this.client = createCofheClient(
      createCofheConfig({ supportedChains: [chains.sepolia] })
    );
    this.sdkLoaded = true;
    // sdk ready
    console.log("✅ CoFHE SDK loaded");
  }

  private getClient(): CofheClient {
    this.preload();
    return this.client!;
  }

  async connect(config: FHEConfig): Promise<CofheClient> {
    if (typeof window === "undefined" || !config.provider) {
      throw new Error("Wallet is not available");
    }
    if (!config.account) {
      throw new Error("Connect a wallet before using FHE");
    }
    if (this.client?.connected && this.account === config.account.toLowerCase()) {
      return this.client;
    }
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
      const client = this.getClient();
      const provider = new ethers.BrowserProvider(config.provider!);
      const signer = await provider.getSigner(config.account);
      const { publicClient, walletClient } = await Ethers6Adapter(provider, signer);
      console.log("🔗 Connecting CoFHE client to wallet...");
      await client.connect(publicClient, walletClient);
      // ACP is the EIP-712 permission Teecryptor checks against on-chain ACL
      console.log("🪪 Creating or loading self ACP...");
      await client.acp.getOrCreateSelfACP();
      console.log("✅ CoFHE connected + ACP ready");
      this.account = config.account!.toLowerCase();
      return client;
    })();

    try {
      return await this.connecting;
    } catch (error) {
      console.error("CoFHE initialization failed:", error);
      throw error;
    } finally {
      this.connecting = null;
    }
  }

  async encrypt(value: number, config: FHEConfig): Promise<EncryptedVote> {
    const client = await this.connect(config);
    // encrypting yes/no on the client, then CoFHE verifies the ZK proof
    console.log("🔐 Encrypting vote on Fhenix CoFHE...");
    try {
      const [encryptedValue, proof] = await client
        .encryptInputs([Encryptable.uint8(BigInt(value))])
        .setConsumingContract(CONFIDENTIAL_VOTING_ADDRESS as `0x${string}`)
        .onStep((step, ctx) => logEncryptStep(step, ctx))
        .execute();
      // ciphertext handle (not plaintext Yes/No)
      console.log("🔒 Ciphertext handle:");
      console.log(encryptedValue);
      console.log("🧾 Input proof ready for coprocessor");
      return { encryptedValue, proof };
    } catch (error: any) {
      console.error("❌ Encryption failed:", error);
      throw new Error(`Encryption failed: ${error?.message || "Unknown error"}`);
    }
  }

  async decryptForView(encryptedValue: unknown, config: FHEConfig): Promise<number> {
    const client = await this.connect(config);
    const handle = toCtHash(encryptedValue);
    const cached = this.decryptCache.get(handle);
    if (cached && Date.now() - cached.timestamp < this.DECRYPT_CACHE_DURATION) {
      return cached.value;
    }

    // decryptForView: Teecryptor ACL check + TEE decrypt, sealed to ACP, unsealed locally
    console.log("🔓 Decrypting for view (no on-chain tx)...");
    console.log("🔒 Ciphertext handle:");
    console.log(handle);
    console.log("🛰️ Sending to Fhenix Teecryptor...");
    console.log("   1. Check on-chain ACL (FHE.allowSender)");
    console.log("   2. Check ciphertext commitment");
    console.log("   3. Decrypt inside TEE, seal to ACP key");
    try {
      const result = await client
        .decryptForView(handle, FheTypes.Uint8)
        .onPoll((ctx) => logDecryptPoll(ctx))
        .execute();
      const numericValue = Number(result);
      console.log("📬 Unsealing with local ACP key...");
      console.log("✅ Decrypted:", numericValue);
      this.decryptCache.set(handle, { value: numericValue, timestamp: Date.now() });
      return numericValue;
    } catch (error: any) {
      console.error("❌ Decryption failed:", error);
      throw new Error(`Decryption failed: ${error?.message || "Unknown error"}`);
    }
  }

  async decryptForTx(encryptedValue: unknown, config: FHEConfig): Promise<DecryptTxResult> {
    const client = await this.connect(config);
    const handle = toCtHash(encryptedValue);
    // decryptForTx: Teecryptor returns plaintext + enclave signature for publishDecryptResult
    console.log("🔓 Decrypting for tx (Teecryptor signed result)...");
    console.log("🔒 Ciphertext handle:");
    console.log(handle);
    console.log("🛰️ Sending to Fhenix Teecryptor...");
    console.log("   1. Check public ACL (FHE.allowPublic)");
    console.log("   2. Fetch ciphertext + verify commitment");
    console.log("   3. Decrypt in TEE and sign result");
    try {
      const result = await client
        .decryptForTx(handle)
        .withoutACP()
        .onPoll((ctx) => logDecryptPoll(ctx))
        .execute();
      const payload = {
        ctHash: toCtHash(result.ctHash),
        decryptedValue: result.decryptedValue,
        signature: result.signature,
      };
      console.log("✅ Decrypted:", payload.decryptedValue.toString());
      console.log("✍️ Teecryptor signature:");
      console.log(payload.signature);
      return payload;
    } catch (error: any) {
      console.error("❌ Decryption failed:", error);
      throw new Error(`Decrypt-for-tx failed: ${error?.message || "Unknown error"}`);
    }
  }

  isReady(): boolean {
    return !!this.client?.connected;
  }

  isSDKAvailable(): boolean {
    return this.sdkLoaded;
  }

  getSDKStatus() {
    return {
      initialized: this.isReady(),
      sdkInstance: this.sdkLoaded ? "CoFHE Client" : null,
      sdkAvailable: this.sdkLoaded,
    };
  }

  getStatus() {
    return {
      ready: this.isReady(),
      sdkLoaded: this.sdkLoaded,
      account: this.account,
    };
  }

  reset(): void {
    this.client?.disconnect();
    this.client = null;
    this.account = null;
    this.connecting = null;
    this.sdkLoaded = false;
    this.decryptCache.clear();
  }
}

const fheService = new FHEService();
export default fheService;

export const validateVoteValue = (value: number): boolean =>
  value === VOTE_OPTIONS.YES || value === VOTE_OPTIONS.NO;

export const getFHEStatus = () => ({
  isInitialized: fheService.isSDKAvailable(),
  sdkStatus: fheService.getSDKStatus(),
  serviceStatus: fheService.getStatus(),
});

export const handleFHEError = (error: any): string => {
  if (isCofheError(error)) {
    return error.hint ? `${error.message}. ${error.hint}` : error.message;
  }
  if (error?.message?.includes("Wallet is not available")) {
    return "Connect a wallet on Ethereum Sepolia to use CoFHE.";
  }
  return error?.message || "Unknown FHE error occurred";
};
