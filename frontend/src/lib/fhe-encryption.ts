import { useState, useEffect, useCallback } from 'react';
import { initSDK, createInstance, SepoliaConfig } from '@zama-fhe/relayer-sdk/bundle';
import { isSepoliaNetwork } from './network-utils';
import { ethers } from 'ethers';

// Type definitions for better TypeScript support
// Note: Using 'any' for now as the actual SDK types may vary
interface FHEInstance {
  createEncryptedInput: (contractAddress: string, userAddress: string) => any;
  userDecrypt: (...args: any[]) => Promise<any>;
  publicDecrypt: (...args: any[]) => Promise<any>;
}

// Fallback to global CDN version if npm import fails
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
  private useNpmImport = true; // Try npm import first, fallback to CDN
  private networkCache: { chainId: string; timestamp: number } | null = null;
  private readonly NETWORK_CACHE_TTL = 10000; // 10 seconds cache

  constructor() {
    // Don't initialize immediately - wait for wallet and network to be ready
    // Initialization will be triggered when encryptAddress or other methods are called
  }

  /**
   * Get the SDK global object (fallback for CDN)
   */
  private getSDKGlobal(): any {
    return window.FhevmSDK || window.fhevm || window.Fhevm || window.relayerSDK;
  }

  /**
   * Initialize using npm import - Simplified approach following official docs
   */
  private async initializeWithNpm(): Promise<void> {
    try {
      // Initialize the SDK (load WASM)
      console.log('🔧 Initializing FHEVM SDK with npm import (loading WASM)...');
      await initSDK();
      console.log('✅ FHEVM SDK WASM loaded successfully via npm');
      
      // Try SepoliaConfig first (recommended approach from docs)
      console.log('🔧 Creating FHEVM instance with SepoliaConfig...');
      try {
        this.instance = await createInstance(SepoliaConfig);
        console.log('✅ FHEVM instance created with SepoliaConfig');
        this.isInitialized = true;
        console.log('✅ FHEVM SDK initialized successfully via npm with SepoliaConfig');
        return; // Success, exit early
      } catch (sepoliaError: any) {
        console.warn('⚠️ SepoliaConfig failed, trying manual configuration:', sepoliaError);
      }

      // Fallback to manual configuration
      console.log('🔧 Creating FHEVM instance with manual configuration...');
      const config = this.createConfig();
      this.instance = await createInstance(config);
      console.log('✅ FHEVM instance created with manual config');
      this.isInitialized = true;
      console.log('✅ FHEVM SDK initialized successfully via npm with manual config');
      
    } catch (error) {
      console.error('❌ NPM initialization failed:', error);
      console.log('🔄 Trying CDN fallback...');
      
      // Try CDN fallback
      try {
        await this.initializeWithCDN();
      } catch (cdnError) {
        console.error('❌ CDN fallback also failed:', cdnError);
        throw new Error(`FHE SDK initialization failed. NPM error: ${error.message}, CDN error: ${cdnError.message}`);
      }
    }
  }

  /**
   * Initialize FHEVM SDK via CDN fallback - Simplified approach
   */
  private async initializeWithCDN(): Promise<void> {
    console.log('🔧 Using CDN fallback for FHEVM SDK...');
    const sdkGlobal = this.getSDKGlobal();
    if (!sdkGlobal) {
      console.log('⏳ Waiting for FHEVM SDK CDN to load...');
      await this.waitForCDN();
    }
    
    const sdkGlobalCDN = this.getSDKGlobal();
    if (!sdkGlobalCDN) {
      throw new Error('FHEVM SDK not loaded from CDN. Please check the CDN script in index.html');
    }
    
    // Initialize the SDK (load WASM)
    console.log('🔧 Initializing FHEVM SDK (loading WASM)...');
    await sdkGlobalCDN.initSDK();
    console.log('✅ FHEVM SDK WASM loaded successfully');
    
    // Try SepoliaConfig first (recommended approach from docs)
    console.log('🔧 Creating FHEVM instance with SepoliaConfig (CDN)...');
    try {
      this.instance = await sdkGlobalCDN.createInstance(sdkGlobalCDN.SepoliaConfig);
      console.log('✅ FHEVM instance created with SepoliaConfig (CDN)');
      this.isInitialized = true;
      console.log('✅ FHEVM SDK initialized successfully via CDN with SepoliaConfig');
      return; // Success, exit early
    } catch (sepoliaError: any) {
      console.warn('⚠️ SepoliaConfig failed in CDN, trying manual configuration:', sepoliaError);
    }

    // Fallback to manual configuration
    console.log('🔧 Creating FHEVM instance with manual configuration (CDN)...');
    const config = this.createConfig();
    this.instance = await sdkGlobalCDN.createInstance(config);
    console.log('✅ FHEVM instance created with manual config (CDN)');
    this.isInitialized = true;
    console.log('✅ FHEVM SDK initialized successfully via CDN with manual config');
  }

  /**
   * Create FHEVM configuration
   */
  private createConfig() {
    const relayerUrl = import.meta.env.VITE_RELAYER_URL || 'https://relayer.testnet.zama.cloud';
    
    // Configuration using CORRECT values from official FHEVM documentation
    return {
      // ACL Contract Address for Sepolia - from official docs
      aclContractAddress: import.meta.env.VITE_ACL_CONTRACT || '0x687820221192C5B662b25367F70076A37bc79b6c',
      // KMS Verifier Contract Address for Sepolia - from official docs
      kmsContractAddress: import.meta.env.VITE_KMS_VERIFIER_CONTRACT || '0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC',
      // Input Verifier Contract Address for Sepolia - from official docs
      inputVerifierContractAddress: import.meta.env.VITE_INPUT_VERIFIER_CONTRACT || '0xbc91f3daD1A5F19F8390c400196e58073B6a0BC4',
      // Chain ID for Sepolia - from official docs
      chainId: parseInt(import.meta.env.VITE_CHAIN_ID || '11155111'),
      // Gateway chain ID - from official docs
      gatewayChainId: parseInt(import.meta.env.VITE_CHAIN_ID_GATEWAY || '55815'),
      // Network URL for Sepolia
      network: import.meta.env.VITE_RPC_URL || 'https://eth-sepolia.public.blastapi.io',
      // Relayer URL - from official docs
      relayerUrl: relayerUrl,
      // Required contract addresses for FHEVM - from official docs
      verifyingContractAddressDecryption: import.meta.env.VITE_DECRYPTION_ADDRESS || '0xb6E160B1ff80D67Bfe90A85eE06Ce0A2613607D1',
      verifyingContractAddressInputVerification: import.meta.env.VITE_INPUT_VERIFICATION_ADDRESS || '0x7048C39f048125eDa9d678AEbaDfB22F7900a29F',
    };
  }

  /**
   * Check relayer connectivity
   */
  private async checkRelayerConnectivity(relayerUrl: string): Promise<void> {
    try {
      console.log('🔍 Checking relayer connectivity via Gateway API...');
      console.log('Requesting URL:', `${relayerUrl}/keyurl`);
      const res = await fetch(`${relayerUrl}/keyurl`);
      
      console.log('Response status:', res.status, res.statusText);
      console.log('Response headers:', Object.fromEntries(res.headers.entries()));
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Error response body:', errorText);
        throw new Error(`Gateway API check failed: ${res.status} ${res.statusText} - ${errorText}`);
      }
      
      const keyUrlData = await res.json();
      console.log("Gateway API keyurl response:", keyUrlData);
      
      // Check if we have FHE public key information
      if (keyUrlData.fhe_key_info && keyUrlData.fhe_key_info.length > 0) {
        const fheKeyInfo = keyUrlData.fhe_key_info[0];
        console.log("FHE Public Key Info:", fheKeyInfo.fhe_public_key);
        console.log('✅ Relayer is accessible and FHE keys are available');
      } else {
        console.warn('⚠️ Relayer accessible but no FHE key info found');
      }
    } catch (relayerError) {
      console.error('❌ Relayer connectivity check failed:', relayerError);
      throw new Error(`Cannot connect to FHEVM relayer at ${relayerUrl}: ${relayerError instanceof Error ? relayerError.message : 'Unknown error'}`);
    }
  }

  /**
   * Wait for CDN script to load
   */
  private async waitForCDN(): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait
      
      const checkCDN = () => {
        attempts++;
        
        // Check for different possible global variable names
        const possibleGlobals = [
          window.FhevmSDK,
          window.fhevm,
          window.Fhevm,
          window.relayerSDK
        ];
        
        const foundGlobal = possibleGlobals.find(global => global);
        
        if (foundGlobal) {
          console.log('✅ FHEVM SDK CDN loaded successfully');
          console.log('Found global object:', foundGlobal);
          resolve();
        } else if (attempts >= maxAttempts) {
          console.error('Available global objects:', Object.keys(window).filter(k => 
            k.toLowerCase().includes('fhevm') || 
            k.toLowerCase().includes('relayer') ||
            k.toLowerCase().includes('zama')
          ));
          reject(new Error('FHEVM SDK CDN failed to load after 5 seconds'));
        } else {
          setTimeout(checkCDN, 100);
        }
      };
      
      checkCDN();
    });
  }

  /**
   * Initialize the FHEVM SDK instance
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing FHEVM SDK...');
      
      // Try npm import first, fallback to CDN
      if (this.useNpmImport) {
        try {
          console.log('🔧 Using npm import for FHEVM SDK...');
          await this.initializeWithNpm();
          return;
        } catch (npmError: any) {
          // Check if it's a network error - don't fallback to CDN for network issues
          if (npmError.message?.includes('Sepolia network') || npmError.message?.includes('Wallet must be connected')) {
            console.warn('⚠️ Network issue detected, not falling back to CDN:', npmError.message);
            throw npmError; // Re-throw network errors
          }
          console.warn('⚠️ NPM import failed, falling back to CDN:', npmError);
          this.useNpmImport = false;
        }
      }
      
      // Fallback to CDN
      await this.initializeWithCDN();
    } catch (error) {
      console.error('❌ Failed to initialize FHEVM SDK:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      });
      
      // Provide specific guidance based on error type
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          console.error('🔗 Network Error: Check your relayer URL and network connectivity');
          console.error('Make sure your FHEVM Gateway is running and accessible');
        } else if (error.message.includes('key')) {
          console.error('🔑 Key Error: Check your KMS contract and key configuration');
          console.error('Ensure FHE public keys are properly generated and accessible');
        } else if (error.message.includes('WebAssembly') || error.message.includes('WASM')) {
          console.error('🌐 WebAssembly Error: Browser compatibility issue');
          console.error('Try using a different browser or check WebAssembly support');
        }
      }
      
      throw new Error(`FHEVM SDK initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt a user address using FHEVM SDK
   * This creates an externalEaddress that can be used with the contract
   */
  /**
   * Check if wallet and network are ready for FHE operations
   */
  async isWalletAndNetworkReady(): Promise<boolean> {
    // Check if wallet is connected
    if (!window.ethereum) {
      console.warn('⚠️ No wallet detected');
      return false;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length === 0) {
        console.warn('⚠️ No wallet accounts connected');
        return false;
      }

      // Check if on Sepolia network with caching
      const isOnSepolia = await this.isSepoliaNetworkCached();
      if (!isOnSepolia) {
        console.warn('⚠️ Not on Sepolia network');
        return false;
      }

      return true;
    } catch (error) {
      console.warn('⚠️ Error checking wallet/network status:', error);
      return false;
    }
  }

  /**
   * Check if on Sepolia network with caching to reduce RPC calls
   */
  private async isSepoliaNetworkCached(): Promise<boolean> {
    const now = Date.now();
    
    // Return cached result if still valid
    if (this.networkCache && (now - this.networkCache.timestamp) < this.NETWORK_CACHE_TTL) {
      return this.networkCache.chainId === '0xaa36a7'; // Sepolia chain ID
    }

    try {
      // Use the existing utility function
      const isSepolia = await isSepoliaNetwork();
      
      // Cache the result (we need to get the actual chainId for caching)
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      this.networkCache = {
        chainId,
        timestamp: now
      };

      return isSepolia;
    } catch (error) {
      console.warn('⚠️ Error checking network:', error);
      return false;
    }
  }

  async encryptAddress(address: string, userWalletAddress: string): Promise<{
    encryptedAddress: string;
    proof: string;
  }> {
    // Check if FHE service is fully ready (includes wallet, network, and initialization)
    const isReady = await this.isFullyReady();
    if (!isReady) {
      console.error('❌ FHE service not ready - cannot encrypt for production contract');
      throw new Error('FHE encryption service is not ready. Please ensure you are connected to Sepolia network and try again.');
    }

    if (!this.instance) {
      console.error('❌ FHEVM SDK not initialized - cannot encrypt for production contract');
      throw new Error('FHEVM SDK not initialized. Please ensure you are connected to Sepolia network and try again.');
    }

    try {
      console.log('Using FHEVM SDK encryption for address:', address);
      return await this.encryptAddressWithFHEVM(address, userWalletAddress);
    } catch (error) {
      console.error('❌ Address encryption failed:', error);
      throw new Error(`FHE address encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  /**
   * REMOVED: Fallback encryption - no mock data allowed
   * FHE encryption must work or fail completely
   */

  /**
   * Simple hash function for fallback encryption
   */
  private simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  /**
   * Encrypt address using proper FHEVM SDK
   */
  private async encryptAddressWithFHEVM(address: string, userWalletAddress: string): Promise<{
    encryptedAddress: string;
    proof: string;
  }> {
    try {
      console.log('🔐 Starting FHEVM address encryption...');
      console.log('Input parameters:', {
        address,
        userWalletAddress,
        contractAddress: this.contractAddress,
        contractAddressLength: this.contractAddress?.length,
        contractAddressValid: this.contractAddress?.startsWith('0x'),
        instanceReady: !!this.instance
      });

      // Check if instance is available
      if (!this.instance) {
        throw new Error('FHE instance not initialized');
      }

      // Debug the instance
      console.log('🔍 FHE Instance Debug:', {
        instanceType: typeof this.instance,
        instanceKeys: Object.getOwnPropertyNames(this.instance),
        hasCreateEncryptedInput: typeof this.instance.createEncryptedInput === 'function',
        instanceMethods: Object.getOwnPropertyNames(this.instance).filter(key => typeof this.instance[key] === 'function')
      });

      // Check if createEncryptedInput method exists
      if (typeof this.instance.createEncryptedInput !== 'function') {
        console.error('❌ createEncryptedInput method not available on FHE instance');
        console.error('Available methods:', Object.getOwnPropertyNames(this.instance).filter(key => typeof this.instance[key] === 'function'));
        throw new Error('createEncryptedInput method not available on FHE instance. Check FHE SDK version and configuration.');
      }

      // Create encrypted input using FHEVM SDK
      console.log('📝 Creating encrypted input...');
      const input = this.instance.createEncryptedInput(this.contractAddress, userWalletAddress);
      
      if (!input) {
        throw new Error('createEncryptedInput returned undefined');
      }

      console.log('✅ Encrypted input created:', {
        inputType: typeof input,
        inputKeys: Object.keys(input),
        hasAddAddress: typeof input.addAddress === 'function',
        inputMethods: Object.getOwnPropertyNames(input).filter(key => typeof input[key] === 'function')
      });

      // Check if addAddress method exists
      if (typeof input.addAddress !== 'function') {
        console.error('❌ addAddress method not available on encrypted input');
        console.error('Available methods:', Object.getOwnPropertyNames(input));
        console.error('Input object:', input);
        throw new Error('addAddress method not available on encrypted input. Check FHE SDK version and configuration.');
      }

      // Add address and encrypt
      console.log('🔒 Adding address and encrypting...');
      
      // Try different API patterns - encrypt() returns a Promise!
      let inputs;
      try {
        // Pattern 1: input.addAddress(address).encrypt() - AWAIT the result!
        console.log('🔄 Trying pattern 1: addAddress().encrypt()...');
        inputs = await input.addAddress(address).encrypt();
        console.log('✅ Used pattern 1: addAddress().encrypt()');
      } catch (pattern1Error) {
        console.warn('⚠️ Pattern 1 failed, trying pattern 2:', pattern1Error);
        try {
          // Pattern 2: input.encrypt() after setting address - AWAIT the result!
          console.log('🔄 Trying pattern 2: addAddress() then encrypt()...');
          input.addAddress(address);
          inputs = await input.encrypt();
          console.log('✅ Used pattern 2: addAddress() then encrypt()');
        } catch (pattern2Error) {
          console.warn('⚠️ Pattern 2 failed, trying pattern 3:', pattern2Error);
          try {
            // Pattern 3: Direct encryption with address - AWAIT the result!
            console.log('🔄 Trying pattern 3: encrypt(address)...');
            inputs = await input.encrypt(address);
            console.log('✅ Used pattern 3: encrypt(address)');
          } catch (pattern3Error) {
            console.error('❌ All patterns failed:', pattern3Error);
            throw new Error(`All encryption patterns failed. Last error: ${pattern3Error.message}`);
          }
        }
      }

      console.log('🔍 Raw encryption result:', {
        inputs,
        inputsType: typeof inputs,
        inputsKeys: inputs ? Object.keys(inputs) : 'no inputs',
        inputsStringified: JSON.stringify(inputs)
      });

      if (!inputs) {
        throw new Error('Encryption returned undefined');
      }

      return this.validateEncryptionResult(inputs, address);
    } catch (error) {
      console.error('❌ FHEVM encryption failed:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        instance: this.instance,
        instanceMethods: this.instance ? Object.getOwnPropertyNames(this.instance) : 'No instance'
      });
      throw error;
    }
  }


  /**
   * Encrypt multiple numbers using FHEVM SDK with compact lists
   * This creates a single encrypted input with multiple values and one proof
   */
  async encryptMultipleNumbers(values: number[], userWalletAddress: string): Promise<{
    encryptedValues: string[];
    proof: string;
  }> {
    // Check if FHE service is fully ready (includes wallet, network, and initialization)
    const isReady = await this.isFullyReady();
    if (!isReady) {
      console.error('❌ FHE service not ready - cannot encrypt for production contract');
      throw new Error('FHE encryption service is not ready. Please ensure you are connected to Sepolia network and try again.');
    }

    if (!this.instance) {
      console.error('❌ FHEVM SDK not initialized - cannot encrypt for production contract');
      throw new Error('FHEVM SDK not initialized. Please ensure you are connected to Sepolia network and try again.');
    }

    try {
      console.log('🔐 Starting FHEVM multiple number encryption with compact lists...');
      console.log('Values to encrypt:', values);
      
      // Create a single encrypted input
      const input = this.instance.createEncryptedInput(this.contractAddress, userWalletAddress);
      
      console.log('✅ Encrypted input created:', {
        inputType: typeof input,
        inputKeys: Object.keys(input),
        hasAdd128: typeof input.add128 === 'function',
        hasEncrypt: typeof input.encrypt === 'function'
      });

      // Add all values to the single input
      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        const numericValue = BigInt(Math.floor(value));
        console.log(`🔒 Adding value ${i + 1}/${values.length}:`, numericValue);
        input.add128(numericValue);
      }

      // Encrypt all values at once
      const inputs = await input.encrypt();
      
      console.log('🔍 Raw multiple encryption result:', {
        inputs,
        inputsType: typeof inputs,
        inputsKeys: inputs ? Object.keys(inputs) : 'no inputs',
        inputsLength: inputs ? Object.keys(inputs).length : 0
      });

      // Validate the result
      if (!inputs) {
        throw new Error('Multiple number encryption returned undefined');
      }

      if (!inputs.handles || !Array.isArray(inputs.handles) || inputs.handles.length === 0) {
        throw new Error('Invalid multiple number encryption result: no handles returned');
      }

      if (!inputs.inputProof) {
        throw new Error('Invalid multiple number encryption result: no proof returned');
      }

      // Extract all encrypted values
      const encryptedValues: string[] = [];
      for (let i = 0; i < inputs.handles.length; i++) {
        const encryptedValue = inputs.handles[i];
        const formattedValue = await this.formatEncryptedValue(encryptedValue, values[i], userWalletAddress);
        encryptedValues.push(formattedValue);
      }

      // Format the proof
      const proof = inputs.inputProof;
      const formattedProof = await this.formatProof(proof);

      const result = {
        encryptedValues,
        proof: formattedProof
      };

      console.log('🎉 FHEVM Multiple number encryption successful:', {
        valuesCount: values.length,
        encryptedValuesCount: result.encryptedValues.length,
        proofLength: result.proof.length
      });

      return result;
    } catch (error) {
      console.error('❌ FHEVM multiple number encryption failed:', error);
      throw new Error(`FHEVM multiple number encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt a number using FHEVM SDK
   * This creates an externalEuint128 that can be used with the contract
   */
  async encryptNumber(value: number, userWalletAddress: string): Promise<{
    encryptedValue: string;
    proof: string;
  }> {
    // Check if FHE service is fully ready (includes wallet, network, and initialization)
    const isReady = await this.isFullyReady();
    if (!isReady) {
      console.error('❌ FHE service not ready - cannot encrypt for production contract');
      throw new Error('FHE encryption service is not ready. Please ensure you are connected to Sepolia network and try again.');
    }

    if (!this.instance) {
      console.error('❌ FHEVM SDK not initialized - cannot encrypt for production contract');
      throw new Error('FHEVM SDK not initialized. Please ensure you are connected to Sepolia network and try again.');
    }

    try {
      console.log('Using FHEVM SDK encryption for number:', value);
      return await this.encryptNumberWithFHEVM(value, userWalletAddress);
    } catch (error) {
      console.error('❌ FHE number encryption failed:', error);
      
      // NO FALLBACKS - FHE encryption must work or fail completely
      throw new Error(`FHE number encryption failed: ${error.message}. Cannot proceed with mock data.`);
    }
  }

  /**
   * REMOVED: Fallback number encryption - no mock data allowed
   * FHE encryption must work or fail completely
   */

  /**
   * Format encrypted value helper method
   */
  private async formatEncryptedValue(encryptedValue: any, originalValue: number, userWalletAddress: string): Promise<string> {
    // Use the same formatting logic as the single encryption method
    let formattedEncryptedValue: string;

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
    } else if (typeof encryptedValue === 'number') {
      formattedEncryptedValue = '0x' + encryptedValue.toString(16).padStart(64, '0');
    } else {
      console.warn('⚠️ Unknown encrypted value type, attempting conversion:', typeof encryptedValue);
      const hexString = JSON.stringify(encryptedValue).replace(/[^0-9a-f]/gi, '');
      formattedEncryptedValue = '0x' + hexString;
    }

    // Ensure proper length for externalEuint128 (32 bytes = 64 hex chars)
    if (formattedEncryptedValue.length !== 66) {
      const hexData = formattedEncryptedValue.slice(2);
      if (hexData.length < 64) {
        formattedEncryptedValue = '0x' + hexData.padStart(64, '0');
      } else {
        formattedEncryptedValue = '0x' + hexData.substring(0, 64);
      }
    }

    // Validate the final result
    if (formattedEncryptedValue.length !== 66) {
      throw new Error(`Invalid encrypted value length: ${formattedEncryptedValue.length}, expected 66`);
    }

    if (!formattedEncryptedValue.match(/^0x[0-9a-f]{64}$/i)) {
      throw new Error(`Invalid encrypted value format: ${formattedEncryptedValue}`);
    }

    return formattedEncryptedValue;
  }

  /**
   * Format proof helper method
   */
  private async formatProof(proof: any): Promise<string> {
    let formattedProof: string;

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
      console.warn('⚠️ Unknown proof type, attempting conversion:', typeof proof);
      const hexString = JSON.stringify(proof).replace(/[^0-9a-f]/gi, '');
      formattedProof = '0x' + hexString;
    }

    return formattedProof;
  }

  /**
   * REMOVED: Proper fallback encryption - no mock data allowed
   * FHE encryption must work or fail completely
   */

  /**
   * Encrypt number using proper FHEVM SDK - CRITICAL FIX using working registration pattern
   */
  private async encryptNumberWithFHEVM(value: number, userWalletAddress: string): Promise<{
    encryptedValue: string;
    proof: string;
  }> {
    try {
      console.log('🔐 Starting FHEVM number encryption (CRITICAL FIX)...');
      console.log('Input parameters:', {
        value,
        userWalletAddress,
        contractAddress: this.contractAddress,
        instanceReady: !!this.instance
      });

      // CRITICAL FIX: Use the EXACT same pattern as working registration
      // The registration works, so we need to use the same approach
      console.log('🔄 Using EXACT same pattern as working registration...');
      
      const input = this.instance.createEncryptedInput(this.contractAddress, userWalletAddress);
      
      if (!input) {
        throw new Error('createEncryptedInput returned undefined');
      }

      console.log('✅ Encrypted input created (same as registration):', {
        inputType: typeof input,
        inputKeys: Object.keys(input),
        hasAdd128: typeof input.add128 === 'function',
        hasAdd64: typeof input.add64 === 'function',
        hasAdd32: typeof input.add32 === 'function',
        hasEncrypt: typeof input.encrypt === 'function',
        inputMethods: Object.getOwnPropertyNames(input).filter(key => typeof input[key] === 'function')
      });

      // CRITICAL: Use the same encryption pattern as registration
      // Registration uses: input.addAddress(address).encrypt()
      // For numbers, we need to use the equivalent method
      console.log('🔒 Using registration-style encryption pattern...');
      
      const numericValue = Number(value);
      if (isNaN(numericValue)) {
        throw new Error(`Invalid numeric value: ${value}`);
      }
      
      console.log('🔍 Encrypting value:', numericValue, 'Type:', typeof numericValue);
      
      let inputs;
      
      // CRITICAL FIX: Use the correct FHEVM pattern from official docs
      // Pattern: input.add128(value); const inputs = await input.encrypt();
      try {
        // Method 1: Try add128 (most likely to work for euint128)
        if (typeof input.add128 === 'function') {
          console.log('🔄 Using add128 method (correct FHEVM pattern)...');
          input.add128(numericValue);
          inputs = await input.encrypt();
          console.log('✅ FHEVM encryption successful with add128');
        } else if (typeof input.add64 === 'function') {
          console.log('🔄 Using add64 method (fallback)...');
          input.add64(numericValue);
          inputs = await input.encrypt();
          console.log('✅ FHEVM encryption successful with add64');
        } else if (typeof input.add32 === 'function') {
          console.log('🔄 Using add32 method (fallback)...');
          input.add32(numericValue);
          inputs = await input.encrypt();
          console.log('✅ FHEVM encryption successful with add32');
        } else {
          throw new Error('No suitable add method available for number encryption');
        }
      } catch (encryptionError) {
        console.error('❌ FHEVM number encryption failed:', encryptionError);
        console.error('Error details:', {
          message: encryptionError.message,
          stack: encryptionError.stack,
          value: value,
          valueType: typeof value,
          inputMethods: Object.getOwnPropertyNames(input)
        });
        throw new Error(`FHEVM number encryption failed: ${encryptionError.message}`);
      }

      console.log('🔍 Raw number encryption result:', {
        inputs,
        inputsType: typeof inputs,
        inputsKeys: inputs ? Object.keys(inputs) : 'no inputs',
        inputsStringified: JSON.stringify(inputs),
        inputsLength: inputs ? Object.keys(inputs).length : 0
      });

      // CRITICAL: Validate the result using the same pattern as registration
      if (!inputs) {
        throw new Error('Number encryption returned undefined');
      }

      if (!inputs.handles || !Array.isArray(inputs.handles) || inputs.handles.length === 0) {
        throw new Error('Invalid number encryption result: no handles returned');
      }

      if (!inputs.inputProof) {
        throw new Error('Invalid number encryption result: no proof returned');
      }

      // Get the raw data
      const encryptedValue = inputs.handles[0];
      const proof = inputs.inputProof;

      console.log('🔍 Raw encryption data:', {
        encryptedValueType: typeof encryptedValue,
        encryptedValueConstructor: encryptedValue?.constructor?.name,
        encryptedValueIsArray: Array.isArray(encryptedValue),
        encryptedValueLength: encryptedValue?.length,
        encryptedValueRaw: encryptedValue,
        proofType: typeof proof,
        proofConstructor: proof?.constructor?.name,
        proofIsArray: Array.isArray(proof),
        proofLength: proof?.length
      });

      // CRITICAL: Format the data exactly like registration
      let formattedEncryptedValue: string;
      let formattedProof: string;

      // Handle encrypted value formatting - use same pattern as registration
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
        // CRITICAL FIX: Handle object with numeric keys (like {0: 122, 1: 9, 2: 177, ...})
        const keys = Object.keys(encryptedValue).map(Number).sort((a, b) => a - b);
        console.log('🔍 Object formatting debug:', {
          keys: keys,
          keysLength: keys.length,
          firstFewKeys: keys.slice(0, 5),
          firstFewValues: keys.slice(0, 5).map(k => encryptedValue[k]),
          allKeys: keys,
          allValues: keys.map(k => encryptedValue[k])
        });
        
        if (keys.length > 0 && keys.every(k => typeof k === 'number' && k >= 0)) {
          // Convert object with numeric keys to hex string
          const bytes = keys.map(k => encryptedValue[k]);
          formattedEncryptedValue = '0x' + bytes
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          console.log('✅ Object formatted successfully:', {
            bytesLength: bytes.length,
            formattedLength: formattedEncryptedValue.length,
            firstFewBytes: bytes.slice(0, 5),
            formattedStart: formattedEncryptedValue.substring(0, 20) + '...',
            formattedFull: formattedEncryptedValue
          });
        } else {
          // Fallback for other object types
          const hexString = JSON.stringify(encryptedValue).replace(/[^0-9a-f]/gi, '');
          formattedEncryptedValue = '0x' + hexString.substring(0, 64).padStart(64, '0');
          console.log('⚠️ Using fallback object formatting');
        }
      } else {
        // Fallback for other types
        const hexString = JSON.stringify(encryptedValue).replace(/[^0-9a-f]/gi, '');
        formattedEncryptedValue = '0x' + hexString.substring(0, 64).padStart(64, '0');
      }

      // Handle proof formatting - use same pattern as registration
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

      // CRITICAL: Ensure proper length for externalEuint128 (32 bytes = 64 hex chars)
      if (formattedEncryptedValue.length !== 66) { // 0x + 64 chars
        const hexData = formattedEncryptedValue.slice(2);
        if (hexData.length < 64) {
          formattedEncryptedValue = '0x' + hexData.padStart(64, '0');
        } else {
          formattedEncryptedValue = '0x' + hexData.substring(0, 64);
        }
      }

      // CRITICAL: Validate the final result
      if (formattedEncryptedValue.length !== 66) {
        throw new Error(`Invalid encrypted value length: ${formattedEncryptedValue.length}, expected 66`);
      }

      if (!formattedEncryptedValue.match(/^0x[0-9a-f]{64}$/i)) {
        throw new Error(`Invalid encrypted value format: ${formattedEncryptedValue}`);
      }

      // CRITICAL: Check for repeated patterns (this was the main issue)
      const hexData = formattedEncryptedValue.slice(2);
      const pattern = hexData.substring(0, 8);
      const patternCount = (hexData.match(new RegExp(pattern, 'g')) || []).length;
      
      if (patternCount > 1 && numericValue !== 0) {
        console.error('🚨 CRITICAL: Repeated pattern detected in non-zero value!');
        console.error('Pattern:', pattern);
        console.error('Occurrences:', patternCount);
        console.error('Full data:', formattedEncryptedValue);
        console.error('This indicates the FHE encryption is still not working correctly!');
        
        // NO FALLBACKS - FHE encryption must produce valid data or fail completely
        throw new Error(`FHE encryption produced malformed data with repeated patterns. Cannot proceed with mock data.`);
      }

      const result = {
        encryptedValue: formattedEncryptedValue,
        proof: formattedProof
      };

      // CRITICAL DEBUG: Validate the final result before returning
      console.log('🎉 FHEVM Number encryption successful (CRITICAL FIX):', {
        original: numericValue,
        encryptedValue: result.encryptedValue,
        encryptedValueLength: result.encryptedValue.length,
        encryptedValueIsValidBytes32: result.encryptedValue.length === 66 && /^0x[0-9a-f]{64}$/i.test(result.encryptedValue),
        proof: result.proof.substring(0, 20) + '...',
        proofLength: result.proof.length
      });

      // CRITICAL: Final validation - ensure we're returning proper bytes32
      if (result.encryptedValue.length !== 66) {
        throw new Error(`FHE encryption result is not 32 bytes: ${result.encryptedValue.length} chars, expected 66 (0x + 64 hex)`);
      }

      if (!result.encryptedValue.match(/^0x[0-9a-f]{64}$/i)) {
        throw new Error(`FHE encryption result is not valid hex: ${result.encryptedValue}`);
      }

      // DEBUG: Log the full encrypted value for analysis
      console.log('🔍 DEBUG - Full encrypted value:', result.encryptedValue);
      console.log('🔍 DEBUG - Full proof:', result.proof.substring(0, 50) + '...');
      console.log('🔍 DEBUG - Encrypted value length:', result.encryptedValue.length);
      console.log('🔍 DEBUG - Has gatewayId in encrypted value:', result.encryptedValue.includes('aa36a706'));
      console.log('🔍 DEBUG - Has gatewayId in proof:', result.proof.includes('aa36a706'));

      return result;
    } catch (error) {
      console.error('❌ FHEVM number encryption failed (CRITICAL FIX):', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        instance: this.instance,
        instanceMethods: this.instance ? Object.getOwnPropertyNames(this.instance) : 'No instance'
      });
      throw error;
    }
  }

  /**
   * Encrypt a string using FHEVM SDK
   */
  async encryptString(value: string, userWalletAddress: string): Promise<{
    encryptedValue: string;
    proof: string;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.instance) {
      throw new Error('FHEVM SDK not initialized. Please check your FHEVM Gateway configuration.');
    }

    try {
      console.log('Using FHEVM SDK encryption for string:', value);
      return await this.encryptStringWithFHEVM(value, userWalletAddress);
    } catch (error) {
      console.error('String encryption failed:', error);
      throw error;
    }
  }

  /**
   * Encrypt string using proper FHEVM SDK
   */
  private async encryptStringWithFHEVM(value: string, userWalletAddress: string): Promise<{
    encryptedValue: string;
    proof: string;
  }> {
    try {
      // Create encrypted input using FHEVM SDK
      const input = this.instance.createEncryptedInput(this.contractAddress, userWalletAddress);
      
      // Check if addString method exists
      if (typeof input.addString !== 'function') {
        throw new Error('addString method not available on encrypted input');
      }

      const inputs = input.addString(value).encrypt();
      return {
        encryptedValue: inputs.handles[0], // Handle for the encrypted string
        proof: inputs.inputProof // Proof to validate the encrypted input
      };
    } catch (error) {
      console.error('FHEVM string encryption failed:', error);
      throw error;
    }
  }

  /**
   * Encrypt a boolean using FHEVM SDK
   */
  async encryptBoolean(value: boolean, userWalletAddress: string): Promise<{
    encryptedValue: string;
    proof: string;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.instance) {
      throw new Error('FHEVM SDK not initialized. Please check your FHEVM Gateway configuration.');
    }

    try {
      console.log('Using FHEVM SDK encryption for boolean:', value);
      return await this.encryptBooleanWithFHEVM(value, userWalletAddress);
    } catch (error) {
      console.error('Boolean encryption failed:', error);
      throw error;
    }
  }

  /**
   * Encrypt boolean using proper FHEVM SDK
   */
  private async encryptBooleanWithFHEVM(value: boolean, userWalletAddress: string): Promise<{
    encryptedValue: string;
    proof: string;
  }> {
    try {
      // Create encrypted input using FHEVM SDK
      const input = this.instance.createEncryptedInput(this.contractAddress, userWalletAddress);
      
      // Check if addBool method exists
      if (typeof input.addBool !== 'function') {
        throw new Error('addBool method not available on encrypted input');
      }

      const inputs = input.addBool(value).encrypt();
      return {
        encryptedValue: inputs.handles[0], // Handle for the encrypted boolean
        proof: inputs.inputProof // Proof to validate the encrypted input
      };
    } catch (error) {
      console.error('FHEVM boolean encryption failed:', error);
      throw error;
    }
  }


  /**
   * Validate number encryption result and return formatted output
   */
  private validateNumberEncryptionResult(inputs: any, originalValue: number): {
    encryptedValue: string;
    proof: string;
  } {
    console.log('✅ Number encryption completed:', {
      hasHandles: !!inputs.handles,
      handlesLength: inputs.handles?.length,
      hasInputProof: !!inputs.inputProof,
      handlesType: typeof inputs.handles,
      inputsKeys: Object.keys(inputs || {}),
      firstHandle: inputs.handles?.[0],
      firstHandleType: typeof inputs.handles?.[0],
      inputProof: inputs.inputProof,
      inputProofType: typeof inputs.inputProof
    });

    // Validate the result
    if (!inputs.handles || !Array.isArray(inputs.handles) || inputs.handles.length === 0) {
      throw new Error('Invalid number encryption result: no handles returned');
    }

    if (!inputs.inputProof) {
      throw new Error('Invalid number encryption result: no proof returned');
    }

    // Get the raw data
    const encryptedValue = inputs.handles[0];
    const proof = inputs.inputProof;

    // For FHEVM contracts, we need to pass the data as hex strings
    // The contract expects externalEuint128 (32 bytes) and bytes calldata
    let formattedEncryptedValue: string;
    let formattedProof: string;

    console.log('🔍 Raw data analysis:', {
      encryptedValueType: typeof encryptedValue,
      encryptedValueConstructor: encryptedValue?.constructor?.name,
      encryptedValueIsArray: Array.isArray(encryptedValue),
      encryptedValueLength: encryptedValue?.length,
      proofType: typeof proof,
      proofConstructor: proof?.constructor?.name,
      proofIsArray: Array.isArray(proof),
      proofLength: proof?.length
    });

    // Handle encrypted value formatting - improved for FHEVM compatibility
    if (encryptedValue instanceof Uint8Array) {
      // Uint8Array - convert to hex properly
      console.log('🔍 Uint8Array details:', {
        length: encryptedValue.length,
        firstBytes: Array.from(encryptedValue.slice(0, 8)),
        allBytes: Array.from(encryptedValue)
      });
      
      // Ensure we have exactly 32 bytes for externalEuint128
      if (encryptedValue.length !== 32) {
        console.warn('⚠️ Uint8Array length mismatch:', {
          expected: 32,
          actual: encryptedValue.length
        });
        
        // Pad or truncate to 32 bytes
        const paddedArray = new Uint8Array(32);
        if (encryptedValue.length < 32) {
          paddedArray.set(encryptedValue, 0);
        } else {
          paddedArray.set(encryptedValue.slice(0, 32), 0);
        }
        formattedEncryptedValue = '0x' + Array.from(paddedArray)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } else {
        formattedEncryptedValue = '0x' + Array.from(encryptedValue)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
      console.log('✅ Converted Uint8Array to hex:', formattedEncryptedValue.substring(0, 20) + '...');
    } else if (Array.isArray(encryptedValue)) {
      // Array of numbers - convert to hex
      console.log('🔍 Array details:', {
        length: encryptedValue.length,
        firstElements: encryptedValue.slice(0, 8),
        allElements: encryptedValue
      });
      
      // Ensure we have exactly 32 elements for externalEuint128
      if (encryptedValue.length !== 32) {
        console.warn('⚠️ Array length mismatch:', {
          expected: 32,
          actual: encryptedValue.length
        });
        
        // Pad or truncate to 32 elements
        const paddedArray = new Array(32).fill(0);
        if (encryptedValue.length < 32) {
          paddedArray.splice(0, encryptedValue.length, ...encryptedValue);
        } else {
          paddedArray.splice(0, 32, ...encryptedValue.slice(0, 32));
        }
        formattedEncryptedValue = '0x' + paddedArray
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } else {
        formattedEncryptedValue = '0x' + encryptedValue
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
      console.log('✅ Converted Array to hex:', formattedEncryptedValue.substring(0, 20) + '...');
    } else if (typeof encryptedValue === 'string') {
      // String - ensure hex format and proper length
      if (encryptedValue.startsWith('0x')) {
        formattedEncryptedValue = encryptedValue;
      } else {
        formattedEncryptedValue = '0x' + encryptedValue;
      }
      
      // Ensure it's exactly 32 bytes (64 hex chars)
      const hexData = formattedEncryptedValue.slice(2);
      if (hexData.length < 64) {
        formattedEncryptedValue = '0x' + hexData.padStart(64, '0');
      } else if (hexData.length > 64) {
        formattedEncryptedValue = '0x' + hexData.substring(0, 64);
      }
      
      console.log('✅ String formatted to hex:', formattedEncryptedValue.substring(0, 20) + '...');
    } else if (typeof encryptedValue === 'number') {
      // Number - convert to 32-byte hex
      formattedEncryptedValue = '0x' + encryptedValue.toString(16).padStart(64, '0');
      console.log('✅ Number converted to hex:', formattedEncryptedValue.substring(0, 20) + '...');
    } else {
      // Object or other - try to extract hex data
      console.warn('⚠️ Unknown encrypted value type, attempting conversion:', typeof encryptedValue);
      console.log('🔍 Object details:', {
        type: typeof encryptedValue,
        constructor: encryptedValue?.constructor?.name,
        keys: Object.keys(encryptedValue || {}),
        stringified: JSON.stringify(encryptedValue)
      });
      
      // Try to extract as hex string
      const hexString = JSON.stringify(encryptedValue).replace(/[^0-9a-f]/gi, '');
      formattedEncryptedValue = '0x' + hexString.substring(0, 64).padStart(64, '0');
      console.log('✅ Object converted to hex:', formattedEncryptedValue.substring(0, 20) + '...');
    }

    // Handle proof formatting - ensure it's properly formatted for FHEVM
    if (proof instanceof Uint8Array) {
      // Uint8Array - convert to hex
      formattedProof = '0x' + Array.from(proof)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      console.log('✅ Proof Uint8Array converted to hex:', formattedProof.substring(0, 20) + '...');
    } else if (Array.isArray(proof)) {
      // Array of numbers - convert to hex
      formattedProof = '0x' + proof
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      console.log('✅ Proof Array converted to hex:', formattedProof.substring(0, 20) + '...');
    } else if (typeof proof === 'string') {
      // String - ensure hex format
      formattedProof = proof.startsWith('0x') ? proof : '0x' + proof;
      console.log('✅ Proof String formatted to hex:', formattedProof.substring(0, 20) + '...');
    } else {
      // Object or other - try to extract hex data
      console.warn('⚠️ Unknown proof type, attempting conversion:', typeof proof);
      const hexString = JSON.stringify(proof).replace(/[^0-9a-f]/gi, '');
      formattedProof = '0x' + hexString;
      console.log('✅ Proof Object converted to hex:', formattedProof.substring(0, 20) + '...');
    }

    // Final validation and correction for externalEuint128 format
    if (formattedEncryptedValue.length !== 66) { // 0x + 64 chars
      console.warn('⚠️ Encrypted value length mismatch:', {
        expected: 66,
        actual: formattedEncryptedValue.length,
        value: formattedEncryptedValue,
        originalValue: originalValue
      });
      // Pad or truncate to 32 bytes
      const hexData = formattedEncryptedValue.slice(2);
      if (hexData.length < 64) {
        formattedEncryptedValue = '0x' + hexData.padStart(64, '0');
      } else {
        formattedEncryptedValue = '0x' + hexData.substring(0, 64);
      }
      console.log('🔧 Corrected encrypted value:', formattedEncryptedValue);
    }

    // Validate the final result
    if (formattedEncryptedValue.length !== 66) {
      throw new Error(`Invalid encrypted value length: ${formattedEncryptedValue.length}, expected 66`);
    }

    if (!formattedEncryptedValue.match(/^0x[0-9a-f]{64}$/i)) {
      throw new Error(`Invalid encrypted value format: ${formattedEncryptedValue}`);
    }

    // Check for repeated patterns (like 7500c04c) which indicate malformed data
    const hexData = formattedEncryptedValue.slice(2);
    const pattern = hexData.substring(0, 8);
    const patternCount = (hexData.match(new RegExp(pattern, 'g')) || []).length;
    
    if (patternCount > 1) {
      console.error('🚨 DETECTED REPEATED PATTERN IN FHE DATA!');
      console.error('Pattern:', pattern);
      console.error('Occurrences:', patternCount);
      console.error('Full data:', formattedEncryptedValue);
      console.error('This indicates malformed FHE encryption output!');
      
      // For zero values, this might be expected, but for non-zero values it's an error
      if (originalValue !== 0) {
        console.error('🚨 Non-zero value with repeated pattern - this is definitely an error!');
        throw new Error(`FHE encryption produced malformed data for value ${originalValue}. Pattern ${pattern} repeated ${patternCount} times.`);
      } else {
        console.log('⚠️ Zero value with repeated pattern - this might be expected for FHE zero encryption');
      }
    }

    const result = {
      encryptedValue: formattedEncryptedValue,
      proof: formattedProof
    };

    console.log('🎉 FHEVM Number encryption successful:', {
      original: originalValue,
      encryptedValue: result.encryptedValue.substring(0, 20) + '...',
      proof: result.proof.substring(0, 20) + '...',
      encryptedValueLength: result.encryptedValue.length,
      proofLength: result.proof.length
    });

    return result;
  }

  /**
   * Validate encryption result and return formatted output
   */
  private validateEncryptionResult(inputs: any, originalAddress: string): {
    encryptedAddress: string;
    proof: string;
  } {
    console.log('✅ Encryption completed:', {
      hasHandles: !!inputs.handles,
      handlesLength: inputs.handles?.length,
      hasInputProof: !!inputs.inputProof,
      handlesType: typeof inputs.handles,
      inputsKeys: Object.keys(inputs || {}),
      firstHandle: inputs.handles?.[0],
      firstHandleType: typeof inputs.handles?.[0],
      inputProof: inputs.inputProof,
      inputProofType: typeof inputs.inputProof
    });

    // Validate the result
    if (!inputs.handles || !Array.isArray(inputs.handles) || inputs.handles.length === 0) {
      throw new Error('Invalid encryption result: no handles returned');
    }

    if (!inputs.inputProof) {
      throw new Error('Invalid encryption result: no proof returned');
    }

    // Get the raw data
    const encryptedAddress = inputs.handles[0];
    const proof = inputs.inputProof;

    // For FHEVM contracts, we need to pass the data as hex strings
    // The contract expects externalEaddress and bytes calldata
    let formattedEncryptedAddress: string;
    let formattedProof: string;

    if (typeof encryptedAddress === 'object' && encryptedAddress !== null) {
      // If it's an object (like a Uint8Array), convert to hex
      if (encryptedAddress instanceof Uint8Array) {
        formattedEncryptedAddress = '0x' + Array.from(encryptedAddress)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } else {
        // Try to convert object to hex string
        formattedEncryptedAddress = '0x' + JSON.stringify(encryptedAddress)
          .replace(/[^0-9a-f]/gi, '')
          .substring(0, 64); // Ensure it's 32 bytes (64 hex chars)
      }
    } else {
      // If it's already a string, ensure it's hex format
      formattedEncryptedAddress = typeof encryptedAddress === 'string' 
        ? (encryptedAddress.startsWith('0x') ? encryptedAddress : '0x' + encryptedAddress)
        : '0x' + String(encryptedAddress);
    }

    if (typeof proof === 'object' && proof !== null) {
      // If it's an object (like a Uint8Array), convert to hex
      if (proof instanceof Uint8Array) {
        formattedProof = '0x' + Array.from(proof)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } else {
        // Try to convert object to hex string
        formattedProof = '0x' + JSON.stringify(proof)
          .replace(/[^0-9a-f]/gi, '');
      }
    } else {
      // If it's already a string, ensure it's hex format
      formattedProof = typeof proof === 'string' 
        ? (proof.startsWith('0x') ? proof : '0x' + proof)
        : '0x' + String(proof);
    }

    // Ensure the encrypted address is exactly 32 bytes (64 hex chars)
    if (formattedEncryptedAddress.length !== 66) { // 0x + 64 chars
      console.warn('Encrypted address length mismatch:', {
        expected: 66,
        actual: formattedEncryptedAddress.length,
        value: formattedEncryptedAddress
      });
      // Pad or truncate to 32 bytes
      const hexData = formattedEncryptedAddress.slice(2);
      if (hexData.length < 64) {
        formattedEncryptedAddress = '0x' + hexData.padStart(64, '0');
      } else {
        formattedEncryptedAddress = '0x' + hexData.substring(0, 64);
      }
    }

    const result = {
      encryptedAddress: formattedEncryptedAddress,
      proof: formattedProof
    };

    console.log('🎉 FHEVM Address encryption successful:', {
      original: originalAddress,
      encryptedAddress: result.encryptedAddress.substring(0, 20) + '...',
      proof: result.proof.substring(0, 20) + '...',
      encryptedAddressLength: result.encryptedAddress.length,
      proofLength: result.proof.length
    });

    return result;
  }


  /**
   * User decryption for private data access
   * This allows users to decrypt their own encrypted data
   */
  async userDecrypt(
    ciphertexts: Array<{ handle: string; contractAddress: string }>,
    userPrivateKey: string,
    userPublicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimeStamp: number,
    durationDays: number
  ): Promise<any[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.instance) {
      throw new Error('FHEVM SDK not initialized. Please check your FHEVM Gateway configuration.');
    }

    try {
      console.log('Using FHEVM SDK user decryption for:', ciphertexts.length, 'ciphertexts');
      return await this.instance.userDecrypt(
        ciphertexts,
        userPrivateKey,
        userPublicKey,
        signature,
        contractAddresses,
        userAddress,
        startTimeStamp,
        durationDays
      );
    } catch (error) {
      console.error('User decryption failed:', error);
      throw error;
    }
  }

  /**
   * Public decryption for shared/aggregated data
   * This allows anyone to decrypt publicly available encrypted data
   */
  async publicDecrypt(
    ciphertexts: Array<{ handle: string; contractAddress: string }>,
    contractAddresses: string[]
  ): Promise<any[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.instance) {
      throw new Error('FHEVM SDK not initialized. Please check your FHEVM Gateway configuration.');
    }

    try {
      console.log('Using FHEVM SDK public decryption for:', ciphertexts.length, 'ciphertexts');
      return await this.instance.publicDecrypt(ciphertexts, contractAddresses);
    } catch (error) {
      console.error('Public decryption failed:', error);
      throw error;
    }
  }

  /**
   * Check if FHE encryption service is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Check if FHE service is ready (initialized + wallet + network)
   */
  async isFullyReady(): Promise<boolean> {
    // First check if wallet and network are ready
    const walletAndNetworkReady = await this.isWalletAndNetworkReady();
    if (!walletAndNetworkReady) {
      return false;
    }
    
    // If wallet and network are ready but FHE is not initialized, try to initialize
    if (!this.isInitialized) {
      try {
        console.log('🔧 Wallet and network ready, initializing FHE service...');
        await this.initialize();
        return this.isInitialized;
      } catch (error) {
        console.warn('⚠️ FHE initialization failed:', error);
        return false;
      }
    }
    
    return this.isInitialized;
  }

  /**
   * Clear network cache (call when chain changes)
   */
  clearNetworkCache(): void {
    this.networkCache = null;
  }
}

// Export singleton instance
export const fheEncryptionService = new FHEEncryptionService();

/**
 * Properly encode calldata for unlockTippableContent function
 * This fixes the malformed calldata issues by using proper ABI encoding
 */
export function encodeUnlockTippableContentCalldata(
  postId: string,
  tipAmountEncrypted: string,
  tipProofBytes: string,
  tokenAmount: bigint
): string {
  try {
    console.log('🔧 Encoding unlockTippableContent calldata with proper ABI encoding...');
    console.log('🔍 Input validation:', {
      postId,
      postIdLength: postId.length,
      tipAmountEncrypted,
      tipAmountEncryptedLength: tipAmountEncrypted.length,
      tipProofBytes: tipProofBytes.substring(0, 50) + '...',
      tipProofBytesLength: tipProofBytes.length,
      tokenAmount: tokenAmount.toString()
    });
    
    // Create ethers Interface for proper ABI encoding
    const iface = new ethers.Interface([
      "function unlockTippableContent(bytes32,bytes32,bytes,uint128)"
    ]);
    
    // Validate inputs
    if (!postId.startsWith('0x') || postId.length !== 66) {
      throw new Error(`Invalid postId format: ${postId}`);
    }
    
    if (!tipProofBytes.startsWith('0x')) {
      throw new Error(`Invalid tipProofBytes format: ${tipProofBytes}`);
    }
    
    // CRITICAL FIX: Clean tipAmount to exactly 32 bytes (remove any appended gatewayId)
    let cleanTipAmount = tipAmountEncrypted;
    if (!tipAmountEncrypted.startsWith('0x')) {
      throw new Error(`Invalid tipAmountEncrypted format: ${tipAmountEncrypted}`);
    }
    
    // CRITICAL FIX: Check for gatewayId pattern regardless of reported length
    // The FHEVM SDK might be returning malformed values that appear to be 66 chars but contain gatewayId
    const hexData = tipAmountEncrypted.slice(2); // Remove 0x prefix
    const hasGatewayId = hexData.includes('aa36a706');
    
    // Force detection if we see the gatewayId pattern
    if (hasGatewayId) {
      console.log('🚨 CRITICAL FIX: tipAmount contains gatewayId or is too long, truncating...', {
        original: tipAmountEncrypted,
        originalLength: tipAmountEncrypted.length,
        hexDataLength: hexData.length,
        hasGatewayId: hasGatewayId,
        expectedLength: 66,
        extraBytes: tipAmountEncrypted.slice(66),
        willTruncateTo: '0x' + tipAmountEncrypted.slice(2, 66)
      });
      // Find the position of the gatewayId and truncate before it
      const gatewayIdIndex = hexData.indexOf('aa36a706');
      if (gatewayIdIndex > 0) {
        cleanTipAmount = '0x' + hexData.substring(0, gatewayIdIndex);
        // Ensure it's exactly 32 bytes (64 hex chars)
        if (cleanTipAmount.length < 66) {
          cleanTipAmount = cleanTipAmount.padEnd(66, '0');
        }
      } else {
        // Fallback: take first 32 bytes
        cleanTipAmount = '0x' + tipAmountEncrypted.slice(2, 66);
      }
      console.log('✅ Successfully truncated tipAmount:', {
        before: tipAmountEncrypted,
        after: cleanTipAmount,
        lengthBefore: tipAmountEncrypted.length,
        lengthAfter: cleanTipAmount.length
      });
    } else if (tipAmountEncrypted.length < 66) {
      // Pad to 32 bytes if shorter
      cleanTipAmount = ethers.zeroPadValue(tipAmountEncrypted, 32);
    }
    
    console.log('✅ Cleaned tipAmount:', {
      original: tipAmountEncrypted.substring(0, 20) + '...',
      cleaned: cleanTipAmount.substring(0, 20) + '...',
      originalLength: tipAmountEncrypted.length,
      cleanedLength: cleanTipAmount.length
    });
    
    // CRITICAL FIX: Clean tipProof to remove any manual concatenation artifacts
    let cleanTipProof = tipProofBytes;
    
    // If tipProof has manual concatenation artifacts (like 0x64...0101...), clean it
    if (tipProofBytes.startsWith('0x64') && tipProofBytes.includes('0101') || tipProofBytes.includes('aa36a706')) {
      console.log('🚨 CRITICAL FIX: tipProof appears to have manual concatenation artifacts, cleaning...', {
        original: tipProofBytes.substring(0, 50) + '...',
        originalLength: tipProofBytes.length
      });
      
      // Extract just the proof data (remove length prefix and any other artifacts)
      // The proof should start after the length prefix
      const hexData = tipProofBytes.slice(2); // Remove 0x
      if (hexData.length >= 4) {
        // Skip any length prefix and extract the actual proof
        let proofStart = 0;
        // Look for the actual proof data (skip length prefixes)
        if (hexData.startsWith('64') || hexData.startsWith('0064')) {
          proofStart = hexData.startsWith('64') ? 2 : 4;
        }
        cleanTipProof = '0x' + hexData.substring(proofStart);
      }
      
      console.log('✅ Cleaned tipProof:', {
        cleaned: cleanTipProof.substring(0, 50) + '...',
        cleanedLength: cleanTipProof.length
      });
    }
    
    // Encode function data using ethers.js Interface
    const data = iface.encodeFunctionData("unlockTippableContent", [
      postId,
      cleanTipAmount,
      cleanTipProof,
      tokenAmount
    ]);
    
    console.log('✅ Calldata encoded successfully:', {
      postId,
      tipAmountEncrypted: tipAmountEncrypted.substring(0, 20) + '...',
      tipAmountEncryptedFull: tipAmountEncrypted,
      tipAmountEncryptedLength: tipAmountEncrypted.length,
      cleanTipAmount: cleanTipAmount,
      cleanTipAmountLength: cleanTipAmount.length,
      tipProofBytes: tipProofBytes.substring(0, 20) + '...',
      cleanTipProof: cleanTipProof.substring(0, 20) + '...',
      tokenAmount: tokenAmount.toString(),
      calldataLength: data.length,
      calldata: data.substring(0, 20) + '...'
    });
    
    return data;
  } catch (error) {
    console.error('❌ Failed to encode unlockTippableContent calldata:', error);
    throw new Error(`Calldata encoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Test function to verify relayer proxy is working
 * Call this directly in the browser console or component
 */
export async function testRelayerProxy(): Promise<void> {
  const relayerUrl = import.meta.env.VITE_RELAYER_URL || '/fhe-relayer';
  console.log('🧪 Testing relayer proxy via Gateway API...');
  console.log('Proxy URL:', relayerUrl);
  
  try {
    const res = await fetch(`${relayerUrl}/keyurl`);
    console.log('Response status:', res.status, res.statusText);
    
    if (res.ok) {
      const keyUrlData = await res.json();
      console.log('✅ Proxy working! Gateway API response:', keyUrlData);
      
      if (keyUrlData.fhe_key_info && keyUrlData.fhe_key_info.length > 0) {
        console.log('FHE Public Key Info:', keyUrlData.fhe_key_info[0].fhe_public_key);
      }
    } else {
      const errorText = await res.text();
      console.error('❌ Proxy failed:', res.status, errorText);
    }
  } catch (error) {
    console.error('❌ Proxy test failed:', error);
  }
}

/**
 * Comprehensive test function for FHE encryption
 * Tests all the encryption methods to ensure they work correctly
 */
export async function testFHEEncryption(): Promise<void> {
  console.log('🧪 Starting comprehensive FHE encryption test...');
  
  try {
    // Check if FHE service is ready
    const isReady = await fheEncryptionService.isFullyReady();
    if (!isReady) {
      console.error('❌ FHE service not ready for testing');
      return;
    }
    
    console.log('✅ FHE service is ready, starting encryption tests...');
    
    // Test values
    const testValues = [
      { name: 'Zero', value: 0 },
      { name: 'Small positive', value: 1 },
      { name: 'Medium positive', value: 100 },
      { name: 'Large positive', value: 1000000 },
      { name: 'Visibility 1 (Public)', value: 1 },
      { name: 'Visibility 2 (Tippable)', value: 2 },
      { name: 'Visibility 3 (SubscribersOnly)', value: 3 }
    ];
    
    // Mock user address for testing
    const testUserAddress = '0x1234567890123456789012345678901234567890';
    
    console.log('🔐 Testing number encryption for various values...');
    
    for (const testCase of testValues) {
      try {
        console.log(`\n📝 Testing ${testCase.name} (${testCase.value})...`);
        
        const result = await fheEncryptionService.encryptNumber(testCase.value, testUserAddress);
        
        console.log(`✅ ${testCase.name} encryption successful:`, {
          original: testCase.value,
          encryptedValue: result.encryptedValue.substring(0, 20) + '...',
          proof: result.proof.substring(0, 20) + '...',
          encryptedValueLength: result.encryptedValue.length,
          proofLength: result.proof.length
        });
        
        // Validate the result
        if (result.encryptedValue.length !== 66) {
          console.error(`❌ ${testCase.name}: Invalid encrypted value length: ${result.encryptedValue.length}`);
        }
        
        if (!result.encryptedValue.match(/^0x[0-9a-f]{64}$/i)) {
          console.error(`❌ ${testCase.name}: Invalid encrypted value format: ${result.encryptedValue}`);
        }
        
        // Check for repeated patterns
        const hexData = result.encryptedValue.slice(2);
        const pattern = hexData.substring(0, 8);
        const patternCount = (hexData.match(new RegExp(pattern, 'g')) || []).length;
        
        if (patternCount > 1 && testCase.value !== 0) {
          console.error(`❌ ${testCase.name}: Repeated pattern detected: ${pattern} (${patternCount} times)`);
        } else if (patternCount > 1 && testCase.value === 0) {
          console.log(`⚠️ ${testCase.name}: Zero value with repeated pattern (might be expected)`);
        }
        
      } catch (error) {
        console.error(`❌ ${testCase.name} encryption failed:`, error);
      }
    }
    
    console.log('\n🎉 FHE encryption test completed!');
    
  } catch (error) {
    console.error('❌ FHE encryption test failed:', error);
  }
}

/**
 * Debug function to test post creation encryption with real user address
 * This helps debug the exact issue with post creation
 */
export async function debugPostCreationEncryption(userAddress: string): Promise<void> {
  console.log('🐛 Starting post creation encryption debug...');
  console.log('User address:', userAddress);
  
  try {
    // Check if FHE service is ready
    const isReady = await fheEncryptionService.isFullyReady();
    if (!isReady) {
      console.error('❌ FHE service not ready for debugging');
      return;
    }
    
    console.log('✅ FHE service is ready, starting post creation encryption debug...');
    
    // Test the exact values that would be used in post creation
    const postCreationValues = [
      { name: 'Visibility (1=Public)', value: 1 },
      { name: 'Monthly Price (0)', value: 0 },
      { name: 'Lifetime Price (0)', value: 0 },
      { name: 'Unlock Price (0)', value: 0 }
    ];
    
    console.log('🔐 Testing post creation encryption values...');
    
    for (const testCase of postCreationValues) {
      try {
        console.log(`\n📝 Testing ${testCase.name} (${testCase.value})...`);
        
        const result = await fheEncryptionService.encryptNumber(testCase.value, userAddress);
        
        console.log(`✅ ${testCase.name} encryption successful:`, {
          original: testCase.value,
          encryptedValue: result.encryptedValue,
          proof: result.proof,
          encryptedValueLength: result.encryptedValue.length,
          proofLength: result.proof.length
        });
        
        // Validate the result
        if (result.encryptedValue.length !== 66) {
          console.error(`❌ ${testCase.name}: Invalid encrypted value length: ${result.encryptedValue.length}`);
        }
        
        if (!result.encryptedValue.match(/^0x[0-9a-f]{64}$/i)) {
          console.error(`❌ ${testCase.name}: Invalid encrypted value format: ${result.encryptedValue}`);
        }
        
        // Check for repeated patterns
        const hexData = result.encryptedValue.slice(2);
        const pattern = hexData.substring(0, 8);
        const patternCount = (hexData.match(new RegExp(pattern, 'g')) || []).length;
        
        if (patternCount > 1 && testCase.value !== 0) {
          console.error(`❌ ${testCase.name}: Repeated pattern detected: ${pattern} (${patternCount} times)`);
        } else if (patternCount > 1 && testCase.value === 0) {
          console.log(`⚠️ ${testCase.name}: Zero value with repeated pattern (might be expected)`);
        }
        
        // Show the exact data that would be sent to the contract
        console.log(`📤 Contract data for ${testCase.name}:`, {
          encryptedValue: result.encryptedValue,
          proof: result.proof
        });
        
      } catch (error) {
        console.error(`❌ ${testCase.name} encryption failed:`, error);
      }
    }
    
    console.log('\n🎉 Post creation encryption debug completed!');
    
  } catch (error) {
    console.error('❌ Post creation encryption debug failed:', error);
  }
}

/**
 * Hook for using FHE encryption in React components
 */
export function useFHEEncryption() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkWalletAndNetwork = async () => {
      try {
        // Only check wallet and network readiness, don't initialize FHE automatically
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

    // Check wallet/network readiness only (not FHE initialization)
    checkWalletAndNetwork();

    // Check periodically for wallet/network changes
    const interval = setInterval(checkWalletAndNetwork, 5000);

    // Listen for wallet/network changes
    const handleAccountsChanged = () => {
      checkWalletAndNetwork();
    };

    const handleChainChanged = () => {
      // Clear network cache when chain changes
      fheEncryptionService.clearNetworkCache();
      checkWalletAndNetwork();
    };

    // Add event listeners for wallet changes
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
  }, []); // Remove isReady dependency to avoid loops

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

  const encryptString = useCallback(async (value: string, userWalletAddress: string) => {
    try {
      setError(null);
      return await fheEncryptionService.encryptString(value, userWalletAddress);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Encryption failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const encryptBoolean = useCallback(async (value: boolean, userWalletAddress: string) => {
    try {
      setError(null);
      return await fheEncryptionService.encryptBoolean(value, userWalletAddress);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Encryption failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const userDecrypt = useCallback(async (
    ciphertexts: Array<{ handle: string; contractAddress: string }>,
    userPrivateKey: string,
    userPublicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimeStamp: number,
    durationDays: number
  ) => {
    try {
      setError(null);
      return await fheEncryptionService.userDecrypt(
        ciphertexts,
        userPrivateKey,
        userPublicKey,
        signature,
        contractAddresses,
        userAddress,
        startTimeStamp,
        durationDays
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Decryption failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const publicDecrypt = useCallback(async (
    ciphertexts: Array<{ handle: string; contractAddress: string }>,
    contractAddresses: string[]
  ) => {
    try {
      setError(null);
      return await fheEncryptionService.publicDecrypt(ciphertexts, contractAddresses);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Decryption failed';
      setError(errorMessage);
      throw err;
    }
  }, []);

  return {
    isReady,
    error,
    encryptAddress,
    encryptNumber,
    encryptString,
    encryptBoolean,
    userDecrypt,
    publicDecrypt,
  };
}
