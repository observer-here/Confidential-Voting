import { useState, useEffect, useCallback } from "react";
import fheService, {
  FHEConfig,
  EncryptedVote,
  DecryptTxResult,
} from "../lib/fheService";

export const useFHE = (config?: FHEConfig) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSDKAvailable, setIsSDKAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    fheService.preload();
    setIsSDKAvailable(true);
  }, []);

  const initializeFHE = useCallback(async (fheConfig: FHEConfig) => {
    if (typeof window === "undefined") return;
    setIsLoading(true);
    setError(null);
    try {
      await fheService.connect(fheConfig);
      setIsInitialized(true);
      setIsSDKAvailable(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize CoFHE");
      setIsInitialized(false);
      console.error("CoFHE initialization error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetFHE = useCallback(() => {
    fheService.reset();
    setIsInitialized(false);
    setError(null);
    setIsLoading(false);
    setIsSDKAvailable(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (config?.account && !isInitialized && !isLoading) {
      initializeFHE(config);
    } else if (!config && isInitialized) {
      setIsInitialized(false);
    }
  }, [config, isInitialized, isLoading, initializeFHE, resetFHE]);

  const encrypt = useCallback(
    async (value: number): Promise<EncryptedVote> => {
      if (!config || !isInitialized) {
        throw new Error("FHE service not initialized. Please wait for initialization to complete.");
      }
      return fheService.encrypt(value, config);
    },
    [config, isInitialized]
  );

  const userDecrypt = useCallback(
    async (encryptedValue: unknown): Promise<number> => {
      if (!config || !isInitialized) {
        throw new Error("FHE service not initialized. Please wait for initialization to complete.");
      }
      return fheService.decryptForView(encryptedValue, config);
    },
    [config, isInitialized]
  );

  const decryptForTx = useCallback(
    async (encryptedValue: unknown): Promise<DecryptTxResult> => {
      if (!config || !isInitialized) {
        throw new Error("FHE service not initialized. Please wait for initialization to complete.");
      }
      return fheService.decryptForTx(encryptedValue, config);
    },
    [config, isInitialized]
  );

  return {
    isInitialized,
    isLoading,
    error,
    isSDKAvailable,
    encrypt,
    decrypt: userDecrypt,
    userDecrypt,
    decryptForTx,
    refreshInstance: () => (config ? initializeFHE(config) : Promise.resolve()),
    resetFHE,
  };
};
