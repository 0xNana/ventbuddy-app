import { useState, useEffect, useCallback } from 'react';
import { initSDK, createInstance, SepoliaConfig } from '@zama-fhe/relayer-sdk/bundle';
import { isSepoliaNetwork } from './network-utils';
import { ethers } from 'ethers';

interface FHEInstance {
  createEncryptedInput: (contractAddress: string, userAddress: string) => any;
}
declare global {
  interface Window {
    FhevmSDK?: {
      initSDK: () => Promise<void>;
      createInstance: (config: any) => Promise<any>;
      SepoliaConfig: any;
    };
    fhevm?: any;
    Fhevm?: any;
    relayerSDK?: any;
  }
}


export class FHEEncryptionService {
  private isInitialized = false;
  private instance: FHEInstance | null = null;
  private contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS || '0xC531862c0669E67c7B30eD72ED275364aD14395b';
  private useNpmImport = true;
  private networkCache: { chainId: string; timestamp: number } | null = null;
  private readonly NETWORK_CACHE_TTL = 10000;

  constructor() {}

  private getSDKGlobal(): any {
    return window.FhevmSDK || window.fhevm || window.Fhevm || window.relayerSDK;
  }
  private async initializeWithNpm(): Promise<void> {
    try {
      await initSDK();
      
      try {
        this.instance = await createInstance(SepoliaConfig);
        this.isInitialized = true;
        return;
      } catch (sepoliaError: any) {
        console.warn('SepoliaConfig failed, trying manual configuration:', sepoliaError);
      }

      const config = this.createConfig();
      this.instance = await createInstance(config);
      this.isInitialized = true;
      
    } catch (error) {
      console.error('NPM initialization failed:', error);
      
      try {
        await this.initializeWithCDN();
      } catch (cdnError) {
        console.error('CDN fallback also failed:', cdnError);
        throw new Error(`FHE SDK initialization failed. NPM error: ${error.message}, CDN error: ${cdnError.message}`);
      }
    }
  }

  private async initializeWithCDN(): Promise<void> {
    const sdkGlobal = this.getSDKGlobal();
    if (!sdkGlobal) {
      await this.waitForCDN();
    }
    
    const sdkGlobalCDN = this.getSDKGlobal();
    if (!sdkGlobalCDN) {
      throw new Error('FHEVM SDK not loaded from CDN. Please check the CDN script in index.html');
    }
    
    await sdkGlobalCDN.initSDK();
    
    try {
      this.instance = await sdkGlobalCDN.createInstance(sdkGlobalCDN.SepoliaConfig);
      this.isInitialized = true;
      return;
    } catch (sepoliaError: any) {
      console.warn('SepoliaConfig failed in CDN, trying manual configuration:', sepoliaError);
    }

    const config = this.createConfig();
    this.instance = await sdkGlobalCDN.createInstance(config);
    this.isInitialized = true;
  }

  private createConfig() {
    const relayerUrl = import.meta.env.VITE_RELAYER_URL || 'https://relayer.testnet.zama.cloud';
    
    return {
      aclContractAddress: import.meta.env.VITE_ACL_CONTRACT || '0x687820221192C5B662b25367F70076A37bc79b6c',
      kmsContractAddress: import.meta.env.VITE_KMS_VERIFIER_CONTRACT || '0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC',
      inputVerifierContractAddress: import.meta.env.VITE_INPUT_VERIFIER_CONTRACT || '0xbc91f3daD1A5F19F8390c400196e58073B6a0BC4',
      chainId: parseInt(import.meta.env.VITE_CHAIN_ID || '11155111'),
      gatewayChainId: parseInt(import.meta.env.VITE_CHAIN_ID_GATEWAY || '55815'),
      network: import.meta.env.VITE_RPC_URL || 'https://eth-sepolia.public.blastapi.io',
      relayerUrl: relayerUrl,
      verifyingContractAddressDecryption: import.meta.env.VITE_DECRYPTION_ADDRESS || '0xb6E160B1ff80D67Bfe90A85eE06Ce0A2613607D1',
      verifyingContractAddressInputVerification: import.meta.env.VITE_INPUT_VERIFICATION_ADDRESS || '0x7048C39f048125eDa9d678AEbaDfB22F7900a29F',
    };
  }

  private async checkRelayerConnectivity(relayerUrl: string): Promise<void> {
    try {
      const res = await fetch(`${relayerUrl}/keyurl`);
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gateway API check failed: ${res.status} ${res.statusText} - ${errorText}`);
      }
      
      const keyUrlData = await res.json();
      
      if (!keyUrlData.fhe_key_info || keyUrlData.fhe_key_info.length === 0) {
        console.warn('Relayer accessible but no FHE key info found');
      }
    } catch (relayerError) {
      console.error('Relayer connectivity check failed:', relayerError);
      throw new Error(`Cannot connect to FHEVM relayer at ${relayerUrl}: ${relayerError instanceof Error ? relayerError.message : 'Unknown error'}`);
    }
  }

  private async waitForCDN(): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50;
      
      const checkCDN = () => {
        attempts++;
        
        const possibleGlobals = [
          window.FhevmSDK,
          window.fhevm,
          window.Fhevm,
          window.relayerSDK
        ];
        
        const foundGlobal = possibleGlobals.find(global => global);
        
        if (foundGlobal) {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('FHEVM SDK CDN failed to load after 5 seconds'));
        } else {
          setTimeout(checkCDN, 100);
        }
      };
      
      checkCDN();
    });
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (this.useNpmImport) {
        try {
          await this.initializeWithNpm();
          return;
        } catch (npmError: any) {
          if (npmError.message?.includes('Sepolia network') || npmError.message?.includes('Wallet must be connected')) {
            throw npmError;
          }
          console.warn('NPM import failed, falling back to CDN:', npmError);
          this.useNpmImport = false;
        }
      }
      
      await this.initializeWithCDN();
    } catch (error) {
      console.error('Failed to initialize FHEVM SDK:', error);
      throw new Error(`FHEVM SDK initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async isWalletAndNetworkReady(): Promise<boolean> {
    if (!window.ethereum) {
      return false;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length === 0) {
        return false;
      }

      const isOnSepolia = await this.isSepoliaNetworkCached();
      if (!isOnSepolia) {
        return false;
      }

      return true;
    } catch (error) {
      console.warn('Error checking wallet/network status:', error);
      return false;
    }
  }

  private async isSepoliaNetworkCached(): Promise<boolean> {
    const now = Date.now();
    
    if (this.networkCache && (now - this.networkCache.timestamp) < this.NETWORK_CACHE_TTL) {
      return this.networkCache.chainId === '0xaa36a7';
    }

    try {
      const isSepolia = await isSepoliaNetwork();
      
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      this.networkCache = {
        chainId,
        timestamp: now
      };

      return isSepolia;
    } catch (error) {
      console.warn('Error checking network:', error);
      return false;
    }
  }

  async encryptAddress(address: string, userWalletAddress: string): Promise<{
    encryptedAddress: string;
    proof: string;
  }> {
    const isReady = await this.isFullyReady();
    if (!isReady) {
      throw new Error('FHE encryption service is not ready. Please ensure you are connected to Sepolia network and try again.');
    }

    if (!this.instance) {
      throw new Error('FHEVM SDK not initialized. Please ensure you are connected to Sepolia network and try again.');
    }

    try {
      return await this.encryptAddressWithFHEVM(address, userWalletAddress);
    } catch (error) {
      console.error('Address encryption failed:', error);
      throw new Error(`FHE address encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }



  private async encryptAddressWithFHEVM(address: string, userWalletAddress: string): Promise<{
    encryptedAddress: string;
    proof: string;
  }> {
    try {
      if (!this.instance) {
        throw new Error('FHE instance not initialized');
      }

      if (typeof this.instance.createEncryptedInput !== 'function') {
        throw new Error('createEncryptedInput method not available on FHE instance. Check FHE SDK version and configuration.');
      }

      const input = this.instance.createEncryptedInput(this.contractAddress, userWalletAddress);
      
      if (!input) {
        throw new Error('createEncryptedInput returned undefined');
      }

      if (typeof input.addAddress !== 'function') {
        throw new Error('addAddress method not available on encrypted input. Check FHE SDK version and configuration.');
      }

      let inputs;
      try {
        inputs = await input.addAddress(address).encrypt();
      } catch (pattern1Error) {
        try {
          input.addAddress(address);
          inputs = await input.encrypt();
        } catch (pattern2Error) {
          try {
            inputs = await input.encrypt(address);
          } catch (pattern3Error) {
            throw new Error(`All encryption patterns failed. Last error: ${pattern3Error.message}`);
          }
        }
      }

      if (!inputs) {
        throw new Error('Encryption returned undefined');
      }

      return this.validateEncryptionResult(inputs, address);
    } catch (error) {
      console.error('FHEVM encryption failed:', error);
      throw error;
    }
  }



  async encryptNumber(value: number, userWalletAddress: string): Promise<{
    encryptedValue: string;
    proof: string;
  }> {
    const isReady = await this.isFullyReady();
    if (!isReady) {
      throw new Error('FHE encryption service is not ready. Please ensure you are connected to Sepolia network and try again.');
    }

    if (!this.instance) {
      throw new Error('FHEVM SDK not initialized. Please ensure you are connected to Sepolia network and try again.');
    }

    try {
      return await this.encryptNumberWithFHEVM(value, userWalletAddress);
    } catch (error) {
      console.error('FHE number encryption failed:', error);
      throw new Error(`FHE number encryption failed: ${error.message}. Cannot proceed with mock data.`);
    }
  }


  private async encryptNumberWithFHEVM(value: number, userWalletAddress: string): Promise<{
    encryptedValue: string;
    proof: string;
  }> {
    try {
      const input = this.instance.createEncryptedInput(this.contractAddress, userWalletAddress);
      
      if (!input) {
        throw new Error('createEncryptedInput returned undefined');
      }
      
      const numericValue = Number(value);
      if (isNaN(numericValue)) {
        throw new Error(`Invalid numeric value: ${value}`);
      }
      
      let inputs;
      
      try {
        if (typeof input.add128 === 'function') {
          input.add128(numericValue);
          inputs = await input.encrypt();
        } else if (typeof input.add64 === 'function') {
          input.add64(numericValue);
          inputs = await input.encrypt();
        } else if (typeof input.add32 === 'function') {
          input.add32(numericValue);
          inputs = await input.encrypt();
        } else {
          throw new Error('No suitable add method available for number encryption');
        }
      } catch (encryptionError) {
        console.error('FHEVM number encryption failed:', encryptionError);
        throw new Error(`FHEVM number encryption failed: ${encryptionError.message}`);
      }

      if (!inputs) {
        throw new Error('Number encryption returned undefined');
      }

      if (!inputs.handles || !Array.isArray(inputs.handles) || inputs.handles.length === 0) {
        throw new Error('Invalid number encryption result: no handles returned');
      }

      if (!inputs.inputProof) {
        throw new Error('Invalid number encryption result: no proof returned');
      }

      const encryptedValue = inputs.handles[0];
      const proof = inputs.inputProof;

      let formattedEncryptedValue: string;
      let formattedProof: string;

      if (encryptedValue instanceof Uint8Array) {
        formattedEncryptedValue = '0x' + Array.from(encryptedValue)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } else if (Array.isArray(encryptedValue)) {
        formattedEncryptedValue = '0x' + encryptedValue
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } else if (typeof encryptedValue === 'string') {
        formattedEncryptedValue = encryptedValue.startsWith('0x') ? encryptedValue : '0x' + encryptedValue;
      } else if (typeof encryptedValue === 'object' && encryptedValue !== null) {
        const keys = Object.keys(encryptedValue).map(Number).sort((a, b) => a - b);
        
        if (keys.length > 0 && keys.every(k => typeof k === 'number' && k >= 0)) {
          const bytes = keys.map(k => encryptedValue[k]);
          formattedEncryptedValue = '0x' + bytes
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        } else {
          const hexString = JSON.stringify(encryptedValue).replace(/[^0-9a-f]/gi, '');
          formattedEncryptedValue = '0x' + hexString.substring(0, 64).padStart(64, '0');
        }
      } else {
        const hexString = JSON.stringify(encryptedValue).replace(/[^0-9a-f]/gi, '');
        formattedEncryptedValue = '0x' + hexString.substring(0, 64).padStart(64, '0');
      }

      if (proof instanceof Uint8Array) {
        formattedProof = '0x' + Array.from(proof)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } else if (Array.isArray(proof)) {
        formattedProof = '0x' + proof
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } else if (typeof proof === 'string') {
        formattedProof = proof.startsWith('0x') ? proof : '0x' + proof;
      } else {
        const hexString = JSON.stringify(proof).replace(/[^0-9a-f]/gi, '');
        formattedProof = '0x' + hexString;
      }

      if (formattedEncryptedValue.length !== 66) {
        const hexData = formattedEncryptedValue.slice(2);
        if (hexData.length < 64) {
          formattedEncryptedValue = '0x' + hexData.padStart(64, '0');
        } else {
          formattedEncryptedValue = '0x' + hexData.substring(0, 64);
        }
      }

      if (formattedEncryptedValue.length !== 66) {
        throw new Error(`Invalid encrypted value length: ${formattedEncryptedValue.length}, expected 66`);
      }

      if (!formattedEncryptedValue.match(/^0x[0-9a-f]{64}$/i)) {
        throw new Error(`Invalid encrypted value format: ${formattedEncryptedValue}`);
      }

      const hexData = formattedEncryptedValue.slice(2);
      const pattern = hexData.substring(0, 8);
      const patternCount = (hexData.match(new RegExp(pattern, 'g')) || []).length;
      
      if (patternCount > 1 && numericValue !== 0) {
        throw new Error(`FHE encryption produced malformed data with repeated patterns. Cannot proceed with mock data.`);
      }

      const result = {
        encryptedValue: formattedEncryptedValue,
        proof: formattedProof
      };

      if (result.encryptedValue.length !== 66) {
        throw new Error(`FHE encryption result is not 32 bytes: ${result.encryptedValue.length} chars, expected 66 (0x + 64 hex)`);
      }

      if (!result.encryptedValue.match(/^0x[0-9a-f]{64}$/i)) {
        throw new Error(`FHE encryption result is not valid hex: ${result.encryptedValue}`);
      }

      return result;
    } catch (error) {
      console.error('FHEVM number encryption failed:', error);
      throw error;
    }
  }




  private validateEncryptionResult(inputs: any, originalAddress: string): {
    encryptedAddress: string;
    proof: string;
  } {
    if (!inputs.handles || !Array.isArray(inputs.handles) || inputs.handles.length === 0) {
      throw new Error('Invalid encryption result: no handles returned');
    }

    if (!inputs.inputProof) {
      throw new Error('Invalid encryption result: no proof returned');
    }

    const encryptedAddress = inputs.handles[0];
    const proof = inputs.inputProof;

    let formattedEncryptedAddress: string;
    let formattedProof: string;

    if (typeof encryptedAddress === 'object' && encryptedAddress !== null) {
      if (encryptedAddress instanceof Uint8Array) {
        formattedEncryptedAddress = '0x' + Array.from(encryptedAddress)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } else {
        formattedEncryptedAddress = '0x' + JSON.stringify(encryptedAddress)
          .replace(/[^0-9a-f]/gi, '')
          .substring(0, 64);
      }
    } else {
      formattedEncryptedAddress = typeof encryptedAddress === 'string' 
        ? (encryptedAddress.startsWith('0x') ? encryptedAddress : '0x' + encryptedAddress)
        : '0x' + String(encryptedAddress);
    }

    if (typeof proof === 'object' && proof !== null) {
      if (proof instanceof Uint8Array) {
        formattedProof = '0x' + Array.from(proof)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } else {
        formattedProof = '0x' + JSON.stringify(proof)
          .replace(/[^0-9a-f]/gi, '');
      }
    } else {
      formattedProof = typeof proof === 'string' 
        ? (proof.startsWith('0x') ? proof : '0x' + proof)
        : '0x' + String(proof);
    }

    if (formattedEncryptedAddress.length !== 66) {
      const hexData = formattedEncryptedAddress.slice(2);
      if (hexData.length < 64) {
        formattedEncryptedAddress = '0x' + hexData.padStart(64, '0');
      } else {
        formattedEncryptedAddress = '0x' + hexData.substring(0, 64);
      }
    }

    return {
      encryptedAddress: formattedEncryptedAddress,
      proof: formattedProof
    };
  }



  isReady(): boolean {
    return this.isInitialized;
  }

  async isFullyReady(): Promise<boolean> {
    const walletAndNetworkReady = await this.isWalletAndNetworkReady();
    if (!walletAndNetworkReady) {
      return false;
    }
    
    if (!this.isInitialized) {
      try {
        await this.initialize();
        return this.isInitialized;
      } catch (error) {
        console.warn('FHE initialization failed:', error);
        return false;
      }
    }
    
    return this.isInitialized;
  }

  clearNetworkCache(): void {
    this.networkCache = null;
  }
}

// Export singleton instance
export const fheEncryptionService = new FHEEncryptionService();

export function encodeUnlockTippableContentCalldata(
  postId: string,
  tipAmountEncrypted: string,
  tipProofBytes: string,
  tokenAmount: bigint
): string {
  try {
    const iface = new ethers.Interface([
      "function unlockTippableContent(bytes32,bytes32,bytes,uint128)"
    ]);
    
    if (!postId.startsWith('0x') || postId.length !== 66) {
      throw new Error(`Invalid postId format: ${postId}`);
    }
    
    if (!tipProofBytes.startsWith('0x')) {
      throw new Error(`Invalid tipProofBytes format: ${tipProofBytes}`);
    }
    
    let cleanTipAmount = tipAmountEncrypted;
    if (!tipAmountEncrypted.startsWith('0x')) {
      throw new Error(`Invalid tipAmountEncrypted format: ${tipAmountEncrypted}`);
    }
    
    const hexData = tipAmountEncrypted.slice(2);
    const hasGatewayId = hexData.includes('aa36a706');
    
    if (hasGatewayId) {
      const gatewayIdIndex = hexData.indexOf('aa36a706');
      if (gatewayIdIndex > 0) {
        cleanTipAmount = '0x' + hexData.substring(0, gatewayIdIndex);
        if (cleanTipAmount.length < 66) {
          cleanTipAmount = cleanTipAmount.padEnd(66, '0');
        }
      } else {
        cleanTipAmount = '0x' + tipAmountEncrypted.slice(2, 66);
      }
    } else if (tipAmountEncrypted.length < 66) {
      cleanTipAmount = ethers.zeroPadValue(tipAmountEncrypted, 32);
    }
    
    let cleanTipProof = tipProofBytes;
    
    if (tipProofBytes.startsWith('0x64') && tipProofBytes.includes('0101') || tipProofBytes.includes('aa36a706')) {
      const hexData = tipProofBytes.slice(2);
      if (hexData.length >= 4) {
        let proofStart = 0;
        if (hexData.startsWith('64') || hexData.startsWith('0064')) {
          proofStart = hexData.startsWith('64') ? 2 : 4;
        }
        cleanTipProof = '0x' + hexData.substring(proofStart);
      }
    }
    
    const data = iface.encodeFunctionData("unlockTippableContent", [
      postId,
      cleanTipAmount,
      cleanTipProof,
      tokenAmount
    ]);
    
    return data;
  } catch (error) {
    console.error('Failed to encode unlockTippableContent calldata:', error);
    throw new Error(`Calldata encoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}


export function useFHEEncryption() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkWalletAndNetwork = async () => {
      try {
        const walletAndNetworkReady = await fheEncryptionService.isWalletAndNetworkReady();
        setIsReady(walletAndNetworkReady);
        if (walletAndNetworkReady) {
          setError(null);
        }
      } catch (err) {
        setIsReady(false);
        setError(err instanceof Error ? err.message : 'Wallet or network not ready');
      }
    };

    checkWalletAndNetwork();

    const interval = setInterval(checkWalletAndNetwork, 5000);

    const handleAccountsChanged = () => {
      checkWalletAndNetwork();
    };

    const handleChainChanged = () => {
      fheEncryptionService.clearNetworkCache();
      checkWalletAndNetwork();
    };

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      clearInterval(interval);
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const encryptAddress = useCallback(async (address: string, userWalletAddress: string) => {
    try {
      setError(null);
      return await fheEncryptionService.encryptAddress(address, userWalletAddress);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Encryption failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const encryptNumber = useCallback(async (value: number, userWalletAddress: string) => {
    try {
      setError(null);
      return await fheEncryptionService.encryptNumber(value, userWalletAddress);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Encryption failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  return {
    isReady,
    error,
    encryptAddress,
    encryptNumber,
  };
}
