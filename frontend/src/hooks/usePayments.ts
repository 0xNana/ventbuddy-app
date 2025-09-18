import { useState, useCallback, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { toast } from 'sonner';
import { VentbuddyContract, getWalletClientFromWagmi, publicClient } from '@/lib/contract';
import { supabase } from '@/lib/supabase';

export interface PaymentResult {
  txHash: string;
  success: boolean;
  error?: string;
}

export const usePayments = () => {
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [contract, setContract] = useState<VentbuddyContract | null>(null);

  // Initialize contract when wallet connects
  const initializeContract = useCallback(async () => {
    if (!isConnected || !address) {
      setContract(null);
      return;
    }

    try {
      const walletClient = await getWalletClientFromWagmi();
      if (walletClient) {
        const contractInstance = new VentbuddyContract(walletClient);
        setContract(contractInstance);
        console.log('✅ Payment contract initialized for address:', address);
      }
    } catch (error) {
      console.error('❌ Failed to initialize payment contract:', error);
      setContract(null);
    }
  }, [isConnected, address]);

  // Initialize contract on mount and when wallet changes
  useEffect(() => {
    initializeContract();
  }, [initializeContract]);

  /**
   * Check if user is registered by looking up their session in Supabase
   */
  const checkUserRegistration = useCallback(async (): Promise<boolean> => {
    if (!address) return false;
    
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('id, wallet_address, encrypted_address')
        .eq('wallet_address', address)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - user not registered
          console.log('User not registered in Supabase:', { address });
          return false;
        }
        console.error('Error checking user registration in Supabase:', error);
        return false;
      }

      const isRegistered = !!data && !!data.encrypted_address;
      console.log('User registration status from Supabase:', { 
        address, 
        isRegistered, 
        hasEncryptedAddress: !!data?.encrypted_address 
      });
      return isRegistered;
    } catch (error) {
      console.error('Error checking user registration:', error);
      return false;
    }
  }, [address]);

  /**
   * Check if a post exists on the contract
   */
  const checkPostExists = useCallback(async (postId: number): Promise<boolean> => {
    if (!contract) return false;
    
    try {
      const exists = await contract.postExists(postId);
      console.log('Post existence check from hook:', { postId, exists });
      return exists;
    } catch (error) {
      console.error('Error checking post existence:', error);
      return false;
    }
  }, [contract]);

  /**
   * Wait for transaction confirmation and check for reverts
   */
  const waitForTransactionConfirmation = useCallback(async (txHash: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('⏳ Waiting for transaction confirmation:', txHash);
      
      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        timeout: 60000, // 60 second timeout
      });

      console.log('📋 Transaction receipt:', receipt);

      // Check if transaction was successful
      if (receipt.status === 'success') {
        console.log('✅ Transaction confirmed successfully');
        return { success: true };
      } else {
        console.error('❌ Transaction reverted:', receipt);
        
        // Try to get the specific revert reason
        let errorMessage = 'Transaction was reverted by the smart contract.';
        
        if (contract) {
          try {
            const revertReason = await contract.getRevertReason(txHash);
            if (revertReason) {
              errorMessage = revertReason;
            }
          } catch (revertError) {
            console.error('Error getting revert reason:', revertError);
          }
        }
        
        // Fallback analysis if we couldn't get specific revert reason
        if (errorMessage === 'Transaction was reverted by the smart contract.') {
          // Check if there are any logs that might indicate the reason
          if (receipt.logs && receipt.logs.length === 0) {
            errorMessage = 'Transaction reverted with no events. This usually means the contract logic failed (e.g., user not registered, insufficient funds, invalid parameters, or contract paused).';
          }
          
          // Check gas usage to see if it was a simple revert vs complex failure
          if (receipt.gasUsed < 100000n) {
            errorMessage += ' The low gas usage suggests a simple revert condition was triggered.';
          }
        }
        
        return { 
          success: false, 
          error: errorMessage
        };
      }
    } catch (error: any) {
      console.error('❌ Error waiting for transaction confirmation:', error);
      
      let errorMsg = 'Failed to confirm transaction. Please check the transaction on a block explorer.';
      
      if (error.message?.includes('timeout')) {
        errorMsg = 'Transaction confirmation timed out. Please check the transaction on a block explorer.';
      } else if (error.message?.includes('revert')) {
        errorMsg = 'Transaction was reverted by the smart contract. This usually means the transaction failed due to contract logic (e.g., user not registered, insufficient funds, etc.).';
      }
      
      return { success: false, error: errorMsg };
    }
  }, [contract]);

  /**
   * Tip a post with ETH
   * @param postId - The post ID to tip
   * @param amountInETH - The tip amount in ETH (as string or number)
   * @returns Promise<PaymentResult>
   */
  const tipPost = useCallback(async (postId: string | number, amountInETH: string | number): Promise<PaymentResult> => {
    if (!isConnected || !address) {
      const error = 'Please connect your wallet to tip posts';
      toast.error(error);
      return { txHash: '', success: false, error };
    }

    if (!contract) {
      const error = 'Payment contract not initialized. Please try reconnecting your wallet.';
      toast.error(error);
      return { txHash: '', success: false, error };
    }

    const postIdNum = typeof postId === 'string' ? parseInt(postId, 10) : postId;
    if (isNaN(postIdNum) || postIdNum <= 0) {
      const error = 'Invalid post ID';
      toast.error(error);
      return { txHash: '', success: false, error };
    }

    let amountInWei: bigint;
    try {
      // Convert ETH amount to wei
      amountInWei = parseEther(amountInETH.toString());
      if (amountInWei <= 0n) {
        throw new Error('Amount must be greater than 0');
      }
    } catch (error) {
      const errorMsg = 'Invalid tip amount. Please enter a valid ETH amount.';
      toast.error(errorMsg);
      return { txHash: '', success: false, error: errorMsg };
    }

    setIsLoading(true);
    
    try {
      // Check if user is registered before attempting transaction
      const isRegistered = await checkUserRegistration();
      if (!isRegistered) {
        const error = 'Wallet not registered. Please register your wallet first before tipping.';
        toast.error(error);
        return { txHash: '', success: false, error };
      }

      // Note: Post existence check removed due to FHE contract call issues
      // The smart contract will handle post existence validation and revert with clear error if post doesn't exist

      console.log('💰 Tipping post:', {
        postId: postIdNum,
        amountInETH: amountInETH.toString(),
        amountInWei: amountInWei.toString(),
        userAddress: address,
        isRegistered: true,
        contractAddress: '0xC531862c0669E67c7B30eD72ED275364aD14395b'
      });

      const txHash = await contract.tipPost(postIdNum, { value: amountInWei });
      
      console.log('📤 Tip post transaction sent:', txHash);
      
      // Wait for transaction confirmation
      const confirmation = await waitForTransactionConfirmation(txHash);
      
      if (confirmation.success) {
        console.log('✅ Tip post transaction confirmed successfully');
        const successMsg = `Successfully tipped ${amountInETH} ETH to the post creator!`;
        toast.success(successMsg);
        return { txHash, success: true };
      } else {
        console.error('❌ Tip post transaction failed:', confirmation.error);
        toast.error(confirmation.error || 'Transaction failed');
        return { txHash, success: false, error: confirmation.error };
      }
    } catch (error: any) {
      console.error('❌ Tip post failed:', error);
      
      let errorMsg = 'Failed to tip post. Please try again.';
      
      // Handle specific error cases
      if (error?.message?.includes('User not registered')) {
        errorMsg = 'Please register your wallet first before tipping.';
      } else if (error?.message?.includes('Post does not exist')) {
        errorMsg = 'This post no longer exists.';
      } else if (error?.message?.includes('No zero tips')) {
        errorMsg = 'Tip amount must be greater than 0.';
      } else if (error?.message?.includes('insufficient funds')) {
        errorMsg = 'Insufficient ETH balance for this tip.';
      } else if (error?.message?.includes('user rejected')) {
        errorMsg = 'Transaction was cancelled by user.';
        return { txHash: '', success: false, error: errorMsg };
      }
      
      toast.error(errorMsg);
      return { txHash: '', success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address, contract, checkUserRegistration, waitForTransactionConfirmation]);

  /**
   * Tip a reply with ETH
   * @param postId - The post ID that contains the reply
   * @param replyId - The reply ID to tip
   * @param amountInETH - The tip amount in ETH (as string or number)
   * @returns Promise<PaymentResult>
   */
  const tipReply = useCallback(async (postId: string | number, replyId: string | number, amountInETH: string | number): Promise<PaymentResult> => {
    if (!isConnected || !address) {
      const error = 'Please connect your wallet to tip replies';
      toast.error(error);
      return { txHash: '', success: false, error };
    }

    if (!contract) {
      const error = 'Payment contract not initialized. Please try reconnecting your wallet.';
      toast.error(error);
      return { txHash: '', success: false, error };
    }

    const postIdNum = typeof postId === 'string' ? parseInt(postId, 10) : postId;
    const replyIdNum = typeof replyId === 'string' ? parseInt(replyId, 10) : replyId;
    
    if (isNaN(postIdNum) || postIdNum <= 0) {
      const error = 'Invalid post ID';
      toast.error(error);
      return { txHash: '', success: false, error };
    }
    
    if (isNaN(replyIdNum) || replyIdNum <= 0) {
      const error = 'Invalid reply ID';
      toast.error(error);
      return { txHash: '', success: false, error };
    }

    let amountInWei: bigint;
    try {
      // Convert ETH amount to wei
      amountInWei = parseEther(amountInETH.toString());
      if (amountInWei <= 0n) {
        throw new Error('Amount must be greater than 0');
      }
    } catch (error) {
      const errorMsg = 'Invalid tip amount. Please enter a valid ETH amount.';
      toast.error(errorMsg);
      return { txHash: '', success: false, error: errorMsg };
    }

    setIsLoading(true);
    
    try {
      // Check if user is registered before attempting transaction
      const isRegistered = await checkUserRegistration();
      if (!isRegistered) {
        const error = 'Wallet not registered. Please register your wallet first before tipping.';
        toast.error(error);
        return { txHash: '', success: false, error };
      }

      console.log('💰 Tipping reply:', {
        postId: postIdNum,
        replyId: replyIdNum,
        amountInETH: amountInETH.toString(),
        amountInWei: amountInWei.toString(),
        userAddress: address,
        isRegistered: true
      });

      const txHash = await contract.tipReply(postIdNum, replyIdNum, { value: amountInWei });
      
      console.log('📤 Tip reply transaction sent:', txHash);
      
      // Wait for transaction confirmation
      const confirmation = await waitForTransactionConfirmation(txHash);
      
      if (confirmation.success) {
        console.log('✅ Tip reply transaction confirmed successfully');
        const successMsg = `Successfully tipped ${amountInETH} ETH to the reply author!`;
        toast.success(successMsg);
        return { txHash, success: true };
      } else {
        console.error('❌ Tip reply transaction failed:', confirmation.error);
        toast.error(confirmation.error || 'Transaction failed');
        return { txHash, success: false, error: confirmation.error };
      }
    } catch (error: any) {
      console.error('❌ Tip reply failed:', error);
      
      let errorMsg = 'Failed to tip reply. Please try again.';
      
      // Handle specific error cases
      if (error?.message?.includes('User not registered')) {
        errorMsg = 'Please register your wallet first before tipping.';
      } else if (error?.message?.includes('Reply does not exist')) {
        errorMsg = 'This reply no longer exists.';
      } else if (error?.message?.includes('No zero tips')) {
        errorMsg = 'Tip amount must be greater than 0.';
      } else if (error?.message?.includes('insufficient funds')) {
        errorMsg = 'Insufficient ETH balance for this tip.';
      } else if (error?.message?.includes('user rejected')) {
        errorMsg = 'Transaction was cancelled by user.';
        return { txHash: '', success: false, error: errorMsg };
      }
      
      toast.error(errorMsg);
      return { txHash: '', success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address, contract, checkUserRegistration, waitForTransactionConfirmation]);

  /**
   * Unlock tippable content with ETH
   * @param postId - The post ID to unlock
   * @param amountInETH - The tip amount in ETH (as string or number)
   * @returns Promise<PaymentResult>
   */
  const unlockTippableContent = useCallback(async (postId: string | number, amountInETH: string | number): Promise<PaymentResult> => {
    if (!isConnected || !address) {
      const error = 'Please connect your wallet to unlock content';
      toast.error(error);
      return { txHash: '', success: false, error };
    }

    if (!contract) {
      const error = 'Payment contract not initialized. Please try reconnecting your wallet.';
      toast.error(error);
      return { txHash: '', success: false, error };
    }

    const postIdNum = typeof postId === 'string' ? parseInt(postId, 10) : postId;
    if (isNaN(postIdNum) || postIdNum <= 0) {
      const error = 'Invalid post ID';
      toast.error(error);
      return { txHash: '', success: false, error };
    }

    let amountInWei: bigint;
    try {
      // Convert ETH amount to wei
      amountInWei = parseEther(amountInETH.toString());
      if (amountInWei <= 0n) {
        throw new Error('Amount must be greater than 0');
      }
    } catch (error) {
      const errorMsg = 'Invalid unlock amount. Please enter a valid ETH amount.';
      toast.error(errorMsg);
      return { txHash: '', success: false, error: errorMsg };
    }

    setIsLoading(true);
    
    try {
      // Check if user is registered before attempting transaction
      const isRegistered = await checkUserRegistration();
      if (!isRegistered) {
        const error = 'Wallet not registered. Please register your wallet first before unlocking content.';
        toast.error(error);
        return { txHash: '', success: false, error };
      }

      console.log('🔓 Unlocking tippable content:', {
        postId: postIdNum,
        amountInETH: amountInETH.toString(),
        amountInWei: amountInWei.toString(),
        userAddress: address,
        isRegistered: true
      });

      const txHash = await contract.unlockTippableContent(postIdNum, { value: amountInWei });
      
      console.log('📤 Unlock content transaction sent:', txHash);
      
      // Wait for transaction confirmation
      const confirmation = await waitForTransactionConfirmation(txHash);
      
      if (confirmation.success) {
        console.log('✅ Unlock content transaction confirmed successfully');
        const successMsg = `Successfully unlocked content with ${amountInETH} ETH tip!`;
        toast.success(successMsg);
        return { txHash, success: true };
      } else {
        console.error('❌ Unlock content transaction failed:', confirmation.error);
        toast.error(confirmation.error || 'Transaction failed');
        return { txHash, success: false, error: confirmation.error };
      }
    } catch (error: any) {
      console.error('❌ Unlock content failed:', error);
      
      let errorMsg = 'Failed to unlock content. Please try again.';
      
      // Handle specific error cases
      if (error?.message?.includes('User not registered')) {
        errorMsg = 'Please register your wallet first before unlocking content.';
      } else if (error?.message?.includes('Post does not exist')) {
        errorMsg = 'This post no longer exists.';
      } else if (error?.message?.includes('No zero tips')) {
        errorMsg = 'Unlock amount must be greater than 0.';
      } else if (error?.message?.includes('Tip amount below minimum required')) {
        errorMsg = 'Tip amount is below the minimum required to unlock this content.';
      } else if (error?.message?.includes('insufficient funds')) {
        errorMsg = 'Insufficient ETH balance to unlock this content.';
      } else if (error?.message?.includes('user rejected')) {
        errorMsg = 'Transaction was cancelled by user.';
        return { txHash: '', success: false, error: errorMsg };
      }
      
      toast.error(errorMsg);
      return { txHash: '', success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address, contract, checkUserRegistration, waitForTransactionConfirmation]);

  /**
   * Legacy function for backward compatibility with VentCard
   * @param postId - The post ID to tip
   * @param amountInETH - The tip amount in ETH
   * @returns Promise<string> - Transaction hash
   */
  const tipPostLegacy = useCallback(async (postId: string, amountInETH: number): Promise<string> => {
    const result = await tipPost(postId, amountInETH.toString());
    if (!result.success) {
      throw new Error(result.error || 'Tip failed');
    }
    return result.txHash;
  }, [tipPost]);

  /**
   * Legacy function for backward compatibility with VentCard
   * @param postId - The post ID to unlock
   * @param amountInETH - The unlock amount in ETH
   * @returns Promise<string> - Transaction hash
   */
  const unlockContent = useCallback(async (postId: string, amountInETH: number): Promise<string> => {
    const result = await unlockTippableContent(postId, amountInETH.toString());
    if (!result.success) {
      throw new Error(result.error || 'Unlock failed');
    }
    return result.txHash;
  }, [unlockTippableContent]);

  return {
    // Main functions
    tipPost, // Use the main function, not legacy
    tipReply,
    unlockTippableContent,
    unlockContent,
    
    // Utility functions
    checkUserRegistration,
    checkPostExists,
    contract, // Expose the contract instance for direct access
    
    // State
    isLoading,
    isConnected,
    address,
    
    // Utility functions
    formatEther,
    parseEther,
  };
};
