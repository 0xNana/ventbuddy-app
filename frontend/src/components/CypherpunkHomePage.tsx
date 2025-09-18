import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MatrixBackground } from './MatrixBackground';
import { CypherSequence } from './CypherText';
import { Button } from '@/components/ui/button';
import { Shield, Lock, Eye, EyeOff, Zap, Database, Wallet } from 'lucide-react';
import { useWallet } from '@/hooks/useContract';
import { useAccount } from 'wagmi';
import { useLogger } from '@/hooks/useLogger';

interface CypherpunkHomePageProps {
  onEnterApp: () => void;
}

export const CypherpunkHomePage: React.FC<CypherpunkHomePageProps> = ({ onEnterApp }) => {
  const log = useLogger('CypherpunkHomePage');
  const [uiState, setUiState] = useState({
    showContent: false,
    showEnterButton: false,
    isDecrypting: true,
    showWalletConnect: false,
    showWalletCypher: false,
  });
  
  const [sequenceCompleted, setSequenceCompleted] = useState(false);
  
  const { connectWallet, isConnected, address, isPending } = useWallet();
  const { connector } = useAccount();

  const cypherMessages = [
    "Initializing FHE Encryption Protocol...",
    "Establishing Secure Connection...",
    "Loading Privacy-Preserving Modules...",
    "Verifying Zero-Knowledge Proofs...",
    "Encrypting User Identities...",
    "System Ready. Welcome to Ventbuddy."
  ];

  const walletCypherMessages = [
    "Scanning for wallet connections...",
    "Establishing secure wallet link...",
    "Verifying wallet signature...",
    "Encrypting wallet identity...",
    "Wallet connected. Access granted."
  ];

  useEffect(() => {
    // Start the cypher sequence after a short delay
    const timer = setTimeout(() => {
      setUiState(prev => ({ ...prev, showContent: true }));
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Handle sequence completion state changes
  useEffect(() => {
    if (sequenceCompleted) {
      // Update UI state when sequence completes
      setUiState(prev => ({ 
        ...prev, 
        isDecrypting: false 
      }));
      
      // Show wallet connect button after a delay
      const walletTimer = setTimeout(() => {
        log.info('Showing wallet connect button');
        setUiState(prev => ({ 
          ...prev, 
          showWalletConnect: true 
        }));
      }, 2000);

      return () => clearTimeout(walletTimer);
    }
  }, [sequenceCompleted]); // Removed log from dependencies to prevent infinite re-renders

  const handleSequenceComplete = () => {
    log.info('Cypher sequence completed');
    setSequenceCompleted(true);
  };

  const handleWalletConnect = async () => {
    try {
      setUiState(prev => ({ ...prev, showWalletCypher: true }));
      await connectWallet();
    } catch (error) {
      log.error('Wallet connection failed', error);
      setUiState(prev => ({ ...prev, showWalletCypher: false }));
    }
  };

  const handleEnterApp = () => {
    onEnterApp();
  };

  // Memoize wallet connection state to prevent unnecessary updates
  const walletConnected = useMemo(() => isConnected && address, [isConnected, address]);

  // Compute derived UI state instead of using useEffect to avoid setState during render
  const derivedUiState = useMemo(() => {
    if (walletConnected) {
      return {
        ...uiState,
        showEnterButton: true,
        showWalletConnect: false,
        showWalletCypher: false,
      };
    } else {
      return {
        ...uiState,
        showEnterButton: false,
      };
    }
  }, [uiState, walletConnected]);

  return (
    <div className="min-h-screen bg-black text-green-400 overflow-hidden relative">
      {/* Matrix Background */}
      <MatrixBackground />
      
      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-6xl md:text-8xl font-mono font-bold mb-4 text-green-400">
            Ventbuddy
          </h1>
          <div className="text-xl md:text-2xl font-mono text-green-300 opacity-80">
            A privacy-preserving space to express yourself and find support
          </div>
        </div>

        {/* Cypher Sequence */}
        {derivedUiState.showContent && (
          <div className="max-w-4xl mx-auto text-center">
            <CypherSequence
              messages={cypherMessages}
              onComplete={handleSequenceComplete}
              className="text-lg md:text-xl"
            />
          </div>
        )}

        {/* Features Grid */}
        {!derivedUiState.isDecrypting && (
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <div className="bg-black/50 border border-green-400/30 p-6 rounded-lg backdrop-blur-sm">
              <Shield className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-mono font-bold mb-2">FHE Encryption</h3>
              <p className="text-green-300 text-sm">
                Fully Homomorphic Encryption ensures your data remains private even during computation
              </p>
            </div>
            
            {/* Zero-Knowledge Card with LOG IN Button */}
            <div className="bg-black/50 border border-green-400/30 p-6 rounded-lg backdrop-blur-sm relative">
              <Lock className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-mono font-bold mb-2">Zero-Knowledge</h3>
              <p className="text-green-300 text-sm mb-6">
                Prove your identity without revealing any personal information
              </p>
              
              {/* LOG IN Button in the center of ZK card */}
              {derivedUiState.showWalletConnect && !walletConnected && !derivedUiState.showWalletCypher && (
                <div className="animate-fade-in">
                  <Button
                    onClick={handleWalletConnect}
                    disabled={isPending}
                    className="w-full bg-green-400 text-black hover:bg-green-300 font-mono text-lg px-6 py-3 rounded-none border-2 border-green-400 hover:border-green-300 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? (
                      <>
                        <div className="h-5 w-5 mr-2 animate-spin rounded-full border-2 border-black border-t-transparent" />
                        CONNECTING...
                      </>
                    ) : (
                      <>
                        <Wallet className="h-5 w-5 mr-2" />
                        LOG IN
                      </>
                    )}
                  </Button>
                  <div className="mt-3 text-xs font-mono text-green-400/60 text-center">
                    Access the encrypted platform
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-black/50 border border-green-400/30 p-6 rounded-lg backdrop-blur-sm">
              <Database className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-mono font-bold mb-2">Decentralized</h3>
              <p className="text-green-300 text-sm">
                Built on blockchain with no central authority controlling your data
              </p>
            </div>
          </div>
        )}


        {/* Wallet Connection Cypher Sequence */}
        {derivedUiState.showWalletCypher && isPending && (
          <div className="mt-16 animate-fade-in">
            <div className="max-w-4xl mx-auto text-center">
              <CypherSequence
                messages={walletCypherMessages}
                className="text-lg md:text-xl"
              />
            </div>
          </div>
        )}

        {/* Wallet Connected Status */}
        {walletConnected && (
          <div className="mt-16 animate-fade-in">
            <div className="bg-black/50 border border-green-400/30 p-6 rounded-lg backdrop-blur-sm mb-6">
              <div className="text-center">
                <div className="text-green-400 font-mono text-lg mb-2">
                  Logged In
                </div>
                <div className="text-green-300 font-mono text-sm break-all">
                  {address}
                </div>
                <div className="text-green-400/60 font-mono text-xs mt-2">
                  {connector?.name} • Sepolia Network
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enter Button */}
        {derivedUiState.showEnterButton && (
          <div className="mt-8 animate-fade-in">
            <Button
              onClick={handleEnterApp}
              className="bg-green-400 text-black hover:bg-green-300 font-mono text-xl px-12 py-6 rounded-none border-2 border-green-400 hover:border-green-300 transition-all duration-300 transform hover:scale-105 shadow-lg shadow-green-400/25"
            >
              <Zap className="h-6 w-6 mr-3" />
              ENTER THE ROOM
            </Button>
            <div className="mt-4 text-sm font-mono text-green-400/60 text-center">
              Access the encrypted social platform
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center">
          <div className="text-sm font-mono text-green-400/60">
            "A privacy-preserving space to express yourself and find support"
          </div>
          <div className="text-xs font-mono text-green-400/40 mt-2">
            Built with FHEVM • Zero-Knowledge Proofs • Blockchain Security
          </div>
        </div>
      </div>

      {/* Glitch Effect Overlay */}
      <div className="fixed inset-0 pointer-events-none z-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-400/5 to-transparent animate-pulse"></div>
      </div>
    </div>
  );
};
