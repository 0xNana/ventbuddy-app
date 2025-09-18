import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { injected, metaMask, walletConnect, coinbaseWallet } from 'wagmi/connectors';

// Standard wagmi configuration without Porto
export const config = createConfig({
  chains: [sepolia],
  connectors: [
    injected(), // Browser wallet injection
    metaMask(), // MetaMask support
    coinbaseWallet({
      appName: 'VentBuddy',
    }),
    walletConnect({
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
    }),
  ],
  transports: {
    [sepolia.id]: http(import.meta.env.VITE_RPC_URL),
  },
  ssr: false, // Disable SSR for better performance
});

// Export types for TypeScript
export type Config = typeof config;
