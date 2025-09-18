import { createPublicClient, http, type Address, encodeFunctionData, decodeEventLog } from 'viem';
import { encodeUnlockTippableContentCalldata, FHEEncryptionService } from './fhe-encryption';
import { sepolia } from 'viem/chains';
import { config } from './wagmi';
import { getWalletClient } from 'wagmi/actions';

// Import the actual ABI from the contract JSON
import VentbuddyABI from '../contract/Ventbuddy.json';

// Contract ABI - using the actual compiled contract ABI
export const VENTBUDDY_ABI = VentbuddyABI;

// Contract configuration
export const CONTRACT_CONFIG = {
  address: '0xC531862c0669E67c7B30eD72ED275364aD14395b' as Address, // 
  abi: VENTBUDDY_ABI,
};

// Network configuration
export const NETWORK_CONFIG = {
  chain: sepolia,
  rpcUrl: import.meta.env.VITE_RPC_URL || 'https://sepolia.infura.io/v3/8800e5d43f644529846d90ee5c29adcf',
};

// ETH Configuration (native currency)
export const ETH_CONFIG = {
  decimals: 18,
  symbol: 'ETH',
};

// Create clients
export const publicClient = createPublicClient({
  chain: NETWORK_CONFIG.chain,
  transport: http(NETWORK_CONFIG.rpcUrl),
});

// Create a regular public client for non-FHE operations (ETH balance checks, etc.)
export const regularPublicClient = createPublicClient({
  chain: NETWORK_CONFIG.chain,
  transport: http(NETWORK_CONFIG.rpcUrl),
});

// Get wallet client from wagmi
export const getWalletClientFromWagmi = async () => {
  const walletClient = await getWalletClient(config);
  return walletClient;
};

// FHE Contract class for ETH-only operations
export class VentbuddyContract {
  private walletClient: any;
  private fheService: FHEEncryptionService;

  constructor(walletClient?: any) {
    this.walletClient = walletClient;
    this.fheService = new FHEEncryptionService();
  }

  /**
   * Tip a post with ETH using plain post ID
   */
  async tipPost(postId: number, options?: { value?: bigint }) {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized');
    }
    
    if (!postId || postId <= 0) {
      throw new Error('Valid post ID is required');
    }

    if (!options?.value || options.value <= 0n) {
      throw new Error('ETH amount must be greater than 0');
    }

    console.log('💰 ETH tipPost call with plain ID:', {
      postId,
      value: options.value.toString(),
      valueInETH: Number(options.value) / 1e18
    });

    // SIMPLE TIPPING: No FHE initialization needed
    console.log('💰 Using simple tipping (no FHE operations)');

    // Pass the plain post ID to the smart contract
    return await this.walletClient.writeContract({
      ...CONTRACT_CONFIG,
      functionName: 'tipPost',
      args: [postId],
      value: options.value,
    });
  }

  /**
   * Tip a reply with ETH using plain post and reply IDs
   */
  async tipReply(postId: number, replyId: number, options?: { value?: bigint }) {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized');
    }

    if (!postId || postId <= 0) {
      throw new Error('Valid post ID is required');
    }

    if (!replyId || replyId <= 0) {
      throw new Error('Valid reply ID is required');
    }

    if (!options?.value || options.value <= 0n) {
      throw new Error('ETH amount must be greater than 0');
    }

    console.log('💰 ETH tipReply call with plain IDs:', {
      postId,
      replyId,
      value: options.value.toString(),
      valueInETH: Number(options.value) / 1e18
    });

    // SIMPLE TIPPING: No FHE initialization needed
    console.log('💰 Using simple tipping (no FHE operations)');

    return await this.walletClient.writeContract({
      ...CONTRACT_CONFIG,
      functionName: 'tipReply',
      args: [postId, replyId],
      value: options.value,
    });
  }

  /**
   * Unlock tippable content with ETH using plain post ID
   */
  async unlockTippableContent(postId: number, options?: { value?: bigint }) {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized');
    }

    if (!postId || postId <= 0) {
      throw new Error('Valid post ID is required');
    }

    if (!options?.value || options.value <= 0n) {
      throw new Error('ETH amount must be greater than 0');
    }

    console.log('🔓 ETH unlockTippableContent call with plain ID:', {
      postId,
      value: options.value.toString(),
      valueInETH: Number(options.value) / 1e18
    });

    // SIMPLE TIPPING: No FHE initialization needed
    console.log('💰 Using simple tipping (no FHE operations)');

    return await this.walletClient.writeContract({
      ...CONTRACT_CONFIG,
      functionName: 'unlockTippableContent',
      args: [postId],
      value: options.value,
    });
  }

  /**
   * Claim ETH earnings
   */
  async claimEarnings(amount: bigint) {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized');
    }

    if (!amount || amount <= 0n) {
      throw new Error('Claim amount must be greater than 0');
    }

    console.log('💰 ETH claimEarnings call:', {
      amount: amount.toString(),
      amountInETH: Number(amount) / 1e18
    });

    return await this.walletClient.writeContract({
      ...CONTRACT_CONFIG,
      functionName: 'claimEarnings',
      args: [amount],
    });
  }

  /**
   * Create a post with FHE encryption
   */
  async createPost(postData: {
    contentHash: `0x${string}`;
    previewHash: `0x${string}`;
    supabaseId: string;
    encryptedVisibility: `0x${string}`;
    visibilityProof: `0x${string}`;
    minTipAmount: number;
  }) {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized');
    }

    console.log('📝 Creating post with FHE encryption:', {
      contentHash: postData.contentHash.substring(0, 20) + '...',
      previewHash: postData.previewHash.substring(0, 20) + '...',
      supabaseId: postData.supabaseId,
      minTipAmount: postData.minTipAmount
    });

    // Send the transaction
    const txHash = await this.walletClient.writeContract({
      ...CONTRACT_CONFIG,
      functionName: 'createPost',
      args: [
        postData.contentHash,
        postData.previewHash,
        postData.supabaseId,
        postData.encryptedVisibility,
        postData.visibilityProof,
        postData.minTipAmount
      ],
    });

    console.log('📝 Transaction sent, waiting for confirmation:', txHash);

    // Create a public client to wait for transaction receipt
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http()
    });

    // Wait for transaction to be mined
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    console.log('✅ Transaction confirmed:', receipt);

    // Parse the PostCreated event to get the plain post ID
    let postId: number | undefined;
    let author: string | undefined;
    let visibility: string | undefined;

    try {
      // Look for the PostCreated event in the transaction logs
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: CONTRACT_CONFIG.abi,
            data: log.data,
            topics: (log as any).topics || [],
          });

          if (decoded.eventName === 'PostCreated') {
            // The event now emits plain uint64 postId
            const args = decoded.args as any;
            postId = Number(args.postId);
            author = args.author;
            visibility = args.visibility;
            
            console.log('✅ PostCreated event parsed:', {
              postId,
              author: author?.substring(0, 20) + '...',
              visibility: visibility?.substring(0, 20) + '...'
            });
            break;
          }
        } catch (decodeError) {
          // Skip logs that can't be decoded
          continue;
        }
      }
    } catch (eventError) {
      console.warn('⚠️ Failed to parse PostCreated event:', eventError);
    }

    // If we couldn't parse the event, use a fallback approach
    if (!postId) {
      console.warn('⚠️ Could not parse post ID from event, using fallback generation');
      
      // Generate a unique post ID based on transaction hash and block number
      const blockNumber = receipt.blockNumber.toString();
      const txIndex = receipt.transactionIndex.toString();
      const hashSuffix = txHash.slice(-8); // Last 8 characters of tx hash
      
      // Create a unique identifier that can be used as the post ID
      const fallbackPostId = parseInt(`${blockNumber}${txIndex}${hashSuffix}`, 16) % 1000000;
      
      console.log('⚠️ Using fallback post ID generation:', {
        fallbackPostId,
        blockNumber,
        txIndex,
        hashSuffix,
        txHash
      });
      
      postId = fallbackPostId;
    }
    
    return {
      txHash,
      rawPostId: postId, // Use the plain post ID
      encryptedPostId: postId, // For backward compatibility
      author,
      visibility
    };
  }

  /**
   * Reply to a post with FHE encryption
   */
  async replyToPost(replyData: {
    postId: number;
    contentHash: `0x${string}`;
    previewHash: `0x${string}`;
    supabaseId: string;
    encryptedVisibility: `0x${string}`;
    visibilityProof: `0x${string}`;
    minTipAmount: number;
  }) {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized');
    }

    console.log('💬 Creating reply with FHE encryption:', {
      postId: replyData.postId,
      contentHash: replyData.contentHash.substring(0, 20) + '...',
      previewHash: replyData.previewHash.substring(0, 20) + '...',
      supabaseId: replyData.supabaseId,
      minTipAmount: replyData.minTipAmount
    });

    return await this.walletClient.writeContract({
      ...CONTRACT_CONFIG,
      functionName: 'replyToPost',
      args: [
        replyData.postId,
        replyData.contentHash,
        replyData.previewHash,
        replyData.supabaseId,
        replyData.encryptedVisibility,
        replyData.visibilityProof,
        replyData.minTipAmount
      ],
    });
  }

  /**
   * Register a user with FHE encryption
   */
  async registerUser(encryptedAddress: `0x${string}`, addressProof: `0x${string}`) {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized');
    }

    console.log('👤 Registering user with FHE encryption:', {
      encryptedAddress: encryptedAddress.substring(0, 20) + '...',
      proofLength: addressProof.length
    });

    return await this.walletClient.writeContract({
      ...CONTRACT_CONFIG,
      functionName: 'registerUser',
      args: [encryptedAddress, addressProof],
    });
  }


  /**
   * Try to decode revert reason from a failed transaction
   */
  async getRevertReason(txHash: string): Promise<string | null> {
    try {
      // Get the transaction to see if there's revert data
      const tx = await publicClient.getTransaction({
        hash: txHash as `0x${string}`,
      });
      
      console.log('Transaction details for revert analysis:', tx);
      
      // Try to simulate the transaction to get revert reason
      try {
        await publicClient.call({
          to: tx.to,
          data: tx.input,
          value: tx.value,
        });
      } catch (simulationError: any) {
        console.log('Simulation error (this is expected for reverts):', simulationError);
        
        // Try to extract revert reason from error message
        const errorMessage = simulationError.message || simulationError.toString();
        
        // Common revert reason patterns
        if (errorMessage.includes('User not registered')) {
          return 'User not registered in the contract';
        } else if (errorMessage.includes('Post does not exist') || errorMessage.includes('contentHash != bytes32(0)')) {
          return 'Post does not exist on the contract';
        } else if (errorMessage.includes('No zero tips')) {
          return 'Tip amount must be greater than 0';
        } else if (errorMessage.includes('Tip amount below minimum required')) {
          return 'Tip amount is below the minimum required';
        } else if (errorMessage.includes('insufficient funds')) {
          return 'Insufficient ETH balance';
        } else if (errorMessage.includes('Pausable: paused')) {
          return 'Contract is paused';
        } else if (errorMessage.includes('ReentrancyGuard')) {
          return 'Reentrancy protection triggered';
        } else if (errorMessage.includes('Tip amount too large')) {
          return 'Tip amount is too large';
        }
        
        return errorMessage;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting revert reason:', error);
      return null;
    }
  }

  /**
   * Check if a post exists by reading its content hash
   */
  async postExists(postId: number): Promise<boolean> {
    try {
      // Use the FHE public client for FHE contract calls
      const result = await publicClient.readContract({
        address: CONTRACT_CONFIG.address,
        abi: CONTRACT_CONFIG.abi,
        functionName: 'posts',
        args: [postId],
        authorizationList: [], // Required for FHE contracts
      });
      
      // Check if the content hash is not empty (indicating post exists)
      const postData = result as any;
      const contentHash = postData[0]; // First element is contentHash
      const exists = contentHash && contentHash !== '0x0000000000000000000000000000000000000000000000000000000000000000';
      
      console.log('Post existence check:', { postId, exists, contentHash });
      return exists;
    } catch (error) {
      console.error('Error checking post existence:', error);
      
      // If the contract call fails, we can't determine if the post exists
      // For now, let's assume it exists and let the transaction handle the validation
      console.log('Post existence check failed, assuming post exists and letting transaction handle validation');
      return true;
    }
  }

  /**
   * Get user's ETH balance
   */
  async getBalance(userAddress: Address): Promise<bigint> {
    // For now, return 0 - we'll implement this when we have the correct ABI
    console.log('Getting balance for:', userAddress);
    return 0n;
  }

  /**
   * Get contract's ETH balance
   */
  async getContractBalance(): Promise<bigint> {
    // For now, return 0 - we'll implement this when we have the correct ABI
    console.log('Getting contract balance');
    return 0n;
  }

  /**
   * Get earnings statistics
   */
  async getEarningsStats(): Promise<{ totalEarnings: bigint; totalFees: bigint }> {
    // For now, return zeros - we'll implement this when we have the correct ABI
    console.log('Getting earnings stats');
    return { totalEarnings: 0n, totalFees: 0n };
  }

  /**
   * Get DAO statistics
   */
  async getDAOStats(): Promise<{ feesCollected: bigint; earningsDistributed: bigint; feeRate: bigint }> {
    // For now, return zeros - we'll implement this when we have the correct ABI
    console.log('Getting DAO stats');
    return { feesCollected: 0n, earningsDistributed: 0n, feeRate: 0n };
  }
}