import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ConfidentialVoting with", deployer.address);

  const ConfidentialVoting = await ethers.getContractFactory("ConfidentialVoting");
  const confidentialVoting = await ConfidentialVoting.deploy();
  await confidentialVoting.waitForDeployment();

  const contractAddress = await confidentialVoting.getAddress();
  console.log("ConfidentialVoting deployed to:", contractAddress);
  console.log("Set NEXT_PUBLIC_CONTRACT_ADDRESS in voting-app/.env to this address.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
