// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VentbuddyUSDCToken
 * @dev Combined ERC-20 USDC token with built-in faucet functionality
 * @notice This is a test USDC token with 100B supply and built-in faucet for development
 */
contract VentbuddyUSDCToken is ERC20, ERC20Burnable, ERC20Pausable, ERC20Permit, Ownable, ReentrancyGuard {
    
    // Token decimals (6 decimals like real USDC)
    uint8 private constant DECIMALS = 6;
    
    // Total supply: 100 billion tokens
    uint256 private constant TOTAL_SUPPLY = 100_000_000_000 * 10**DECIMALS; // 100B tokens
    
    // Faucet configuration
    uint256 public constant FAUCET_CLAIM_AMOUNT = 1000 * 10**DECIMALS; // 1000 vUSDC
    uint256 public constant FAUCET_COOLDOWN = 24 hours; // 24 hours cooldown
    uint256 public constant OWNER_CLAIM_AMOUNT = 10000 * 10**DECIMALS; // 10000 vUSDC for owner
    
    // Faucet state
    mapping(address => uint256) public lastFaucetClaim;
    uint256 public totalFaucetDistributed;
    uint256 public maxFaucetMintable;
    uint256 public currentFaucetMinted;
    
    // Events
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event FaucetClaimed(address indexed user, uint256 amount, uint256 nextClaimTime);
    event FaucetRefilled(uint256 amount);
    event MaxFaucetMintableUpdated(uint256 newMaxMintable);
    event EmergencyWithdraw(address indexed token, uint256 amount);
    
    // Constructor
    constructor(uint256 _maxFaucetMintable) 
        ERC20("Ventbuddy USDC", "vUSDC") 
        ERC20Permit("Ventbuddy USDC")
        Ownable(msg.sender) 
    {
        require(_maxFaucetMintable > 0, "Invalid max faucet mintable");
        
        maxFaucetMintable = _maxFaucetMintable;
        
        // Mint total supply to the deployer
        _mint(msg.sender, TOTAL_SUPPLY);
        emit TokensMinted(msg.sender, TOTAL_SUPPLY);
    }
    
    /**
     * @dev Returns the number of decimals used to get its user representation
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }
    
    /**
     * @dev Returns the total supply of tokens
     */
    function totalSupply() public pure override returns (uint256) {
        return TOTAL_SUPPLY;
    }
    
    /**
     * @dev Claim tokens from the faucet
     * @notice Anyone can claim 1000 vUSDC every 24 hours
     * @notice Owner can claim 10000 vUSDC without cooldown
     */
    function claimFromFaucet() external nonReentrant whenNotPaused {
        uint256 claimAmount = msg.sender == owner() ? OWNER_CLAIM_AMOUNT : FAUCET_CLAIM_AMOUNT;
        
        // Check cooldown for non-owner users
        if (msg.sender != owner()) {
            require(
                block.timestamp >= lastFaucetClaim[msg.sender] + FAUCET_COOLDOWN,
                "Faucet: Cooldown period not expired"
            );
        }
        
        // Check if we need to mint more tokens for the faucet
        uint256 contractBalance = balanceOf(address(this));
        if (contractBalance < claimAmount) {
            uint256 needed = claimAmount - contractBalance;
            require(
                currentFaucetMinted + needed <= maxFaucetMintable,
                "Faucet: Mint limit reached"
            );
            
            _mint(address(this), needed);
            currentFaucetMinted += needed;
            emit FaucetRefilled(needed);
        }
        
        // Transfer tokens to the user
        _transfer(address(this), msg.sender, claimAmount);
        
        // Update last claim time (only for non-owner users)
        if (msg.sender != owner()) {
            lastFaucetClaim[msg.sender] = block.timestamp;
        }
        
        // Update total distributed
        totalFaucetDistributed += claimAmount;
        
        emit FaucetClaimed(msg.sender, claimAmount, lastFaucetClaim[msg.sender] + FAUCET_COOLDOWN);
    }
    
    /**
     * @dev Refill the faucet with tokens (only owner)
     * @param amount Amount of tokens to mint and add to faucet
     */
    function refillFaucet(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(currentFaucetMinted + amount <= maxFaucetMintable, "Would exceed max faucet mintable");
        
        _mint(address(this), amount);
        currentFaucetMinted += amount;
        
        emit FaucetRefilled(amount);
    }
    
    /**
     * @dev Update the maximum faucet mintable supply (only owner)
     * @param newMaxMintable New maximum faucet mintable supply
     */
    function updateMaxFaucetMintable(uint256 newMaxMintable) external onlyOwner {
        require(newMaxMintable > currentFaucetMinted, "New max must be greater than current minted");
        
        maxFaucetMintable = newMaxMintable;
        emit MaxFaucetMintableUpdated(newMaxMintable);
    }
    
    /**
     * @dev Mint new tokens (only owner)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Mint to zero address");
        require(amount > 0, "Mint amount must be greater than 0");
        
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
    
    /**
     * @dev Burn tokens from caller's balance
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) public override {
        require(amount > 0, "Burn amount must be greater than 0");
        
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }
    
    /**
     * @dev Burn tokens from specified address (only owner)
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(address from, uint256 amount) public override {
        require(from != address(0), "Burn from zero address");
        require(amount > 0, "Burn amount must be greater than 0");
        
        _spendAllowance(from, msg.sender, amount);
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }
    
    /**
     * @dev Pause token transfers (only owner)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause token transfers (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Emergency withdraw function for any ERC20 tokens sent to this contract
     * @param token Address of the token to withdraw
     * @param amount Amount of tokens to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner nonReentrant {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");
        
        IERC20(token).transfer(owner(), amount);
        emit EmergencyWithdraw(token, amount);
    }
    
    /**
     * @dev Emergency withdraw function for ETH sent to this contract
     */
    function emergencyWithdrawETH() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "ETH transfer failed");
        
        emit EmergencyWithdraw(address(0), balance);
    }
    
    /**
     * @dev Batch transfer function for efficiency
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to transfer
     */
    function batchTransfer(address[] calldata recipients, uint256[] calldata amounts) external {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        require(recipients.length > 0, "Empty arrays");
        require(recipients.length <= 100, "Too many recipients");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Transfer to zero address");
            require(amounts[i] > 0, "Transfer amount must be greater than 0");
            
            _transfer(msg.sender, recipients[i], amounts[i]);
        }
    }
    
    /**
     * @dev Get user's faucet claim information
     * @param user Address to check
     * @return canClaim Whether user can claim now
     * @return nextClaimTime When user can claim next
     * @return timeUntilNextClaim Seconds until next claim
     */
    function getFaucetClaimInfo(address user) external view returns (
        bool canClaim,
        uint256 nextClaimTime,
        uint256 timeUntilNextClaim
    ) {
        if (user == owner()) {
            return (true, 0, 0);
        }
        
        nextClaimTime = lastFaucetClaim[user] + FAUCET_COOLDOWN;
        canClaim = block.timestamp >= nextClaimTime;
        timeUntilNextClaim = canClaim ? 0 : nextClaimTime - block.timestamp;
    }
    
    /**
     * @dev Get faucet statistics
     * @return faucetBalance Current faucet balance
     * @return totalDistributed Total tokens distributed by faucet
     * @return currentMinted Current minted supply by faucet
     * @return maxMintable Maximum mintable supply by faucet
     * @return remainingMintable Remaining mintable supply
     */
    function getFaucetStats() external view returns (
        uint256 faucetBalance,
        uint256 totalDistributed,
        uint256 currentMinted,
        uint256 maxMintable,
        uint256 remainingMintable
    ) {
        faucetBalance = balanceOf(address(this));
        totalDistributed = totalFaucetDistributed;
        currentMinted = currentFaucetMinted;
        maxMintable = maxFaucetMintable;
        remainingMintable = maxFaucetMintable - currentFaucetMinted;
    }
    
    /**
     * @dev Get claim amount for a specific user
     * @param user Address to check
     * @return amount Claim amount for the user
     */
    function getFaucetClaimAmount(address user) external view returns (uint256 amount) {
        return user == owner() ? OWNER_CLAIM_AMOUNT : FAUCET_CLAIM_AMOUNT;
    }
    
    /**
     * @dev Get token info
     * @return tokenName Token name
     * @return tokenSymbol Token symbol
     * @return tokenDecimals Token decimals
     * @return tokenTotalSupply Total supply
     */
    function getTokenInfo() external pure returns (
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        uint256 tokenTotalSupply
    ) {
        return ("Ventbuddy USDC", "vUSDC", DECIMALS, TOTAL_SUPPLY);
    }
    
    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
    
    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {
        // Accept ETH transfers
    }
    
    /**
     * @dev Fallback function
     */
    fallback() external payable {
        // Accept ETH transfers
    }
}
