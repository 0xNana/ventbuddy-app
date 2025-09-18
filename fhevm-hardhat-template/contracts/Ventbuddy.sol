// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import {FHE, euint128, externalEuint128, euint32, externalEuint32, eaddress, externalEaddress} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract Ventbuddy is Ownable, ReentrancyGuard, Pausable, SepoliaConfig {
    using FHE for *;

    uint64 private _nextPostId = 1;
    uint64 private _nextReplyId = 1;

    address public feeRecipient;
    uint128 public feeBasisPoints; // 

    enum Visibility { Public, Tippable }

    struct Post {
        bytes32 contentHash;        // Hash of encrypted content 
        bytes32 previewHash;        // Hash of encrypted preview 
        string supabaseId;          // Supabase record ID for encrypted content
        eaddress authorId;          // encrypted author identifier
        euint128 totalTips;         // encrypted total tips
        euint128 visibility;        // encrypted visibility setting (0=Public, 1=Tippable)
        uint128 minTipAmount;       // minimum tip amount to unlock (for tippable posts) - unencrypted so users can see it
        bool revealed;              // whether author flipped reveal
    }

    struct Reply {
        bytes32 contentHash;        // Hash of encrypted reply content 
        bytes32 previewHash;        // Hash of encrypted preview 
        string supabaseId;          // Supabase record ID for encrypted reply content
        eaddress replierId;         // encrypted replier identifier
        euint128 totalTips;         // encrypted total tips
        euint128 visibility;        // encrypted visibility setting (0=Public, 1=Tippable)
        uint128 minTipAmount;       // minimum tip amount to unlock (for tippable replies) - unencrypted so users can see it
        bool revealed;              // whether replier flipped reveal
    }

    // storage
    mapping(uint64 => Post) public posts;
    mapping(uint64 => mapping(uint64 => Reply)) public replies; // postId => replyId => reply
    mapping(uint64 => mapping(address => uint128)) public postTipContrib; // postId => tipperAddress => amount (plain for efficiency)
    mapping(uint64 => mapping(uint64 => mapping(address => uint128))) public replyTipContrib; // postId => replyId => tipperAddress => amount (plain for efficiency)

    // ETH balance tracking for creators
    mapping(address => uint128) public balances; // creator address => ETH balance (in wei)
    
    // DAO fee tracking
    uint128 public totalFeesCollected;
    uint128 public totalEarningsDistributed;


    // user identity management (PRIVATE - only accessible by contract)
    mapping(address => bool) private isUserRegistered;
    mapping(address => eaddress) private userEncryptedAddresses;
    mapping(eaddress => address) private encryptedToRealAddress; // For ETH balance tracking

    // access control for encrypted content (plain post ID => encrypted address => access)
    mapping(uint64 => mapping(eaddress => bool)) public hasAccess;


    // events
    event PostCreated(uint64 indexed postId, eaddress indexed author, euint128 visibility);
    event ReplyCreated(uint64 indexed postId, uint64 indexed replyId, eaddress indexed replier, euint128 visibility);
    event TipAddedToPost(uint64 indexed postId, eaddress indexed tipper, uint128 amount);
    event TipAddedToReply(uint64 indexed postId, uint64 indexed replyId, eaddress indexed tipper, uint128 amount);
    event Claim(address indexed creator, uint128 amount, uint128 fee, uint128 actualPayout, uint128 actualFee);
    event ContentUnlocked(uint64 indexed postId, eaddress indexed user, uint128 tipAmount);
    event UserRegistered(address indexed user, euint128 encryptedId);
    event ContractPaused(address indexed admin);
    event ContractUnpaused(address indexed admin);

    constructor(address _feeRecipient, uint128 _feeBasisPoints) Ownable(msg.sender) {
        feeRecipient = _feeRecipient;
        feeBasisPoints = _feeBasisPoints; // e.g. 1000 = 10%
    }

    // --- User Registration ---
    function registerUser(externalEaddress encryptedAddress, bytes calldata addressProof) external whenNotPaused {
        require(!isUserRegistered[msg.sender], "User already registered");
        
        eaddress encryptedAddr = FHE.fromExternal(encryptedAddress, addressProof);
        isUserRegistered[msg.sender] = true;
        userEncryptedAddresses[msg.sender] = encryptedAddr;
        encryptedToRealAddress[encryptedAddr] = msg.sender; // Store mapping for ETH balance tracking
        
        emit UserRegistered(msg.sender, FHE.asEuint128(uint128(1)));
    }

    // --- Emergency Recovery Function ---
    // This function allows users to recover their encrypted address mapping if it gets corrupted
    function recoverEncryptedAddressMapping(externalEaddress encryptedAddress, bytes calldata addressProof) external whenNotPaused {
        require(isUserRegistered[msg.sender], "User not registered");
        
        eaddress encryptedAddr = FHE.fromExternal(encryptedAddress, addressProof);
        userEncryptedAddresses[msg.sender] = encryptedAddr;
        encryptedToRealAddress[encryptedAddr] = msg.sender; // Re-establish mapping for ETH balance tracking
        
        emit UserRegistered(msg.sender, FHE.asEuint128(uint128(1))); // Re-emit for tracking
    }


    // --- Posting / replying ---
    function createPost(
        bytes32 contentHash,
        bytes32 previewHash,
        string calldata supabaseId,
        externalEuint128 encryptedVisibility,
        bytes calldata visibilityProof,
        uint128 minTipAmount
    ) external whenNotPaused {
        require(isUserRegistered[msg.sender], "User not registered");
        
        uint64 postId = _nextPostId++;
        
        posts[postId] = Post({
            contentHash: contentHash,
            previewHash: previewHash,
            supabaseId: supabaseId,
            authorId: userEncryptedAddresses[msg.sender],
            totalTips: FHE.asEuint128(uint128(0)),
            visibility: FHE.fromExternal(encryptedVisibility, visibilityProof),
            minTipAmount: minTipAmount,
            revealed: false
        });
        
        emit PostCreated(postId, userEncryptedAddresses[msg.sender], FHE.fromExternal(encryptedVisibility, visibilityProof));
    }

    function replyToPost(
        uint64 postId,
        bytes32 contentHash,
        bytes32 previewHash,
        string calldata supabaseId,
        externalEuint128 encryptedVisibility,
        bytes calldata visibilityProof,
        uint128 minTipAmount
    ) external whenNotPaused {
        require(isUserRegistered[msg.sender], "User not registered");
        
        // Check if post exists (simplified check - in full FHE would need proper comparison)
        // For now, we assume the frontend validates post existence
        
        uint64 replyId = _nextReplyId++;
        
        replies[postId][replyId] = Reply({
            contentHash: contentHash,
            previewHash: previewHash,
            supabaseId: supabaseId,
            replierId: userEncryptedAddresses[msg.sender],
            totalTips: FHE.asEuint128(uint128(0)),
            visibility: FHE.fromExternal(encryptedVisibility, visibilityProof),
            minTipAmount: minTipAmount,
            revealed: false
        });
        
        emit ReplyCreated(postId, replyId, userEncryptedAddresses[msg.sender], FHE.fromExternal(encryptedVisibility, visibilityProof));
    }

    // SIMPLE TIPPING (post and reply) - ETH NATIVE ---
    function tipPost(uint64 postId) external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "No zero tips");
        require(msg.value <= type(uint128).max, "Tip amount too large");
        require(isUserRegistered[msg.sender], "User not registered");
        
        Post storage p = posts[postId];
        
        // Check if post exists by verifying contentHash is not empty
        require(p.contentHash != bytes32(0), "Post does not exist");
        
        // SIMPLE TIPPING: Just store the tip amount (no FHE operations)
        postTipContrib[postId][msg.sender] += uint128(msg.value);
        
        // Update creator's ETH balance (plain for easier claiming)
        // Note: If creator address lookup fails, we still allow the tip to go through
        address creatorAddress = encryptedToRealAddress[p.authorId];
        if (creatorAddress != address(0)) {
            balances[creatorAddress] += uint128(msg.value);
        }
        // If creatorAddress is address(0), the tip is still recorded
        // This prevents transaction reverts while maintaining tip tracking
        
        emit TipAddedToPost(postId, userEncryptedAddresses[msg.sender], uint128(msg.value));
    }

    function tipReply(uint64 postId, uint64 replyId) external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "No zero tips");
        require(msg.value <= type(uint128).max, "Tip amount too large");
        require(isUserRegistered[msg.sender], "User not registered");
        
        Reply storage r = replies[postId][replyId];
        
        // Check if reply exists by verifying contentHash is not empty
        require(r.contentHash != bytes32(0), "Reply does not exist");
        
        // SIMPLE TIPPING: Just store the tip amount (no FHE operations)
        replyTipContrib[postId][replyId][msg.sender] += uint128(msg.value);
        
        // Update replier's ETH balance (plain for easier claiming)
        // Note: If replier address lookup fails, we still allow the tip to go through
        address replierAddress = encryptedToRealAddress[r.replierId];
        if (replierAddress != address(0)) {
            balances[replierAddress] += uint128(msg.value);
        }
        // If replierAddress is address(0), the tip is still recorded
        // This prevents transaction reverts while maintaining tip tracking
        
        emit TipAddedToReply(postId, replyId, userEncryptedAddresses[msg.sender], uint128(msg.value));
    }

    // Content Unlocking for Tippable Posts - ETH NATIVE ---
    function unlockTippableContent(uint64 postId) external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "No zero tips");
        require(msg.value <= type(uint128).max, "Tip amount too large");
        require(isUserRegistered[msg.sender], "User not registered");
        
        Post storage p = posts[postId];
        
        // Check if post exists by verifying contentHash is not empty
        require(p.contentHash != bytes32(0), "Post does not exist");
        
        require(msg.value >= p.minTipAmount, "Tip amount below minimum required");
        
        // Grant access to the user (tipper identity stays private via encrypted address)
        eaddress tipperId = userEncryptedAddresses[msg.sender];
        hasAccess[postId][tipperId] = true;
        
        // SIMPLE TIPPING: Just store the tip amount (no FHE operations)
        postTipContrib[postId][msg.sender] += uint128(msg.value);
        
        // Update creator's ETH balance (plain for easier claiming)
        // Note: If creator address lookup fails, we still allow the unlock to go through
        address creatorAddress = encryptedToRealAddress[p.authorId];
        if (creatorAddress != address(0)) {
            balances[creatorAddress] += uint128(msg.value);
        }
        // If creatorAddress is address(0), the tip is still recorded
        // This prevents transaction reverts while maintaining tip tracking
        
        emit ContentUnlocked(postId, userEncryptedAddresses[msg.sender], uint128(msg.value));
        emit TipAddedToPost(postId, userEncryptedAddresses[msg.sender], uint128(msg.value));
    }

    // --- Claim earnings (creator triggers) ---
    function claimEarnings(uint128 tokenAmount) external nonReentrant whenNotPaused {
        require(isUserRegistered[msg.sender], "User not registered");
        require(tokenAmount > 0, "No earnings to claim");
        require(balances[msg.sender] >= tokenAmount, "Insufficient ETH balance");
        
        // Reset ETH balance
        balances[msg.sender] -= tokenAmount;
        
        // Calculate actual token amounts
        uint128 actualFee = (tokenAmount * feeBasisPoints) / 10000;
        uint128 actualPayout = tokenAmount - actualFee;
        
        // Transfer ETH to creator
        if (actualPayout > 0) {
            payable(msg.sender).transfer(actualPayout);
            totalEarningsDistributed += actualPayout;
        }
        
        // Transfer fee to platform
        if (actualFee > 0) {
            payable(feeRecipient).transfer(actualFee);
            totalFeesCollected += actualFee;
        }
        
        emit Claim(msg.sender, tokenAmount, actualFee, actualPayout, actualFee);
    }

    // --- Admin ---
    function setFeeRecipient(address _recipient) external onlyOwner {
        feeRecipient = _recipient;
    }

    function setFeeBasisPoints(uint128 _bps) external onlyOwner {
        require(_bps <= 2000, "Max 20%");
        feeBasisPoints = _bps;
    }


    // --- DAO Stats ---
    function getDAOStats() external view returns (uint128 feesCollected, uint128 earningsDistributed, uint128 feeRate) {
        return (totalFeesCollected, totalEarningsDistributed, feeBasisPoints);
    }

    // --- ETH Helper Functions ---
    function getBalance(address user) external view returns (uint128 balance) {
        return balances[user];
    }

    function getContractBalance() external view returns (uint256 balance) {
        return address(this).balance;
    }

    function getEarningsStats() external view returns (uint128 totalEarnings, uint128 totalFees) {
        return (totalEarningsDistributed, totalFeesCollected);
    }

    // --- Debug Helper Functions ---
    function isUserRegisteredCheck(address user) external view returns (bool) {
        return isUserRegistered[user];
    }

    function getEncryptedAddressForUser(address user) external view returns (bool hasEncryptedAddress) {
        // This function returns true if the user has an encrypted address mapping
        // Note: We can't return the actual encrypted address as it's private
        return isUserRegistered[user];
    }
    // Note: This function returns encrypted boolean which is not directly usable
    // Frontend should use events to track access instead
    // function hasUserAccess(euint128 postId, eaddress encryptedUserId) external view returns (bool) {
    //     return hasAccess[postId][encryptedUserId];
    // }


    // --- Pause/Unpause Functions ---
    function pause() external onlyOwner {
        _pause();
        emit ContractPaused(msg.sender);
    }

    function unpause() external onlyOwner {
        _unpause();
        emit ContractUnpaused(msg.sender);
    }

    // --- Helper Functions for Tip Tracking ---
    
    /**
     * Get the total amount a user has tipped to a specific post
     * @param postId The post ID
     * @param tipper The tipper's address
     * @return The total amount tipped by this user to this post
     */
    function getPostTipContribution(uint64 postId, address tipper) external view returns (uint128) {
        return postTipContrib[postId][tipper];
    }
    
    /**
     * Get the total amount a user has tipped to a specific reply
     * @param postId The post ID
     * @param replyId The reply ID
     * @param tipper The tipper's address
     * @return The total amount tipped by this user to this reply
     */
    function getReplyTipContribution(uint64 postId, uint64 replyId, address tipper) external view returns (uint128) {
        return replyTipContrib[postId][replyId][tipper];
    }

    // fallback to accept direct funds
    receive() external payable {}
}
