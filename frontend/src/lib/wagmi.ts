import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { injected, metaMask, walletConnect, coinbaseWallet } from 'wagmi/connectors';

export const config = createConfig({
  chains: [sepolia],
  connectors: [
    injected(),
    metaMask(),
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
  ssr: false,
});

export type Config = typeof config;
