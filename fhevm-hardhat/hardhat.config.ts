import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@typechain/hardhat";
import "@cofhe/hardhat-plugin";
import type { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const MNEMONIC = process.env.MNEMONIC || "";
const hardhatAccounts = PRIVATE_KEY
  ? [{ privateKey: PRIVATE_KEY, balance: "10000000000000000000000" }]
  : MNEMONIC
    ? { mnemonic: MNEMONIC }
    : undefined;
const remoteAccounts = PRIVATE_KEY ? [PRIVATE_KEY] : MNEMONIC ? { mnemonic: MNEMONIC } : [];

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      ...(hardhatAccounts ? { accounts: hardhatAccounts } : {}),
      chainId: 31337,
    },
    localhost: {
      accounts: remoteAccounts,
      chainId: 31337,
      url: "http://localhost:8545",
    },
    sepolia: {
      accounts: remoteAccounts,
      chainId: 11155111,
      url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.28",
    settings: {
      metadata: { bytecodeHash: "none" },
      optimizer: { enabled: true, runs: 800 },
      evmVersion: "cancun",
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
  mocha: {
    timeout: 180000,
  },
};

export default config;
