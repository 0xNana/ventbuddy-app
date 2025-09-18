import { useState, useEffect, useCallback } from 'react';
import { useAccount, useConnect, useDisconnect, useWalletClient } from 'wagmi';
import { getWalletClientFromWagmi, VentbuddyContract } from '../lib/contract';
import { supabase, type EncryptedContent } from '../lib/supabase';
import { fheEncryptionService } from '../lib/fhe-encryption';
import { ensureSepoliaNetwork, getCurrentNetwork, onNetworkChange } from '../lib/network-utils';
import { useLogger } from './useLogger';

export function useWallet() {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  const log = useLogger('useWallet');
  const [networkInfo, setNetworkInfo] = useState<{
    chainId: string;
    chainName: string;
    isSepolia: boolean;
  } | null>(null);

  const connectWallet = useCallback(async () => {
    log.trace('connectWallet');
    try {
      // Use the first available connector
      const targetConnector = connectors[0];
      
      if (targetConnector) {
        log.info('Connecting wallet', { connector: targetConnector.name });
        await connect({ connector: targetConnector });
        
        // Wait a moment for the connection to establish
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Ensure we're on the Sepolia network
        log.info('Ensuring Sepolia network');
        await ensureSepoliaNetwork();
        
        log.info('Wallet connected and network verified');
      }
    } catch (error) {
      log.error('Wallet connection failed', error);
      throw error;
    } finally {
      log.traceExit('connectWallet');
    }
  }, [connect, connectors, log]);

  const getWalletClient = useCallback(async () => {
    if (walletClient) return walletClient;
    return await getWalletClientFromWagmi();
  }, [walletClient]);

  // Monitor network changes
  useEffect(() => {
    if (!isConnected) {
      // Defer state update to avoid setState during render
      setTimeout(() => setNetworkInfo(null), 0);
      return;
    }

    const updateNetworkInfo = async () => {
      try {
        const info = await getCurrentNetwork();
        setNetworkInfo(info);
        log.debug('Network info updated', info);
      } catch (error) {
        log.error('Failed to get network info', error);
      }
    };

    // Initial network check - defer to avoid setState during render
    setTimeout(updateNetworkInfo, 0);

    // Listen for network changes
    const cleanup = onNetworkChange(() => {
      updateNetworkInfo();
    });

    return cleanup;
  }, [isConnected]);

  return {
    address,
    isConnected,
    connector,
    connectWallet,
    disconnect,
    isPending,
    walletClient,
    getWalletClient,
    networkInfo,
  };
}

export function useUserRegistration() {
  const { address, isConnected, connector } = useAccount();
  const { walletClient } = useWallet();
  const log = useLogger('useUserRegistration');
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debug connection status
  useEffect(() => {
    log.debug('Wallet connection status', {
      address,
      isConnected,
      connector: connector?.name,
      connectorId: connector?.id,
      walletClient: !!walletClient
    });
  }, [address, isConnected, connector, walletClient, log]);

  const registerUser = useCallback(async (userAddress?: string) => {
    log.trace('registerUser');
    if (!isConnected || !address) {
      setError('Wallet not connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use the provided address or the connected wallet address
      const targetAddress = userAddress || address;
      
      // Generate proper FHE-encrypted address and proof using enhanced FHE service
      log.info('Generating FHE-encrypted address for registration');
      const { encryptedAddress, proof } = await fheEncryptionService.encryptAddress(targetAddress, targetAddress);
      
      log.info('FHE Registration data generated', {
        originalAddress: targetAddress,
        encryptedAddress: encryptedAddress.substring(0, 20) + '...',
        proof: proof.substring(0, 20) + '...',
        connector: connector?.name,
        fheServiceReady: fheEncryptionService.isReady()
      });
      
      let txHash: string;
      
      // Use optimized registration approach to reduce RPC calls
      try {
        // Use generic contract service for all wallets
        log.info('Using optimized contract service registration');
        const contractService = new VentbuddyContract(walletClient);
        const result = await contractService.registerUser(
          encryptedAddress as `0x${string}`, 
          proof as `0x${string}`
        );
        txHash = result;
        log.info('Registration successful', { txHash: result });
        
      } catch (contractError: any) {
        log.warn('Contract registration error', contractError);
        
        // Enhanced error analysis
        const errorMessage = contractError.message || contractError.toString() || '';
        const errorCode = contractError.code || '';
        const errorData = contractError.data || '';
        
        log.debug('Contract error analysis', {
          message: errorMessage,
          code: errorCode,
          data: errorData,
          fullError: contractError
        });
        
        // Check if user is already registered
        const isAlreadyRegistered = 
          errorMessage.includes('User already registered') || 
          errorMessage.includes('0xb9688461') ||
          errorMessage.includes('already registered') ||
          errorMessage.includes('UserAlreadyRegistered') ||
          errorCode === '0xb9688461' ||
          errorData.includes('0xb9688461');
          
        // Check for simulation/execution errors that might indicate already registered
        const isSimulationError = 
          errorMessage.includes('simulating the action') ||
          errorMessage.includes('executing calls') ||
          errorMessage.includes('Review action') ||
          errorMessage.includes('Error') ||
          errorMessage.includes('0xb9688461');
          
        if (isAlreadyRegistered || isSimulationError) {
          log.info('User already registered in contract, proceeding to Supabase sync');
          log.debug('Error details', { errorMessage, errorCode, errorData, isAlreadyRegistered, isSimulationError });
          txHash = 'already_registered';
        } else {
          log.error('Unexpected contract error', contractError);
          throw contractError; // Re-throw other contract errors
        }
      }
      
      // 3. Store user registration data in Supabase (regardless of contract registration status)
      const { contentStorage } = await import('../lib/supabase');
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        await contentStorage.createUserSession(
          address,
          encryptedAddress,
          sessionToken
        );
        log.info('User registration stored in Supabase successfully');
      } catch (supabaseError) {
        log.warn('Supabase storage failed, but registration will continue', supabaseError);
        // Don't throw error - registration can still succeed even if Supabase fails
      }
      
      setIsRegistered(true);
      return txHash;
    } catch (err: any) {
      log.error('Registration error details', err);
      
      // Check if this is a "User already registered" error at the top level
      const errorMessage = err.message || err.toString() || '';
      if (errorMessage.includes('0xb9688461') || 
          errorMessage.includes('User already registered') ||
          errorMessage.includes('simulating the action') ||
          errorMessage.includes('executing calls')) {
        
        log.info('User already registered - syncing to Supabase only');
        
        // Store in Supabase even if contract registration fails
        try {
          const { contentStorage } = await import('../lib/supabase');
          const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Re-generate encrypted address for Supabase sync
          const { encryptedAddress: syncEncryptedAddress } = await fheEncryptionService.encryptAddress(address!, address!);
          
          await contentStorage.createUserSession(
            address!,
            syncEncryptedAddress,
            sessionToken
          );
          log.info('User registration stored in Supabase successfully');
          
          setIsRegistered(true);
          return 'already_registered';
        } catch (supabaseError) {
          log.error('Supabase sync failed', supabaseError);
          setError('Registration failed - please try again');
          throw err;
        }
      }
      
      // Provide more specific error messages
      let userFriendlyError = 'Registration failed';
      if (errorMessage.includes('429') || errorMessage.includes('Too Many Requests')) {
        userFriendlyError = 'Rate limit exceeded. Please wait a moment and try again.';
      } else if (errorMessage.includes('insufficient funds')) {
        userFriendlyError = 'Not enough ETH for gas fees. Registration is free but requires ~0.001 ETH for gas. Please add more ETH to your wallet.';
      } else if (errorMessage.includes('User rejected')) {
        userFriendlyError = 'Registration cancelled by user.';
      } else if (errorMessage.includes('disconnected')) {
        userFriendlyError = 'Wallet disconnected. Please reconnect and try again.';
      } else if (errorMessage.includes('network')) {
        userFriendlyError = 'Network error. Please check your connection and try again.';
      } else if (errorMessage.includes('Review action') || errorMessage.includes('simulating the action')) {
        userFriendlyError = 'Registration simulation failed. This usually means you are already registered. Please try refreshing the page.';
      } else if (errorMessage.includes('0xb9688461')) {
        userFriendlyError = 'You are already registered! Please refresh the page to continue.';
      }
      
      setError(userFriendlyError);
      throw err;
    } finally {
      setIsLoading(false);
      log.traceExit('registerUser');
    }
  }, [walletClient, isConnected, address, connector, log]);

  return {
    isRegistered,
    isLoading,
    error,
    registerUser,
  };
}


/**
 * Hook to check user registration status from Supabase ONLY
 * No contract queries - purely Supabase-based
 */
export function useRegistrationStatus() {
  const { address, isConnected } = useAccount();
  const log = useLogger('useRegistrationStatus');
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkRegistrationStatus = async () => {
      if (!address) {
        // Defer state update to avoid setState during render
        setTimeout(() => setIsRegistered(null), 0);
        return;
      }

      // Only check registration status if wallet is properly connected
      if (!isConnected) {
        // Defer state update to avoid setState during render
        setTimeout(() => setIsRegistered(false), 0);
        return;
      }

      // Defer state update to avoid setState during render
      setTimeout(() => setIsLoading(true), 0);
      
      try {
        const { contentStorage } = await import('../lib/supabase');
        const userSession = await contentStorage.getUserSession(address);
        setIsRegistered(!!userSession);
        log.debug('Registration status check', { address, isRegistered: !!userSession });
      } catch (error) {
        log.error('Error checking registration status', error);
        setIsRegistered(false);
      } finally {
        setIsLoading(false);
      }
    };

    // Defer the entire check to avoid setState during render
    setTimeout(checkRegistrationStatus, 0);
  }, [address, isConnected]);

  return { isRegistered, isLoading };
}

/**
 * Hook for creating posts with FHE encryption
 */
export function useCreatePost() {
  const { address } = useAccount();
  const { walletClient } = useWallet();
  const log = useLogger('useCreatePost');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPost = useCallback(async (
    content: string,
    visibility: number,
    minTipAmount: number
  ) => {
    if (!walletClient || !address) {
      setError('Wallet not connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      log.trace('createPost');
      log.info('Starting post creation process', {
        content: content.substring(0, 50) + '...',
        visibility,
        minTipAmount
      });

      // 0. Ensure FHE service is ready BEFORE starting
      log.info('Step 0: Ensuring FHE service is ready');
      const { fheEncryptionService } = await import('../lib/fhe-encryption');
      
      const isFHEReady = await fheEncryptionService.isFullyReady();
      if (!isFHEReady) {
        throw new Error('FHE encryption service is not ready. Please ensure you are connected to Sepolia network and try again.');
      }
      
      log.info('FHE service is ready, proceeding with post creation');

      // 1. Encrypt content (but don't store yet - we need the encrypted post ID first)
      log.info('Step 1: Encrypting content');
      const { contentEncryptionService } = await import('../lib/content-encryption');
      
      // Create preview (first 100 characters)
      const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
      
      // Generate hashes and encrypt content (but don't store in DB yet)
      const contentHash = await contentEncryptionService.generateHash(content);
      const previewHash = await contentEncryptionService.generateHash(preview);
      const encryptedContent = contentEncryptionService.encryptContent(content);
      const encryptedPreview = contentEncryptionService.encryptContent(preview);

      log.info('Content encrypted', {
        contentHash: contentHash.substring(0, 20) + '...',
        previewHash: previewHash.substring(0, 20) + '...',
        encryptedContentLength: encryptedContent.length,
        encryptedPreviewLength: encryptedPreview.length
      });

      // 2. Encrypt visibility using FHE
      
      // Only encrypt the visibility (0=Public, 1=Tippable)
      const visibilityEncryption = await fheEncryptionService.encryptNumber(visibility, address);

      log.info('FHE encryption completed', {
        visibility: visibilityEncryption.encryptedValue.substring(0, 20) + '...',
        proofLength: visibilityEncryption.proof.length
      });

      // 3. Prepare contract data
      log.info('Step 3: Preparing contract data');
      const { VentbuddyContract } = await import('../lib/contract');
      
      // Use the content hash as the primary identifier for the contract
      // This ensures the post ID is deterministic and based on the actual content
      const contractSupabaseId = contentHash; // Use content hash as the identifier
      
      const postData = {
        contentHash: contentHash as `0x${string}`,
        previewHash: previewHash as `0x${string}`,
        supabaseId: contractSupabaseId,
        encryptedVisibility: visibilityEncryption.encryptedValue as `0x${string}`,
        visibilityProof: visibilityEncryption.proof as `0x${string}`,
        minTipAmount: minTipAmount, // Convert to wei (18 decimals for ETH)
      };

      log.info('Contract data prepared', {
        contentHash: postData.contentHash.substring(0, 20) + '...',
        previewHash: postData.previewHash.substring(0, 20) + '...',
        supabaseId: postData.supabaseId,
        hasEncryptedVisibility: !!postData.encryptedVisibility,
        hasVisibilityProof: !!postData.visibilityProof,
        minTipAmount: postData.minTipAmount
      });
      
      log.debug('Full contract data for post creation', {
        contentHash: postData.contentHash,
        previewHash: postData.previewHash,
        supabaseId: postData.supabaseId,
        encryptedVisibility: postData.encryptedVisibility.substring(0, 20) + '...',
        visibilityProof: postData.visibilityProof.substring(0, 20) + '...',
        minTipAmount: postData.minTipAmount
      });

      // 4. Call smart contract
      log.info('Step 4: Calling smart contract');
      const contract = new VentbuddyContract(walletClient);
      const { txHash, encryptedPostId, rawPostId } = await contract.createPost(postData);

      log.info('Post created successfully', {
        txHash,
        encryptedPostId,
        rawPostId
      });

      // 5. Store content in Supabase with the raw post ID
      log.info('Step 5: Storing content in Supabase with raw post ID');
      const { contentStorage } = await import('../lib/supabase');
      const storedContent =         await contentStorage.storeEncryptedContent(
          contentHash,
          previewHash,
          encryptedContent,
          encryptedPreview,
          address,
          minTipAmount,
          rawPostId, // Store the plain post ID as number
          rawPostId.toString() // Use plain post ID as string for legacy field
        );

      log.info('Content stored in Supabase', {
        supabaseId: storedContent.id,
        encryptedPostId: encryptedPostId,
        contentHash: storedContent.content_hash.substring(0, 20) + '...',
        previewHash: storedContent.preview_hash.substring(0, 20) + '...'
      });

      // 6. Log visibility event to Supabase with raw post ID
      try {
        if (rawPostId !== undefined) {
          const { visibilityManager } = await import('../lib/visibility-manager');
          await visibilityManager.logVisibilityEvent({
            postId: rawPostId.toString(), // Use raw post ID from smart contract
            contentType: 'post',
            visibilityType: visibility,
            eventType: 'created',
            userAddress: address,
            encryptedVisibility: postData.encryptedVisibility,
            contentHash: storedContent.content_hash,
            previewHash: storedContent.preview_hash,
            supabaseId: storedContent.id.toString()
          });
        } else {
          log.warn('Skipping visibility event logging - rawPostId is undefined');
        }
      } catch (visibilityError) {
        log.warn('Failed to log visibility event', visibilityError);
        // Don't throw error - post creation was successful
      }

      return {
        txHash,
        encryptedPostId,
        rawPostId,
        contentData: {
          id: storedContent.id.toString(),
          contentHash: storedContent.content_hash,
          previewHash: storedContent.preview_hash
        }
      };
    } catch (err: any) {
      log.error('Post creation failed', err);
      
      // Provide more specific error messages
      let userFriendlyError = 'Post creation failed';
      const errorMessage = err.message || err.toString() || '';
      
      if (errorMessage.includes('FHE encryption service is not ready')) {
        userFriendlyError = 'FHE encryption service is not ready. Please ensure you are connected to Sepolia network and try again.';
      } else if (errorMessage.includes('FHE service not ready')) {
        userFriendlyError = 'FHE encryption service not ready. Please ensure wallet is connected to Sepolia network.';
      } else if (errorMessage.includes('encryption module not available')) {
        userFriendlyError = 'Encryption module not available. Please check your FHEVM Gateway configuration.';
      } else if (errorMessage.includes('insufficient funds')) {
        userFriendlyError = 'Not enough ETH for gas fees. Please add more ETH to your wallet.';
      } else if (errorMessage.includes('User rejected')) {
        userFriendlyError = 'Post creation cancelled by user.';
      } else if (errorMessage.includes('disconnected')) {
        userFriendlyError = 'Wallet disconnected. Please reconnect and try again.';
      } else if (errorMessage.includes('network')) {
        userFriendlyError = 'Network error. Please check your connection and try again.';
      } else if (errorMessage.includes('User not registered')) {
        userFriendlyError = 'User not registered. Please register your wallet first.';
      }
      
      setError(userFriendlyError);
      throw err;
    } finally {
      setIsLoading(false);
      log.traceExit('createPost');
    }
  }, [walletClient, address, log]);

  return {
    createPost,
    isLoading,
    error,
  };
}

/**
 * Hook for creating replies with FHE encryption
 */
export function useCreateReply() {
  const { address } = useAccount();
  const { walletClient } = useWallet();
  const log = useLogger('useCreateReply');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createReply = useCallback(async (
    postId: number,
    content: string,
    visibility: number,
    unlockPrice: number
  ) => {
    if (!walletClient || !address) {
      setError('Wallet not connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      log.trace('createReply');
      log.info('Starting reply creation process', {
        postId,
        content: content.substring(0, 50) + '...',
        visibility,
        unlockPrice
      });

      // 1. Encrypt and store content in Supabase
      log.info('Step 1: Encrypting and storing reply content');
      const { contentEncryptionService } = await import('../lib/content-encryption');
      const { fheEncryptionService } = await import('../lib/fhe-encryption');
      
      // Create preview (first 100 characters)
      const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
      
      // For replies, we need to get the next reply ID
      // For now, we'll use a simple timestamp-based ID
      const replyId = Math.floor(Date.now() / 1000) % 1000000; // Simple ID generation
      
      const contentData = await contentEncryptionService.encryptAndStoreReply(
        postId,
        replyId,
        content,
        preview,
        address, // Use wallet address as replier ID for now
        address
      );

      log.info('Reply content encrypted and stored', {
        contentHash: contentData.contentHash.substring(0, 20) + '...',
        previewHash: contentData.previewHash.substring(0, 20) + '...',
        supabaseId: contentData.supabaseId
      });

      // 2. Encrypt reply parameters using FHE
      log.info('Step 2: Encrypting reply parameters with FHE');
      
      const [
        visibilityEncryption,
        unlockPriceEncryption
      ] = await Promise.all([
        fheEncryptionService.encryptNumber(visibility, address),
        fheEncryptionService.encryptNumber(unlockPrice, address)
      ]);

      log.info('FHE encryption completed', {
        visibility: visibilityEncryption.encryptedValue.substring(0, 20) + '...',
        unlockPrice: unlockPriceEncryption.encryptedValue.substring(0, 20) + '...'
      });

      // 3. Prepare contract data
      log.info('Step 3: Preparing contract data');
      const { VentbuddyContract } = await import('../lib/contract');
      
      const replyData = {
        postId: postId, // Use plain post ID
        contentHash: contentData.contentHash as `0x${string}`,
        previewHash: contentData.previewHash as `0x${string}`,
        supabaseId: contentData.supabaseId,
        encryptedVisibility: visibilityEncryption.encryptedValue as `0x${string}`,
        visibilityProof: visibilityEncryption.proof as `0x${string}`,
        minTipAmount: unlockPrice, // Use unlockPrice directly as minTipAmount
      };

      log.info('Contract data prepared', {
        postId: replyData.postId,
        contentHash: replyData.contentHash.substring(0, 20) + '...',
        previewHash: replyData.previewHash.substring(0, 20) + '...',
        supabaseId: replyData.supabaseId,
        hasEncryptedVisibility: !!replyData.encryptedVisibility,
        minTipAmount: replyData.minTipAmount
      });

      // 4. Call smart contract
      log.info('Step 4: Calling smart contract');
      const contract = new VentbuddyContract(walletClient);
      const txHash = await contract.replyToPost({
        postId: replyData.postId,
        contentHash: replyData.contentHash,
        previewHash: replyData.previewHash,
        supabaseId: replyData.supabaseId,
        encryptedVisibility: replyData.encryptedVisibility,
        visibilityProof: replyData.visibilityProof,
        minTipAmount: replyData.minTipAmount
      });

      log.info('Reply created successfully', {
        txHash,
        contentData: {
          id: contentData.supabaseId,
          contentHash: contentData.contentHash,
          previewHash: contentData.previewHash
        }
      });

      // 5. Log visibility event to Supabase
      try {
        const { visibilityManager } = await import('../lib/visibility-manager');
        await visibilityManager.logVisibilityEvent({
          postId: postId,
          replyId: replyId,
          contentType: 'reply',
          visibilityType: visibility,
          eventType: 'created',
          userAddress: address,
          encryptedVisibility: replyData.encryptedVisibility,
          // Note: encryptedUnlockPrice is stored in encrypted_content table, not visibility_events
          contentHash: contentData.contentHash,
          previewHash: contentData.previewHash,
          supabaseId: contentData.supabaseId
        });
      } catch (visibilityError) {
        log.info('Failed to log reply visibility event', visibilityError);
        // Don't throw error - reply creation was successful
      }

      return {
        txHash,
        contentData: {
          id: contentData.supabaseId,
          contentHash: contentData.contentHash,
          previewHash: contentData.previewHash
        }
      };
    } catch (err: any) {
      log.error('Reply creation failed', err);
      
      // Provide more specific error messages
      let userFriendlyError = 'Reply creation failed';
      const errorMessage = err.message || err.toString() || '';
      
      if (errorMessage.includes('FHE service not ready')) {
        userFriendlyError = 'FHE encryption service not ready. Please ensure wallet is connected to Sepolia network.';
      } else if (errorMessage.includes('encryption module not available')) {
        userFriendlyError = 'Encryption module not available. Please check your FHEVM Gateway configuration.';
      } else if (errorMessage.includes('insufficient funds')) {
        userFriendlyError = 'Not enough ETH for gas fees. Please add more ETH to your wallet.';
      } else if (errorMessage.includes('User rejected')) {
        userFriendlyError = 'Reply creation cancelled by user.';
      } else if (errorMessage.includes('disconnected')) {
        userFriendlyError = 'Wallet disconnected. Please reconnect and try again.';
      } else if (errorMessage.includes('network')) {
        userFriendlyError = 'Network error. Please check your connection and try again.';
      } else if (errorMessage.includes('User not registered')) {
        userFriendlyError = 'User not registered. Please register your wallet first.';
      }
      
      setError(userFriendlyError);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address]);

  return {
    createReply,
    isLoading,
    error,
  };
}

/**
 * Hook for tipping posts and replies
 */
export function useTipping() {
  const { address } = useAccount();
  const { walletClient } = useWallet();
  const log = useLogger('useTipping');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tipPost = useCallback(async (postId: number, amount: number) => {
    if (!walletClient || !address) {
      setError('Wallet not connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      log.info('Starting tip process for post', { postId, amount });
      
      // 1. Prepare contract data
      const contract = new (await import('../lib/contract')).VentbuddyContract(walletClient);
      
      log.info('Calling smart contract for tip');
      const txHash = await contract.tipPost(postId, { value: BigInt(Math.floor(amount * 1e18)) });
      
      log.info('Tip transaction successful', { txHash });
      
      // Log tip access
      const { contentStorage } = await import('../lib/supabase');
      await contentStorage.logAccess(
        postId.toString(), // Use plain post ID as string
        'post',
        address,
        'tip',
        amount
      );

      return txHash;
    } catch (err) {
      log.info('Tip failed', err);
      setError(err instanceof Error ? err.message : 'Failed to tip post');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address]);

  const tipReply = useCallback(async (postId: number, replyId: number, amount: number) => {
    if (!walletClient || !address) {
      setError('Wallet not connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      log.info('Starting tip process for reply', { postId, replyId, amount });
      
      // 1. Prepare contract data
      const contract = new (await import('../lib/contract')).VentbuddyContract(walletClient);
      
      log.info('Calling smart contract for reply tip');
      const txHash = await contract.tipReply(
        postId, 
        replyId, 
        { value: BigInt(Math.floor(amount * 1e18)) }
      );
      
      log.info('Reply tip transaction successful', { txHash });
      
      // Log tip access
      const { contentStorage } = await import('../lib/supabase');
      await contentStorage.logAccess(
        replyId.toString(),
        'reply',
        address,
        'tip',
        amount
      );

      return txHash;
    } catch (err) {
      log.info('Reply tip failed', err);
      setError(err instanceof Error ? err.message : 'Failed to tip reply');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address]);

  const unlockContent = useCallback(async (postId: number, amount: number) => {
    if (!walletClient || !address) {
      setError('Wallet not connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      log.info('Starting content unlock process for post', { postId, amount });
      
      // 1. Prepare contract data
      const contract = new (await import('../lib/contract')).VentbuddyContract(walletClient);
      
      log.info('Calling smart contract for content unlock');
      const txHash = await contract.unlockTippableContent(postId, { value: BigInt(Math.floor(amount * 1e18)) });
      
      log.info('Content unlock transaction successful', { txHash });
      
      // Log unlock access
      const { contentStorage } = await import('../lib/supabase');
      await contentStorage.logAccess(
        postId.toString(),
        'post',
        address,
        'unlock',
        amount
      );

      // Log visibility unlock event
      try {
        const { visibilityManager } = await import('../lib/visibility-manager');
        await visibilityManager.logVisibilityEvent({
          postId: postId.toString(),
          contentType: 'post',
          visibilityType: 1, // Mark as public/unlocked
          eventType: 'unlocked',
          userAddress: address,
          contentHash: '0x', // We don't have this in unlock context
          previewHash: '0x',
          supabaseId: postId.toString()
        });
      } catch (visibilityError) {
        log.info('Failed to log unlock visibility event', visibilityError);
      }

      return txHash;
    } catch (err) {
      log.error('Content unlock failed', err);
      setError(err instanceof Error ? err.message : 'Failed to unlock content');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [walletClient, address]);

  return {
    tipPost,
    tipReply,
    unlockContent,
    isLoading,
    error,
  };
}

/**
 * Hook for subscriptions
 */

/**
 * Hook for reading contract data - DISABLED to avoid rate limiting
 * All contract read operations have been removed
 */
export function useContractData() {
  const log = useLogger('useContractData');
  const [contractInfo, setContractInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContractInfo = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // No contract queries - return default values
      const defaultInfo = {
        feeRecipient: '0x0000000000000000000000000000000000000000',
        feeBasisPoints: 1000, // 10% default
        currency: 'ETH', // Native ETH
        owner: '0xB9554026d4BF82C35e01241CC7a3706EaB91D788',
        paused: false,
      };
      
      setContractInfo(defaultInfo);
    } catch (err) {
      log.info('Contract info fetch failed', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch contract info');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContractInfo();
  }, [fetchContractInfo]);

  return {
    contractInfo,
    isLoading,
    error,
    refetch: fetchContractInfo,
  };
}

/**
 * Hook for fetching and managing posts from Supabase
 */
export function usePosts() {
  const { address } = useAccount();
  const log = useLogger('usePosts');
  const [posts, setPosts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      log.info('Fetching posts from Supabase');
      const { contentStorage } = await import('../lib/supabase');
      
      // Fetch recent content from Supabase
      const encryptedContent = await contentStorage.getRecentContent(20);
      
      log.info('Fetched encrypted content', { count: encryptedContent.length });

      // Decrypt content for display
      const { contentEncryptionService } = await import('../lib/content-encryption');
      
      // Get engagement stats and visibility data for all posts
      // Use raw_post_id for engagement stats (they're stored by raw_post_id)
      const rawPostIds = encryptedContent.map(content => content.raw_post_id).filter(Boolean);
      
      // Fetch engagement stats from Supabase
      const { data: engagementStats, error: statsError } = await supabase
        .from('post_stats')
        .select('*')
        .in('raw_post_id', rawPostIds);

      if (statsError) {
        log.error('Error fetching engagement stats', statsError);
      }

      // Fetch visibility data from Supabase
      // Use encrypted_post_id for all queries since post_id column no longer exists
      const encryptedPostIds = encryptedContent.map(c => c.encrypted_post_id).filter(Boolean);
      
      log.debug('Encrypted post IDs from content', { encryptedPostIds });
      
      let visibilityQuery = supabase
        .from('visibility_events')
        .select('*');
      
      // Only query by encrypted_post_id since post_id column doesn't exist
      if (encryptedPostIds.length > 0) {
        visibilityQuery = visibilityQuery.in('encrypted_post_id', encryptedPostIds);
      } else {
        // If no encrypted_post_ids, return empty result
        visibilityQuery = visibilityQuery.eq('encrypted_post_id', 'nonexistent');
      }
      
      const { data: visibilityData, error: visibilityError } = await visibilityQuery
        .order('created_at', { ascending: false });

      if (visibilityError) {
        log.error('Error fetching visibility data', visibilityError);
      }
      
      log.debug('Visibility data fetched', {
        totalEvents: visibilityData?.length || 0,
        events: visibilityData?.map(e => ({
          encrypted_post_id: e.encrypted_post_id,
          visibility_type: e.visibility_type,
          content_type: e.content_type
        }))
      });
      
      // DEBUG: Check if any visibility events exist at all
      const { data: allVisibilityEvents, error: allEventsError } = await supabase
        .from('visibility_events')
        .select('encrypted_post_id, visibility_type, content_type, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
        
      log.debug('All recent visibility events', {
        total: allVisibilityEvents?.length || 0,
        events: allVisibilityEvents
      });
      
      const decryptedPosts = await Promise.all(
        encryptedContent.map(async (content) => {
          try {
            // Decrypt the content
            const { content: decryptedContent, preview: decryptedPreview } = 
              await contentEncryptionService.decryptPostContent(content.id.toString());
            
            // Find engagement stats for this post
            const postStats = engagementStats?.find(stat => stat.raw_post_id === content.raw_post_id);
            
            // Find visibility data for this post (get the latest event)
            // Only check encrypted_post_id since post_id column no longer exists
            const postVisibilityEvents = visibilityData?.filter(event => 
              content.encrypted_post_id && event.encrypted_post_id === content.encrypted_post_id
            );
            const latestVisibilityEvent = postVisibilityEvents?.[0]; // Already ordered by created_at desc
            
            // DEBUG: Log visibility event data
            log.debug('Post visibility data', {
              postId: content.id,
              encryptedPostId: content.encrypted_post_id,
              hasEncryptedPostId: !!content.encrypted_post_id,
              postVisibilityEvents: postVisibilityEvents,
              latestVisibilityEvent: latestVisibilityEvent,
              visibilityType: latestVisibilityEvent?.visibility_type,
              isLocked: latestVisibilityEvent?.visibility_type === 1
            });
            
            // DEBUG: If no visibility events found, check if any exist for this specific ID
            if (!postVisibilityEvents || postVisibilityEvents.length === 0) {
              log.debug('No visibility events found for this content. Checking if any exist at all');
              
              // Check if there are any visibility events for this specific encrypted_post_id
              const { data: specificEvents, error: specificError } = await supabase
                .from('visibility_events')
                .select('*')
                .eq('encrypted_post_id', content.encrypted_post_id);
                
              log.debug('Specific visibility events for this ID', {
                encryptedPostId: content.encrypted_post_id,
                events: specificEvents,
                error: specificError
              });
            }
            
            // Calculate engagement-based ranking score
            // Priority: Replies > Upvotes > Downvotes (like X/Twitter algorithm)
            const replyCount = postStats?.reply_count || 0;
            const upvoteCount = postStats?.upvote_count || 0;
            const downvoteCount = postStats?.downvote_count || 0;
            
            // Ranking algorithm: Weighted score for content relevance
            // Replies get highest weight (discussion = engagement)
            // Upvotes get medium weight (approval)
            // Downvotes get negative weight (disapproval)
            const rankingScore = (replyCount * 10) + (upvoteCount * 3) - (downvoteCount * 1);
            
            // Calculate net score (upvotes - downvotes) for backward compatibility
            const netScore = upvoteCount - downvoteCount;
            
            // Determine if content should be locked based on visibility
            const visibility = latestVisibilityEvent?.visibility_type ?? 0; // Default to public
            const isLocked = visibility === 1; // 1 = Tippable (locked), 0 = Public (unlocked)
            
            // ARCHITECTURE FIX: Read min_tip_amount from encrypted_content table (immutable metadata)
            // instead of visibility_events table (payment tracking)
            const minTipAmount = (content as EncryptedContent & { min_tip_amount?: number }).min_tip_amount || 0;
            
            // TEMPORARY FIX: If no visibility event exists but content has min_tip_amount > 0,
            // assume it should be tippable (locked)
            const shouldBeLocked = isLocked || (minTipAmount > 0 && !latestVisibilityEvent);
            
            if (minTipAmount > 0 && !latestVisibilityEvent) {
              log.debug('TEMPORARY FIX: Content has min_tip_amount but no visibility event. Assuming tippable');
            }
            
            // Format for VentCard component
            // CRITICAL: Use the actual raw_post_id from the database
            // This is the encrypted post ID that the smart contract expects
            if (!content.raw_post_id) {
              log.error('Missing raw_post_id for post', { postId: content.id, message: 'Cannot use this post for smart contract operations!' });
              // Skip this post entirely if raw_post_id is missing
              return null;
            }
            
            return {
              rawPostId: content.raw_post_id, // Use actual plain post ID from database
              author: 'Anon', // Author is encrypted, show as Anon
              content: decryptedContent,
              preview: decryptedPreview,
              isLocked: shouldBeLocked,
              tipAmount: minTipAmount, // Use actual min tip amount
              likes: netScore, // Use net score as likes for now
              comments: postStats?.reply_count || 0,
              timestamp: new Date(content.created_at).toLocaleString(),
              isPremium: false, // Mock premium status for now
              contentHash: content.content_hash,
              previewHash: content.preview_hash,
              authorId: content.author_id,
              createdAt: content.created_at,
              updatedAt: content.updated_at,
              minTipAmount: minTipAmount, // Use actual min tip amount
              visibility: shouldBeLocked ? 1 : 0, // 1 = Tippable (locked), 0 = Public (unlocked)
              visibilityEvent: latestVisibilityEvent, // Include full visibility event data
              supabaseId: content.id.toString(), // Keep Supabase ID for engagement operations (fallback only)
              // Engagement metrics for ranking
              rankingScore: rankingScore,
              upvoteCount: upvoteCount,
              downvoteCount: downvoteCount,
              replyCount: replyCount
            };
          } catch (decryptError) {
            log.warn('Failed to decrypt content for post', { postId: content.id, error: decryptError });
            // Return a fallback post if decryption fails
            // Only check encrypted_post_id for fallback since post_id column no longer exists
            const fallbackVisibilityEvents = visibilityData?.filter(event => 
              content.encrypted_post_id && event.encrypted_post_id === content.encrypted_post_id
            );
            const fallbackLatestEvent = fallbackVisibilityEvents?.[0];
            const fallbackVisibility = fallbackLatestEvent?.visibility_type ?? 0;
            
            log.debug('Fallback visibility data', {
              postId: content.id,
              encryptedPostId: content.encrypted_post_id,
              fallbackVisibilityEvents: fallbackVisibilityEvents,
              fallbackLatestEvent: fallbackLatestEvent,
              fallbackVisibility: fallbackVisibility,
              isLocked: fallbackVisibility === 1
            });
            const fallbackMinTipAmount = (content as EncryptedContent & { min_tip_amount?: number }).min_tip_amount || 0;
            
            // Apply same logic as main case: if no visibility event but has min_tip_amount, assume tippable
            const fallbackShouldBeLocked = (fallbackVisibility === 1) || (fallbackMinTipAmount > 0 && !fallbackLatestEvent);
            
            // CRITICAL: Use the actual raw_post_id from the database
            if (!content.raw_post_id) {
              log.error('Missing raw_post_id for fallback post', { postId: content.id, message: 'Cannot use this post for smart contract operations!' });
              // Skip this post entirely if raw_post_id is missing
              return null;
            }
            
            return {
              rawPostId: content.raw_post_id, // Use actual plain post ID from database
              author: 'Anon',
              content: 'This content could not be decrypted.',
              preview: 'This content could not be decrypted.',
              isLocked: fallbackShouldBeLocked,
              tipAmount: fallbackMinTipAmount,
              likes: 0,
              comments: 0,
              timestamp: new Date(content.created_at).toLocaleString(),
              isPremium: false,
              contentHash: content.content_hash,
              previewHash: content.preview_hash,
              authorId: content.author_id,
              createdAt: content.created_at,
              updatedAt: content.updated_at,
              minTipAmount: fallbackMinTipAmount,
              visibility: fallbackShouldBeLocked ? 1 : 0, // 1 = Tippable (locked), 0 = Public (unlocked)
              decryptError: true,
              supabaseId: content.id.toString(), // Keep Supabase ID for engagement operations
              encryptedPostId: content.encrypted_post_id // Include legacy encrypted post ID
            };
          }
        })
      );

      log.info('Decrypted posts', { count: decryptedPosts.length });
      
      // Filter out posts without raw_post_id and sort by ranking score
      const validPosts = decryptedPosts.filter(post => post !== null);
      
      // Sort posts by ranking score (highest first) - like X/Twitter algorithm
      const sortedPosts = validPosts.sort((a, b) => {
        // Primary sort: ranking score (replies > upvotes > downvotes)
        if (b.rankingScore !== a.rankingScore) {
          return b.rankingScore - a.rankingScore;
        }
        
        // Secondary sort: creation time (newer posts first if same ranking)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      log.info('Posts sorted by ranking algorithm', { 
        count: sortedPosts.length,
        topPosts: sortedPosts.slice(0, 3).map(p => ({
          rawPostId: p.rawPostId,
          rankingScore: p.rankingScore,
          replies: p.replyCount,
          upvotes: p.upvoteCount,
          downvotes: p.downvoteCount
        }))
      });
      
      setPosts(sortedPosts);
    } catch (err) {
      log.error('Failed to fetch posts', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch posts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshPosts = useCallback(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Fetch posts on mount
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Set up real-time subscriptions for new posts and visibility events
  useEffect(() => {
    let subscription: any = null;

    const setupRealtimeSubscription = async () => {
      try {
        const { realtimeSubscriptions } = await import('../lib/supabase');
        
        // Subscribe to new content updates
        subscription = realtimeSubscriptions.subscribeToNewContent((payload) => {
          log.info('New post detected', payload);
          
          // Refresh posts when new content is added
          fetchPosts();
        });

        // Initialize visibility event system
        const { useVisibilityEvents } = await import('./useVisibilityEvents');
      } catch (error) {
        log.warn('Failed to set up real-time subscription', error);
      }
    };

    setupRealtimeSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (subscription) {
        try {
          subscription.unsubscribe();
        } catch (error) {
          log.warn('Failed to cleanup real-time subscription', error);
        }
      }
    };
  }, [fetchPosts]);

  return {
    posts,
    isLoading,
    error,
    refreshPosts,
  };
}
