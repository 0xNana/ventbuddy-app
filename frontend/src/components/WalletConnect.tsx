import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useWallet, useRegistrationStatus } from '../hooks/useContract';
import { Wallet, LogOut, Copy, Check, UserPlus, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { EnhancedRegistrationModal } from './EnhancedRegistrationModal';
import { toast } from 'sonner';
import { useState } from 'react';
import { switchToSepolia } from '../lib/network-utils';

export function WalletConnect() {
  const { address, isConnected, connector, connectWallet, disconnect, isPending, networkInfo } = useWallet();
  const [copied, setCopied] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [isSwitchingNetwork, setIsSwitchingNetwork] = useState(false);
  const { isRegistered } = useRegistrationStatus();
  // Removed Porto-specific functionality

  const handleCopyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success('Address copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleRegistration = () => {
    setShowRegistrationModal(true);
  };

  const handleSwitchNetwork = async () => {
    setIsSwitchingNetwork(true);
    try {
      await switchToSepolia();
      toast.success('Successfully switched to Sepolia network');
    } catch (error) {
      console.error('Network switch failed:', error);
      toast.error('Failed to switch network. Please switch manually in your wallet.');
    } finally {
      setIsSwitchingNetwork(false);
    }
  };

  // Removed Porto permissions functionality

  if (!isConnected) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Wallet className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Connect Your Wallet</CardTitle>
          <CardDescription>
            Connect your wallet to start using Ventbuddy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={connectWallet} 
            className="w-full" 
            disabled={isPending}
            size="lg"
          >
            {isPending ? 'Connecting...' : 'Connect Wallet'}
          </Button>
          <div className="mt-4 text-center space-y-2">
            <Badge variant="outline" className="text-xs">
              Standard Wallet Integration
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Wallet Connected</CardTitle>
              <CardDescription>
                {connector?.name || 'Unknown Wallet'}
              </CardDescription>
              <div className="flex items-center gap-1 mt-1">
                {isRegistered === true ? (
                  <>
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span className="text-xs text-green-600">Account Registered</span>
                  </>
                ) : isRegistered === false ? (
                  <>
                    <UserPlus className="h-3 w-3 text-orange-500" />
                    <span className="text-xs text-orange-600">Account Not Registered</span>
                  </>
                ) : null}
              </div>
              {/* Removed Porto account indicator */}
            </div>
            <Badge variant="default" className="bg-green-500">
              Connected
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Network Status */}
          {networkInfo && (
            <div className={`p-3 rounded-lg border ${
              networkInfo.isSepolia 
                ? 'bg-green-50 border-green-200' 
                : 'bg-orange-50 border-orange-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {networkInfo.isSepolia ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {networkInfo.isSepolia ? 'Sepolia Network' : 'Wrong Network'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {networkInfo.chainName}
                    </p>
                  </div>
                </div>
                {!networkInfo.isSepolia && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSwitchNetwork}
                    disabled={isSwitchingNetwork}
                    className="text-xs"
                  >
                    {isSwitchingNetwork ? (
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    Switch
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <Wallet className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Address</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {formatAddress(address!)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyAddress}
              className="h-8 w-8 p-0"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>

          {isRegistered === false && (
            <Button
              onClick={handleRegistration}
              className="w-full"
              size="sm"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Register Account
            </Button>
          )}

          {/* Removed Porto permissions button */}

          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handleCopyAddress}
              className="flex-1"
              size="sm"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Address
            </Button>
            <Button
              variant="outline"
              onClick={() => disconnect()}
              className="flex-1"
              size="sm"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
          </div>

          <div className="text-center space-y-2">
            <Badge variant="outline" className="text-xs">
              Standard Wallet Integration
            </Badge>
          </div>
        </CardContent>
      </Card>
      
      {/* Registration Modal */}
      {address && (
        <EnhancedRegistrationModal
          isOpen={showRegistrationModal}
          onClose={() => setShowRegistrationModal(false)}
          userAddress={address}
        />
      )}
    </>
  );
}
