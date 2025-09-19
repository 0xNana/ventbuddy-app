import { createPublicClient, http, type Address, decodeEventLog } from 'viem';
import { sepolia } from 'viem/chains';
import { config } from './wagmi';
import { getWalletClient } from 'wagmi/actions';

const createLogger = (context: string) => ({
  info: (message: string, data?: any) => {
    console.log(`[${context}] ${message}`, data || '');
  },
  debug: (message: string, data?: any) => {
    console.debug(`[${context}] ${message}`, data || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[${context}] ${message}`, data || '');
  },
  error: (message: string, data?: any) => {
    console.error(`[${context}] ${message}`, data || '');
  }
});


import VentbuddyABI from '../contract/Ventbuddy.json';  
export const VENTBUDDY_ABI = VentbuddyABI;

export const CONTRACT_CONFIG = {
  address: '0xC531862c0669E67c7B30eD72ED275364aD14395b' as Address, // 
  abi: VENTBUDDY_ABI,
};

export const NETWORK_CONFIG = {
  chain: sepolia,
  rpcUrl: import.meta.env.VITE_RPC_URL || 'https://sepolia.infura.io/v3/8800e5d43f644529846d90ee5c29adcf',
};

export const ETH_CONFIG = {
  decimals: 18,
  symbol: 'ETH',
};

export const publicClient = createPublicClient({
  chain: NETWORK_CONFIG.chain,
  transport: http(NETWORK_CONFIG.rpcUrl),
});

export const regularPublicClient = createPublicClient({
  chain: NETWORK_CONFIG.chain,
  transport: http(NETWORK_CONFIG.rpcUrl),
});

export const getWalletClientFromWagmi = async () => {
  const walletClient = await getWalletClient(config);
  return walletClient;
};

export class VentbuddyContract {
  private walletClient: any;
  private log = createLogger('VentbuddyContract');

  constructor(walletClient?: any) {
    this.walletClient = walletClient;
  }

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


    return await this.walletClient.writeContract({
      ...CONTRACT_CONFIG,
      functionName: 'tipPost',
      args: [postId],
      value: options.value,
    });
  }

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


    return await this.walletClient.writeContract({
      ...CONTRACT_CONFIG,
      functionName: 'tipReply',
      args: [postId, replyId],
      value: options.value,
    });
  }

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


    return await this.walletClient.writeContract({
      ...CONTRACT_CONFIG,
      functionName: 'unlockTippableContent',
      args: [postId],
      value: options.value,
    });
  }

  async claimEarnings(amount: bigint) {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized');
    }

    if (!amount || amount <= 0n) {
      throw new Error('Claim amount must be greater than 0');
    }


    return await this.walletClient.writeContract({
      ...CONTRACT_CONFIG,
      functionName: 'claimEarnings',
      args: [amount],
    });
  }

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


    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http()
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });


    let postId: number | undefined;
    let author: string | undefined;
    let visibility: string | undefined;

    try {
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: CONTRACT_CONFIG.abi,
            data: log.data,
            topics: (log as any).topics || [],
          });

          if (decoded.eventName === 'PostCreated') {
            const args = decoded.args as any;
            postId = Number(args.postId);
            author = args.author;
            visibility = args.visibility;
            
            break;
          }
        } catch (decodeError) {
          continue;
        }
      }
    } catch (eventError) {
      console.warn('⚠️ Failed to parse PostCreated event:', eventError);
    }

    if (!postId) {
      console.warn('⚠️ Could not parse post ID from event, using fallback generation');
      
      const blockNumber = receipt.blockNumber.toString();
      const txIndex = receipt.transactionIndex.toString();
      const hashSuffix = txHash.slice(-8); // Last 8 characters of tx hash
      
      const fallbackPostId = parseInt(`${blockNumber}${txIndex}${hashSuffix}`, 16) % 1000000;
      
      
      postId = fallbackPostId;
    }
    
    return {
      txHash,
      rawPostId: postId,
      encryptedPostId: postId,
      author,
      visibility
    };
  }

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

  async registerUser(encryptedAddress: `0x${string}`, addressProof: `0x${string}`) {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized');
    }


    return await this.walletClient.writeContract({
      ...CONTRACT_CONFIG,
      functionName: 'registerUser',
      args: [encryptedAddress, addressProof],
    });
  }


  async getRevertReason(txHash: string): Promise<string | null> {
    try {
      const tx = await publicClient.getTransaction({
        hash: txHash as `0x${string}`,
      });
      
      
      try {
        await publicClient.call({
          to: tx.to,
          data: tx.input,
          value: tx.value,
        });
      } catch (simulationError: any) {
        
        const errorMessage = simulationError.message || simulationError.toString();
        
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

  async postExists(postId: number): Promise<boolean> {
    try {
      const result = await publicClient.readContract({
        address: CONTRACT_CONFIG.address,
        abi: CONTRACT_CONFIG.abi,
        functionName: 'posts',
        args: [postId],
        authorizationList: [],
      });
      
      const postData = result as any;
      const contentHash = postData[0];
      const exists = contentHash && contentHash !== '0x0000000000000000000000000000000000000000000000000000000000000000';
      
      return exists;
    } catch (error) {
      console.error('Error checking post existence:', error);
      
      return true;
    }
  }

  async getBalance(userAddress: Address): Promise<bigint> {
    return 0n;
  }

  async getContractBalance(): Promise<bigint> {
    return 0n;
  }

  async getEarningsStats(): Promise<{ totalEarnings: bigint; totalFees: bigint }> {
    return { totalEarnings: 0n, totalFees: 0n };
  }

  async getDAOStats(): Promise<{ feesCollected: bigint; earningsDistributed: bigint; feeRate: bigint }> {
    return { feesCollected: 0n, earningsDistributed: 0n, feeRate: 0n };
  }
}