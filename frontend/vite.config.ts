import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import mkcert from "vite-plugin-mkcert";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    server: {
      host: "::",
      port: 3000,
      // mkcert plugin will automatically configure HTTPS
      // Note: Headers removed to avoid conflict between FHEVM (needs same-origin) and Coinbase Wallet (needs not same-origin)
      // FHEVM should work without WebAssembly threads in most cases
      proxy: {
        '/relayer': {
          target: 'https://relayer.testnet.zama.cloud',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/relayer/, ''),
        },
      },
    },
    optimizeDeps: {
      exclude: ['@zama-fhe/relayer-sdk/web'],
      include: ['keccak', 'fetch-retry', '@zama-fhe/relayer-sdk/bundle'],
    },
    plugins: [
      mkcert(), // Automatically generate and trust local HTTPS certificates
      react(), 
      mode === "development" && componentTagger(),
      // Custom plugin to handle problematic CommonJS modules
      {
        name: 'fix-commonjs-modules',
        configResolved(config: any) {
          // Force these modules to be treated as CommonJS
          config.optimizeDeps.include = config.optimizeDeps.include || [];
          config.optimizeDeps.include.push('keccak', 'fetch-retry');
        }
      }
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "keccak/js": "keccak/lib/keccak",
        "fetch-retry": "fetch-retry/dist/fetch-retry.umd.js",
      },
    },
    assetsInclude: ['**/*.wasm'],
    build: {
      commonjsOptions: {
        include: [/keccak/, /fetch-retry/, /node_modules/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        external: [],
        output: {
          globals: {},
        },
      },
      assetsInlineLimit: 0, // Don't inline WASM files
    },
    define: {
      global: 'globalThis',
    },
    worker: {
      format: 'es',
    },
    ssr: {
      noExternal: ['keccak', 'fetch-retry'],
    },
  };
});
