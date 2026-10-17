"use client";

import { ethers } from "ethers";
import { createCofheConfig, createCofheClient } from "@cofhe/sdk/web";
import { Encryptable, FheTypes, isCofheError, type CofheClient } from "@cofhe/sdk";
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
    console.log("Initializing CoFHE SDK...");
    this.client = createCofheClient(
      createCofheConfig({ supportedChains: [chains.sepolia] })
    );
    this.sdkLoaded = true;
    // sdk ready
    console.log("CoFHE SDK loaded");
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
      await client.connect(publicClient, walletClient);
      await client.acp.getOrCreateSelfACP();
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
    // encrypting yes/no ballot
    console.log("Encrypting vote...");
    try {
      const [encryptedValue, proof] = await client
        .encryptInputs([Encryptable.uint8(BigInt(value))])
        .setConsumingContract(CONFIDENTIAL_VOTING_ADDRESS as `0x${string}`)
        .execute();
      // ciphertext
      console.log(encryptedValue);
      return { encryptedValue, proof };
    } catch (error: any) {
      console.error("Encryption failed:", error);
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

    // decrypting ciphertext
    console.log("Decrypting...");
    console.log(handle);
    try {
      const result = await client.decryptForView(handle, FheTypes.Uint8).execute();
      const numericValue = Number(result);
      console.log("Decrypted:", numericValue);
      this.decryptCache.set(handle, { value: numericValue, timestamp: Date.now() });
      return numericValue;
    } catch (error: any) {
      console.error("Decryption failed:", error);
      throw new Error(`Decryption failed: ${error?.message || "Unknown error"}`);
    }
  }

  async decryptForTx(encryptedValue: unknown, config: FHEConfig): Promise<DecryptTxResult> {
    const client = await this.connect(config);
    const handle = toCtHash(encryptedValue);
    // decrypting ciphertext for on-chain reveal
    console.log("Decrypting...");
    console.log(handle);
    try {
      const result = await client.decryptForTx(handle).withoutACP().execute();
      const payload = {
        ctHash: toCtHash(result.ctHash),
        decryptedValue: result.decryptedValue,
        signature: result.signature,
      };
      console.log("Decrypted:", payload.decryptedValue.toString());
      return payload;
    } catch (error: any) {
      console.error("Decryption failed:", error);
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
