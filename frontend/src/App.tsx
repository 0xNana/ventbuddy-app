import React, { useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WagmiProvider } from 'wagmi';
import { config } from './lib/wagmi';
import { ErrorBoundary } from './components/ErrorBoundary';
import { VisibilitySystemProvider } from './components/VisibilitySystemProvider';
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { CypherpunkHomePage } from './components/CypherpunkHomePage';


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 3,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  const [showCypherpunkHome, setShowCypherpunkHome] = useState(true);

  const handleEnterApp = () => {
    setShowCypherpunkHome(false);
  };

  if (showCypherpunkHome) {
    return (
      <ErrorBoundary>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <CypherpunkHomePage onEnterApp={handleEnterApp} />
            </TooltipProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </ErrorBoundary>
    );
  }

  // Go directly to main app - no old interface
  return (
    <ErrorBoundary>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <VisibilitySystemProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Index />} />
                  {/* Removed test-registration route - component deleted */}
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </VisibilitySystemProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  );
};

export default App;
