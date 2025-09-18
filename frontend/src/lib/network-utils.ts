/**
 * Network utilities for handling wallet network switching
 */

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7';

export const SEPOLIA_NETWORK_CONFIG = {
  chainId: SEPOLIA_CHAIN_ID_HEX,
  chainName: 'Sepolia Testnet',
  nativeCurrency: {
    name: 'Sepolia Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: [
    'https://sepolia.infura.io/v3/8800e5d43f644529846d90ee5c29adcf',
    'https://rpc.sepolia.org',
    'https://sepolia.gateway.tenderly.co',
  ],
  blockExplorerUrls: ['https://sepolia.etherscan.io'],
};

/**
 * Check if the current network is Sepolia
 */
export async function isSepoliaNetwork(): Promise<boolean> {
  if (!window.ethereum) return false;
  
  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    return chainId === SEPOLIA_CHAIN_ID_HEX;
  } catch (error) {
    console.error('Error checking network:', error);
    return false;
  }
}

/**
 * Switch to Sepolia network
 */
export async function switchToSepolia(): Promise<boolean> {
  if (!window.ethereum) {
    throw new Error('No wallet detected');
  }

  try {
    // Try to switch to Sepolia
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
    });
    
    console.log('✅ Successfully switched to Sepolia network');
    return true;
  } catch (switchError: any) {
    // If the network doesn't exist, add it
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [SEPOLIA_NETWORK_CONFIG],
        });
        
        console.log('✅ Successfully added and switched to Sepolia network');
        return true;
      } catch (addError) {
        console.error('❌ Failed to add Sepolia network:', addError);
        throw new Error('Failed to add Sepolia network to wallet');
      }
    } else {
      console.error('❌ Failed to switch to Sepolia network:', switchError);
      throw new Error('Failed to switch to Sepolia network');
    }
  }
}

/**
 * Get current network information
 */
export async function getCurrentNetwork(): Promise<{
  chainId: string;
  chainName: string;
  isSepolia: boolean;
}> {
  if (!window.ethereum) {
    throw new Error('No wallet detected');
  }

  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    const isSepolia = chainId === SEPOLIA_CHAIN_ID_HEX;
    
    let chainName = 'Unknown Network';
    if (chainId === '0x1') {
      chainName = 'Ethereum Mainnet';
    } else if (chainId === SEPOLIA_CHAIN_ID_HEX) {
      chainName = 'Sepolia Testnet';
    } else if (chainId === '0x89') {
      chainName = 'Polygon Mainnet';
    } else if (chainId === '0x13881') {
      chainName = 'Polygon Mumbai';
    }

    return {
      chainId,
      chainName,
      isSepolia,
    };
  } catch (error) {
    console.error('Error getting network info:', error);
    throw new Error('Failed to get network information');
  }
}

/**
 * Listen for network changes
 */
export function onNetworkChange(callback: (chainId: string) => void): () => void {
  if (!window.ethereum) {
    return () => {};
  }

  const handleChainChanged = (chainId: string) => {
    console.log('Network changed to:', chainId);
    callback(chainId);
  };

  window.ethereum.on('chainChanged', handleChainChanged);

  // Return cleanup function
  return () => {
    if (window.ethereum?.removeListener) {
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    }
  };
}

/**
 * Ensure wallet is connected to Sepolia network
 */
export async function ensureSepoliaNetwork(): Promise<boolean> {
  try {
    const isSepolia = await isSepoliaNetwork();
    
    if (!isSepolia) {
      console.log('🔄 Switching to Sepolia network...');
      await switchToSepolia();
      
      // Verify the switch was successful
      const newIsSepolia = await isSepoliaNetwork();
      if (!newIsSepolia) {
        throw new Error('Failed to verify network switch to Sepolia');
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to ensure Sepolia network:', error);
    throw error;
  }
}
