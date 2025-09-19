import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Wallet, 
  LogOut, 
  Copy, 
  ExternalLink,
  Shield,
  Coins,
  UserPlus,
  CheckCircle
} from 'lucide-react';
import { useWallet, useRegistrationStatus } from '@/hooks/useContract';
import { EnhancedRegistrationModal } from '@/components/EnhancedRegistrationModal';
import { toast } from 'sonner';

export function ProfileDropdown() {
  const { address, isConnected, connector } = useAccount();
  const { disconnect } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const { isRegistered } = useRegistrationStatus();

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast.success('Address copied to clipboard');
    }
  };

  const openExplorer = () => {
    if (address) {
      window.open(`https://sepolia.etherscan.io/address/${address}`, '_blank');
    }
  };

  const navigateToProfile = () => {
    const event = new CustomEvent('navigateToTab', { detail: { tab: 'profile' } });
    window.dispatchEvent(event);
    setIsOpen(false);
  };

  const handleRegistration = () => {
    setShowRegistrationModal(true);
    setIsOpen(false);
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getWalletIcon = () => {
    if (connector?.name.toLowerCase().includes('metamask')) {
      return '🦊';
    }
    return '🔗';
  };

  if (!isConnected || !address) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <User className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="relative flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs">
                {getWalletIcon()}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">Account</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80" align="end">
          <DropdownMenuLabel className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                {getWalletIcon()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Connected Wallet</span>
                <Badge variant="outline" className="text-xs">
                  {connector?.name || 'Unknown'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground font-mono">
                {formatAddress(address)}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {isRegistered === true ? (
                  <>
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span className="text-xs text-green-600">Registered</span>
                  </>
                ) : isRegistered === false ? (
                  <>
                    <UserPlus className="h-3 w-3 text-orange-500" />
                    <span className="text-xs text-orange-600">Not Registered</span>
                  </>
                ) : null}
              </div>
            </div>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          {isRegistered === false && (
            <DropdownMenuItem onClick={handleRegistration} className="cursor-pointer">
              <UserPlus className="mr-2 h-4 w-4" />
              Register Account
            </DropdownMenuItem>
          )}
          
          <DropdownMenuItem onClick={copyAddress} className="cursor-pointer">
            <Copy className="mr-2 h-4 w-4" />
            Copy Address
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={openExplorer} className="cursor-pointer">
            <ExternalLink className="mr-2 h-4 w-4" />
            View on Etherscan
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={navigateToProfile} className="cursor-pointer">
            <Wallet className="mr-2 h-4 w-4" />
            Wallet Settings
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={navigateToProfile} className="cursor-pointer">
            <Shield className="mr-2 h-4 w-4" />
            Privacy Settings
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={navigateToProfile} className="cursor-pointer">
            <Coins className="mr-2 h-4 w-4" />
            Earnings
          </DropdownMenuItem>
          
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem 
            onClick={() => disconnect()} 
            className="cursor-pointer text-red-600 focus:text-red-600"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Disconnect Wallet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
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
