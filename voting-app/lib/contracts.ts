export const CONFIDENTIAL_VOTING_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xFB78fFa3f5D6192Be4b23B0efe8637fD629455FD";

// Import ABI from compiled contract
import contractABI from './ConfidentialVotingABI.json';
export const CONFIDENTIAL_VOTING_ABI = contractABI.abi; 