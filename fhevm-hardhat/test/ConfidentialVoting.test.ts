import { expect } from "chai";
import hre from "hardhat";
import { Encryptable, FheTypes, type CofheClient } from "@cofhe/sdk";
import type { ConfidentialVoting } from "../types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ConfidentialVoting", function () {
  this.timeout(180000);

  let voting: ConfidentialVoting;
  let owner: HardhatEthersSigner;
  let voter1: HardhatEthersSigner;
  let voter2: HardhatEthersSigner;
  let ownerClient: CofheClient;
  let voter1Client: CofheClient;
  let voter2Client: CofheClient;

  async function encryptVote(client: CofheClient, value: bigint) {
    const [handle, proof] = await client
      .encryptInputs([Encryptable.uint8(value)])
      .setConsumingContract(await voting.getAddress())
      .execute();
    return { handle, proof };
  }

  before(async function () {
    [owner, voter1, voter2] = await hre.ethers.getSigners();
    ownerClient = await hre.cofhe.createClientWithBatteries(owner);
    voter1Client = await hre.cofhe.createClientWithBatteries(voter1);
    voter2Client = await hre.cofhe.createClientWithBatteries(voter2);
  });

  beforeEach(async function () {
    const Factory = await hre.ethers.getContractFactory("ConfidentialVoting");
    voting = (await Factory.connect(owner).deploy()) as unknown as ConfidentialVoting;
    await voting.waitForDeployment();
  });

  it("starts with zero proposals", async function () {
    expect(await voting.proposalCount()).to.equal(0);
  });

  it("creates proposals", async function () {
    await expect(voting.createProposal("Should we use CoFHE?"))
      .to.emit(voting, "ProposalCreated")
      .withArgs(0, "Should we use CoFHE?");
    await voting.createProposal("Second");
    expect(await voting.proposalCount()).to.equal(2);
  });

  it("casts encrypted votes and lets the voter decrypt their own vote", async function () {
    await voting.createProposal("Test proposal");
    const yes = await encryptVote(voter1Client, 0n);
    await voting.connect(voter1).vote(0, yes.handle, yes.proof);

    expect(await voting.hasUserVoted(0, voter1.address)).to.be.true;

    const handle = await voting.connect(voter1).getMyVote(0);
    const decrypted = await voter1Client.decryptForView(handle, FheTypes.Uint8).execute();
    expect(decrypted).to.equal(0n);
  });

  it("rejects a second vote from the same address", async function () {
    await voting.createProposal("Test proposal");
    const first = await encryptVote(voter1Client, 0n);
    await voting.connect(voter1).vote(0, first.handle, first.proof);

    const second = await encryptVote(voter1Client, 1n);
    await expect(voting.connect(voter1).vote(0, second.handle, second.proof)).to.be.revertedWithCustomError(
      voting,
      "AlreadyVoted"
    );
  });

  it("reveals encrypted tallies after the owner makes them public", async function () {
    await voting.createProposal("Test proposal");

    const yes = await encryptVote(voter1Client, 0n);
    await voting.connect(voter1).vote(0, yes.handle, yes.proof);
    const no = await encryptVote(voter2Client, 1n);
    await voting.connect(voter2).vote(0, no.handle, no.proof);

    await expect(voting.makeVoteCountsPublic(0)).to.emit(voting, "VoteCountsMadePublic").withArgs(0);

    const [yesHandle, noHandle] = await voting.getEncryptedVoteCount(0);
    const yesResult = await ownerClient.decryptForTx(yesHandle).withoutACP().execute();
    const noResult = await ownerClient.decryptForTx(noHandle).withoutACP().execute();

    await expect(
      voting.revealVoteCounts(0, yesResult.decryptedValue, yesResult.signature, noResult.decryptedValue, noResult.signature)
    )
      .to.emit(voting, "VoteCountsRevealed")
      .withArgs(0, 1, 1);

    const [yesCount, noCount, isPublic, isRevealed] = await voting.getPublicVoteCounts(0);
    expect(isPublic).to.equal(true);
    expect(isRevealed).to.equal(true);
    expect(yesCount).to.equal(1);
    expect(noCount).to.equal(1);
  });

  it("only lets the owner make results public", async function () {
    await voting.createProposal("Test proposal");
    await expect(voting.connect(voter1).makeVoteCountsPublic(0)).to.be.revertedWithCustomError(
      voting,
      "FHEPermissionDenied"
    );
  });

  it("reverts for an invalid proposal id", async function () {
    await expect(voting.hasUserVoted(999, voter1.address)).to.be.revertedWithCustomError(voting, "InvalidProposal");
  });
});
