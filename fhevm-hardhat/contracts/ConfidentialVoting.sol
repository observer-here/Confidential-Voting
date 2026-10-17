// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, euint8, externalEuint8} from "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract ConfidentialVoting {
    enum VoteOption {
        Yes,
        No
    }

    error InvalidProposal();
    error AlreadyVoted();
    error NotVoted();
    error VoteCountsAlreadyPublic();
    error VoteCountsNotPublic();
    error FHEPermissionDenied();

    struct Proposal {
        string description;
        euint8 yesCount;
        euint8 noCount;
        bool isPublic;
        uint8 publicYesCount;
        uint8 publicNoCount;
        bool isRevealed;
    }

    Proposal[] public proposals;

    mapping(uint256 => mapping(address => euint8)) private encryptedVotes;
    mapping(uint256 => mapping(address => bool)) private hasVoted;
    mapping(uint256 => address) private proposalOwner;

    event ProposalCreated(uint256 indexed proposalId, string description);
    event Voted(uint256 indexed proposalId, address voter);
    event VoteCountsMadePublic(uint256 indexed proposalId);
    event VoteCountsRevealed(uint256 indexed proposalId, uint8 yesCount, uint8 noCount);

    function createProposal(string calldata description) external {
        uint256 proposalId = proposals.length;
        Proposal storage p = proposals.push();
        p.description = description;
        p.yesCount = FHE.asEuint8(0);
        p.noCount = FHE.asEuint8(0);
        FHE.allowThis(p.yesCount);
        FHE.allowThis(p.noCount);
        proposalOwner[proposalId] = msg.sender;
        emit ProposalCreated(proposalId, description);
    }

    function vote(
        uint256 proposalId,
        externalEuint8 encryptedVote,
        bytes calldata inputProof
    ) external {
        if (proposalId >= proposals.length) revert InvalidProposal();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();

        Proposal storage p = proposals[proposalId];
        if (p.isPublic) revert VoteCountsAlreadyPublic();

        euint8 v = FHE.asEuint8(encryptedVote, inputProof);
        encryptedVotes[proposalId][msg.sender] = v;
        hasVoted[proposalId][msg.sender] = true;
        FHE.allowThis(v);
        FHE.allowSender(v);

        euint8 yes = FHE.asEuint8(uint8(VoteOption.Yes));
        euint8 no = FHE.asEuint8(uint8(VoteOption.No));
        euint8 one = FHE.asEuint8(1);
        euint8 zero = FHE.asEuint8(0);

        p.yesCount = FHE.add(p.yesCount, FHE.select(FHE.eq(v, yes), one, zero));
        p.noCount = FHE.add(p.noCount, FHE.select(FHE.eq(v, no), one, zero));
        FHE.allowThis(p.yesCount);
        FHE.allowThis(p.noCount);

        emit Voted(proposalId, msg.sender);
    }

    function getEncryptedVoteCount(uint256 proposalId) external view returns (euint8 yes, euint8 no) {
        if (proposalId >= proposals.length) revert InvalidProposal();
        Proposal storage p = proposals[proposalId];
        return (p.yesCount, p.noCount);
    }

    function getMyVote(uint256 proposalId) external view returns (euint8) {
        if (proposalId >= proposals.length) revert InvalidProposal();
        if (!hasVoted[proposalId][msg.sender]) revert NotVoted();
        return encryptedVotes[proposalId][msg.sender];
    }

    function proposalCount() external view returns (uint256) {
        return proposals.length;
    }

    function hasUserVoted(uint256 proposalId, address voter) external view returns (bool) {
        if (proposalId >= proposals.length) revert InvalidProposal();
        return hasVoted[proposalId][voter];
    }

    function isProposalOwner(uint256 proposalId, address user) external view returns (bool) {
        if (proposalId >= proposals.length) revert InvalidProposal();
        return proposalOwner[proposalId] == user;
    }

    function makeVoteCountsPublic(uint256 proposalId) external {
        if (proposalId >= proposals.length) revert InvalidProposal();
        if (msg.sender != proposalOwner[proposalId]) revert FHEPermissionDenied();

        Proposal storage p = proposals[proposalId];
        if (p.isPublic) revert VoteCountsAlreadyPublic();

        FHE.allowPublic(p.yesCount);
        FHE.allowPublic(p.noCount);
        p.isPublic = true;

        emit VoteCountsMadePublic(proposalId);
    }

    function revealVoteCounts(
        uint256 proposalId,
        uint8 yesCount,
        bytes calldata yesSignature,
        uint8 noCount,
        bytes calldata noSignature
    ) external {
        if (proposalId >= proposals.length) revert InvalidProposal();

        Proposal storage p = proposals[proposalId];
        if (!p.isPublic) revert VoteCountsNotPublic();
        if (p.isRevealed) revert VoteCountsAlreadyPublic();

        FHE.publishDecryptResult(p.yesCount, yesCount, yesSignature);
        FHE.publishDecryptResult(p.noCount, noCount, noSignature);

        p.publicYesCount = yesCount;
        p.publicNoCount = noCount;
        p.isRevealed = true;

        emit VoteCountsRevealed(proposalId, yesCount, noCount);
    }

    function getPublicVoteCounts(
        uint256 proposalId
    ) external view returns (uint8 yesCount, uint8 noCount, bool isPublic, bool isRevealed) {
        if (proposalId >= proposals.length) revert InvalidProposal();
        Proposal storage p = proposals[proposalId];
        return (p.publicYesCount, p.publicNoCount, p.isPublic, p.isRevealed);
    }
}
