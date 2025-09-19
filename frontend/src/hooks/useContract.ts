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
      const targetConnector = connectors[0];
      
      if (targetConnector) {
        log.info('Connecting wallet', { connector: targetConnector.name });
        await connect({ connector: targetConnector });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
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

  useEffect(() => {
    if (!isConnected) {
      setNetworkInfo(null);
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

    updateNetworkInfo();

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
      const targetAddress = userAddress || address;
      
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
      
      try {
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
        
        const errorMessage = contractError.message || contractError.toString() || '';
        const errorCode = contractError.code || '';
        const errorData = contractError.data || '';
        
        log.debug('Contract error analysis', {
          message: errorMessage,
          code: errorCode,
          data: errorData,
          fullError: contractError
        });
        
        const isAlreadyRegistered = 
          errorMessage.includes('User already registered') || 
          errorMessage.includes('0xb9688461') ||
          errorMessage.includes('already registered') ||
          errorMessage.includes('UserAlreadyRegistered') ||
          errorCode === '0xb9688461' ||
          errorData.includes('0xb9688461');
          
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
          throw contractError; 
        }
      }
      
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
      }
      
      setIsRegistered(true);
      return txHash;
    } catch (err: any) {
      log.error('Registration error details', err);
      
      const errorMessage = err.message || err.toString() || '';
      if (errorMessage.includes('0xb9688461') || 
          errorMessage.includes('User already registered') ||
          errorMessage.includes('simulating the action') ||
          errorMessage.includes('executing calls')) {
        
        log.info('User already registered - syncing to Supabase only');
        
        try {
          const { contentStorage } = await import('../lib/supabase');
          const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
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



export function useRegistrationStatus() {
  const { address, isConnected } = useAccount();
  const log = useLogger('useRegistrationStatus');
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkRegistrationStatus = async () => {
      if (!address) {
        
        setTimeout(() => setIsRegistered(null), 0);
        return;
      }

      
      if (!isConnected) {
        
        setTimeout(() => setIsRegistered(false), 0);
        return;
      }

      
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

    
    setTimeout(checkRegistrationStatus, 0);
  }, [address, isConnected]);

  return { isRegistered, isLoading };
}


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

      
      log.info('Step 0: Ensuring FHE service is ready');
      const { fheEncryptionService } = await import('../lib/fhe-encryption');
      
      const isFHEReady = await fheEncryptionService.isFullyReady();
      if (!isFHEReady) {
        throw new Error('FHE encryption service is not ready. Please ensure you are connected to Sepolia network and try again.');
      }
      
      log.info('FHE service is ready, proceeding with post creation');

      
      log.info('Step 1: Encrypting content');
      const { contentEncryptionService } = await import('../lib/content-encryption');
      
      
      const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
      
      
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

      
      
      const visibilityEncryption = await fheEncryptionService.encryptNumber(visibility, address);

      log.info('FHE encryption completed', {
        visibility: visibilityEncryption.encryptedValue.substring(0, 20) + '...',
        proofLength: visibilityEncryption.proof.length
      });


      log.info('Step 3: Preparing contract data');
      const { VentbuddyContract } = await import('../lib/contract');
      
      
      const contractSupabaseId = contentHash; 
      
      const postData = {
        contentHash: contentHash as `0x${string}`,
        previewHash: previewHash as `0x${string}`,
        supabaseId: contractSupabaseId,
        encryptedVisibility: visibilityEncryption.encryptedValue as `0x${string}`,
        visibilityProof: visibilityEncryption.proof as `0x${string}`,
        minTipAmount: minTipAmount, 
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

      
      log.info('Step 4: Calling smart contract');
      const contract = new VentbuddyContract(walletClient);
      const { txHash, encryptedPostId, rawPostId } = await contract.createPost(postData);

      log.info('Post created successfully', {
        txHash,
        encryptedPostId,
        rawPostId
      });

      
      log.info('Step 5: Storing content in Supabase with raw post ID');
      const { contentStorage } = await import('../lib/supabase');
      const storedContent =         await contentStorage.storeEncryptedContent(
          contentHash,
          previewHash,
          encryptedContent,
          encryptedPreview,
          address,
          minTipAmount,
          rawPostId, 
          rawPostId.toString() 
        );

      log.info('Content stored in Supabase', {
        supabaseId: storedContent.id,
        encryptedPostId: encryptedPostId,
        contentHash: storedContent.content_hash.substring(0, 20) + '...',
        previewHash: storedContent.preview_hash.substring(0, 20) + '...'
      });

      
      try {
        if (rawPostId !== undefined) {
          const { visibilityManager } = await import('../lib/visibility-manager');
          await visibilityManager.logVisibilityEvent({
            postId: rawPostId.toString(), 
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

      
      log.info('Step 1: Encrypting and storing reply content');
      const { contentEncryptionService } = await import('../lib/content-encryption');
      const { fheEncryptionService } = await import('../lib/fhe-encryption');
      

      const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
      
      
      const replyId = Math.floor(Date.now() / 1000) % 1000000; // Simple ID generation
      
      const contentData = await contentEncryptionService.encryptAndStoreReply(
        postId,
        replyId,
        content,
        preview,
        address, 
        address
      );

      log.info('Reply content encrypted and stored', {
        contentHash: contentData.contentHash.substring(0, 20) + '...',
        previewHash: contentData.previewHash.substring(0, 20) + '...',
        supabaseId: contentData.supabaseId
      });

      
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

      
      log.info('Step 3: Preparing contract data');
      const { VentbuddyContract } = await import('../lib/contract');
      
      const replyData = {
        postId: postId, 
        contentHash: contentData.contentHash as `0x${string}`,
        previewHash: contentData.previewHash as `0x${string}`,
        supabaseId: contentData.supabaseId,
        encryptedVisibility: visibilityEncryption.encryptedValue as `0x${string}`,
        visibilityProof: visibilityEncryption.proof as `0x${string}`,
        minTipAmount: unlockPrice, 
      };

      log.info('Contract data prepared', {
        postId: replyData.postId,
        contentHash: replyData.contentHash.substring(0, 20) + '...',
        previewHash: replyData.previewHash.substring(0, 20) + '...',
        supabaseId: replyData.supabaseId,
        hasEncryptedVisibility: !!replyData.encryptedVisibility,
        minTipAmount: replyData.minTipAmount
      });

      
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
          
          contentHash: contentData.contentHash,
          previewHash: contentData.previewHash,
          supabaseId: contentData.supabaseId
        });
      } catch (visibilityError) {
        log.info('Failed to log reply visibility event', visibilityError);
        
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
      

      const contract = new (await import('../lib/contract')).VentbuddyContract(walletClient);
      
      log.info('Calling smart contract for tip');
      const txHash = await contract.tipPost(postId, { value: BigInt(Math.floor(amount * 1e18)) });
      
      log.info('Tip transaction successful', { txHash });
      
      
      const { contentStorage } = await import('../lib/supabase');
      await contentStorage.logAccess(
        postId.toString(), 
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
      
      
      const contract = new (await import('../lib/contract')).VentbuddyContract(walletClient);
      
      log.info('Calling smart contract for reply tip');
      const txHash = await contract.tipReply(
        postId, 
        replyId, 
        { value: BigInt(Math.floor(amount * 1e18)) }
      );
      
      log.info('Reply tip transaction successful', { txHash });
      
      
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
      
      
      const contract = new (await import('../lib/contract')).VentbuddyContract(walletClient);
      
      log.info('Calling smart contract for content unlock');
      const txHash = await contract.unlockTippableContent(postId, { value: BigInt(Math.floor(amount * 1e18)) });
      
      log.info('Content unlock transaction successful', { txHash });
      
      
      const { contentStorage } = await import('../lib/supabase');
      await contentStorage.logAccess(
        postId.toString(),
        'post',
        address,
        'unlock',
        amount
      );

      
      try {
        const { visibilityManager } = await import('../lib/visibility-manager');
        await visibilityManager.logVisibilityEvent({
          postId: postId.toString(),
          contentType: 'post',
          visibilityType: 1, 
          eventType: 'unlocked',
          userAddress: address,
          contentHash: '0x', 
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

export function useContractData() {
  const log = useLogger('useContractData');
  const [contractInfo, setContractInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContractInfo = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {

      const defaultInfo = {
        feeRecipient: '0x0000000000000000000000000000000000000000',
        feeBasisPoints: 1000, 
        currency: 'ETH', 
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
      
      
      const encryptedContent = await contentStorage.getRecentContent(20);
      
      log.info('Fetched encrypted content', { count: encryptedContent.length });

      
      const { contentEncryptionService } = await import('../lib/content-encryption');
      
      
      const rawPostIds = encryptedContent.map(content => content.raw_post_id).filter(Boolean);
      
      
      const { data: engagementStats, error: statsError } = await supabase
        .from('post_stats')
        .select('*')
        .in('raw_post_id', rawPostIds);

      if (statsError) {
        log.error('Error fetching engagement stats', statsError);
      }

      
      const encryptedPostIds = encryptedContent.map(c => String(c.encrypted_post_id)).filter(Boolean);
      
      log.debug('Encrypted post IDs from content', { encryptedPostIds });
      
      let visibilityQuery = supabase
        .from('visibility_events')
        .select('*');
      
      
      if (encryptedPostIds.length > 0) {
        visibilityQuery = visibilityQuery.in('encrypted_post_id', encryptedPostIds);
      } else {
        
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
            
            const { content: decryptedContent } = 
              await contentEncryptionService.decryptPostContent(content.id.toString());
            

            const postStats = engagementStats?.find(stat => stat.raw_post_id === content.raw_post_id);
            
              
            const postVisibilityEvents = visibilityData?.filter(event => 
              content.encrypted_post_id && String(event.encrypted_post_id) === String(content.encrypted_post_id)
            );
            const latestVisibilityEvent = postVisibilityEvents?.[0]; 
            
              
            log.debug('Post visibility data', {
              postId: content.id,
              encryptedPostId: content.encrypted_post_id,
              hasEncryptedPostId: !!content.encrypted_post_id,
              postVisibilityEvents: postVisibilityEvents,
              latestVisibilityEvent: latestVisibilityEvent,
              visibilityType: latestVisibilityEvent?.visibility_type,
              isLocked: latestVisibilityEvent?.visibility_type === 1
            });
            
              
            if (!postVisibilityEvents || postVisibilityEvents.length === 0) {
              log.debug('No visibility events found for this content. Checking if any exist at all');
              
              
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
            
              
            const replyCount = postStats?.reply_count || 0;
            const upvoteCount = postStats?.upvote_count || 0;
            const downvoteCount = postStats?.downvote_count || 0;
            
              
            const rankingScore = (replyCount * 10) + (upvoteCount * 3) - (downvoteCount * 1);
            
              
            const netScore = upvoteCount - downvoteCount;
            
              
            const visibility = latestVisibilityEvent?.visibility_type ?? 0; 
            const isLocked = visibility === 1; // 1 = Tippable (locked), 0 = Public (unlocked)
            
              
            const minTipAmount = (content as EncryptedContent & { min_tip_amount?: number }).min_tip_amount || 0;
            
              
            const shouldBeLocked = isLocked || (minTipAmount > 0 && !latestVisibilityEvent);
            
            if (minTipAmount > 0 && !latestVisibilityEvent) {
              log.debug('TEMPORARY FIX: Content has min_tip_amount but no visibility event. Assuming tippable');
            }
            
            if (!content.raw_post_id) {
              log.error('Missing raw_post_id for post', { postId: content.id, message: 'Cannot use this post for smart contract operations!' });
              return null;
            }
            
            return {
              rawPostId: content.raw_post_id, 
              author: 'Anon', 
              content: decryptedContent, 
              preview: '[Content preview removed for security]',
              isLocked: shouldBeLocked, 
              tipAmount: minTipAmount, 
              likes: netScore, 
              comments: postStats?.reply_count || 0,
              timestamp: new Date(content.created_at).toLocaleString(),
              isPremium: false, 
              contentHash: content.content_hash,
              previewHash: content.preview_hash,
              authorId: content.author_id,
              createdAt: content.created_at,
              updatedAt: content.updated_at,
              minTipAmount: minTipAmount, 
              visibility: shouldBeLocked ? 1 : 0, 
              visibilityEvent: latestVisibilityEvent, 
              supabaseId: content.id.toString(), 
             
              rankingScore: rankingScore,
              upvoteCount: upvoteCount,
              downvoteCount: downvoteCount,
              replyCount: replyCount
            };
          } catch (decryptError) {
            log.warn('Failed to decrypt content for post', { postId: content.id, error: decryptError });
           
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
            
            
            const fallbackShouldBeLocked = (fallbackVisibility === 1) || (fallbackMinTipAmount > 0 && !fallbackLatestEvent);
            
           
            if (!content.raw_post_id) {
              log.error('Missing raw_post_id for fallback post', { postId: content.id, message: 'Cannot use this post for smart contract operations!' });
             
              return null;
            }
            
            return {
              rawPostId: content.raw_post_id, 
              author: 'Anon',
              content: 'This content could not be decrypted.',
              preview: '[Content preview removed for security]',
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
              visibility: fallbackShouldBeLocked ? 1 : 0, 
              decryptError: true,
              supabaseId: content.id.toString(), 
              encryptedPostId: content.encrypted_post_id 
            };
          }
        })
      );

      log.info('Decrypted posts', { count: decryptedPosts.length });
      

      const validPosts = decryptedPosts.filter(post => post !== null);
      
      const sortedPosts = validPosts.sort((a, b) => {
       
        if (b.rankingScore !== a.rankingScore) {
          return b.rankingScore - a.rankingScore;
        }
        
       
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

  
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  
  useEffect(() => {
    let subscription: any = null;

    const setupRealtimeSubscription = async () => {
      try {
        const { realtimeSubscriptions } = await import('../lib/supabase');
        
        
        subscription = realtimeSubscriptions.subscribeToNewContent((payload) => {
          log.info('New post detected', payload);
          
          
          fetchPosts();
        });

      } catch (error) {
        log.warn('Failed to set up real-time subscription', error);
      }
    };

    setupRealtimeSubscription();

    
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
