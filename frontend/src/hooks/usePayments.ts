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
      }
    } catch (error) {
      setContract(null);
    }
  }, [isConnected, address]);

  useEffect(() => {
    initializeContract();
  }, [initializeContract]);

  const checkUserRegistration = useCallback(async (): Promise<boolean> => {
    if (!address) return false;
    
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('id, wallet_address, encrypted_address')
        .eq('wallet_address', address)
        .maybeSingle();

      if (error) {
        return false;
      }

      const isRegistered = !!data && !!data.encrypted_address;
      return isRegistered;
    } catch (error) {
      return false;
    }
  }, [address]);

  const checkPostExists = useCallback(async (postId: number): Promise<boolean> => {
    if (!contract) return false;
    
    try {
      const exists = await contract.postExists(postId);
      return exists;
    } catch (error) {
      return false;
    }
  }, [contract]);

  const waitForTransactionConfirmation = useCallback(async (txHash: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        timeout: 60000,
      });

      if (receipt.status === 'success') {
        return { success: true };
      } else {
        
        let errorMessage = 'Transaction was reverted by the smart contract.';
        
        if (contract) {
          try {
            const revertReason = await contract.getRevertReason(txHash);
            if (revertReason) {
              errorMessage = revertReason;
            }
          } catch (revertError) {
            // Silent fallback
          }
        }
        
        if (errorMessage === 'Transaction was reverted by the smart contract.') {
          if (receipt.logs && receipt.logs.length === 0) {
            errorMessage = 'Transaction reverted with no events. This usually means the contract logic failed (e.g., user not registered, insufficient funds, invalid parameters, or contract paused).';
          }
          
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
      let errorMsg = 'Failed to confirm transaction. Please check the transaction on a block explorer.';
      
      if (error.message?.includes('timeout')) {
        errorMsg = 'Transaction confirmation timed out. Please check the transaction on a block explorer.';
      } else if (error.message?.includes('revert')) {
        errorMsg = 'Transaction was reverted by the smart contract. This usually means the transaction failed due to contract logic (e.g., user not registered, insufficient funds, etc.).';
      }
      
      return { success: false, error: errorMsg };
    }
  }, [contract]);

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
      const isRegistered = await checkUserRegistration();
      if (!isRegistered) {
        const error = 'Wallet not registered. Please register your wallet first before tipping.';
        toast.error(error);
        return { txHash: '', success: false, error };
      }

      const txHash = await contract.tipPost(postIdNum, { value: amountInWei });
      
      const confirmation = await waitForTransactionConfirmation(txHash);
      
      if (confirmation.success) {
        const successMsg = `Successfully tipped ${amountInETH} ETH to the post creator!`;
        toast.success(successMsg);
        return { txHash, success: true };
      } else {
        toast.error(confirmation.error || 'Transaction failed');
        return { txHash, success: false, error: confirmation.error };
      }
    } catch (error: any) {
      let errorMsg = 'Failed to tip post. Please try again.';
      
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
      const isRegistered = await checkUserRegistration();
      if (!isRegistered) {
        const error = 'Wallet not registered. Please register your wallet first before tipping.';
        toast.error(error);
        return { txHash: '', success: false, error };
      }

      const txHash = await contract.tipReply(postIdNum, replyIdNum, { value: amountInWei });
      
      const confirmation = await waitForTransactionConfirmation(txHash);
      
      if (confirmation.success) {
        const successMsg = `Successfully tipped ${amountInETH} ETH to the reply author!`;
        toast.success(successMsg);
        return { txHash, success: true };
      } else {
        toast.error(confirmation.error || 'Transaction failed');
        return { txHash, success: false, error: confirmation.error };
      }
    } catch (error: any) {
      let errorMsg = 'Failed to tip reply. Please try again.';
      
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
      const isRegistered = await checkUserRegistration();
      if (!isRegistered) {
        const error = 'Wallet not registered. Please register your wallet first before unlocking content.';
        toast.error(error);
        return { txHash: '', success: false, error };
      }

      const txHash = await contract.unlockTippableContent(postIdNum, { value: amountInWei });
      
      const confirmation = await waitForTransactionConfirmation(txHash);
      
      if (confirmation.success) {
        const successMsg = `Successfully unlocked content with ${amountInETH} ETH tip!`;
        toast.success(successMsg);
        return { txHash, success: true };
      } else {
        toast.error(confirmation.error || 'Transaction failed');
        return { txHash, success: false, error: confirmation.error };
      }
    } catch (error: any) {
      let errorMsg = 'Failed to unlock content. Please try again.';
      
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

  const tipPostLegacy = useCallback(async (postId: string, amountInETH: number): Promise<string> => {
    const result = await tipPost(postId, amountInETH.toString());
    if (!result.success) {
      throw new Error(result.error || 'Tip failed');
    }
    return result.txHash;
  }, [tipPost]);

  const unlockContent = useCallback(async (postId: string, amountInETH: number): Promise<string> => {
    const result = await unlockTippableContent(postId, amountInETH.toString());
    if (!result.success) {
      throw new Error(result.error || 'Unlock failed');
    }
    return result.txHash;
  }, [unlockTippableContent]);

  return {
    tipPost,
    tipReply,
    unlockTippableContent,
    unlockContent,
    checkUserRegistration,
    checkPostExists,
    contract,
    isLoading,
    isConnected,
    address,
    formatEther,
    parseEther,
  };
};
