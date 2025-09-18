import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { 
  DollarSign, 
  Download,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { useWallet } from '../hooks/useContract';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { useLogger } from '../hooks/useLogger';

interface CreatorEarningsProps {
  creatorAddress: string;
}

export function CreatorEarnings({
  creatorAddress
}: CreatorEarningsProps) {
  const log = useLogger('CreatorEarnings');
  const { address } = useAccount();
  const { walletClient } = useWallet();
  const [isClaiming, setIsClaiming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [earningsData, setEarningsData] = useState({
    totalEarnings: 0,
    monthlyEarnings: 0,
    tipCount: 0,
    lastClaimed: 'Never',
    claimableAmount: 0
  });

  // Fetch real earnings data from Supabase
  const fetchEarningsData = async (isRefresh = false) => {
    if (!creatorAddress) {
      setIsLoading(false);
      return;
    }

    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      log.info('Fetching tip earnings data for creator', { creatorAddress });

      // First, get the creator's encrypted address from user_sessions
      const { data: userSession, error: sessionError } = await supabase
        .from('user_sessions')
        .select('encrypted_address')
        .eq('wallet_address', creatorAddress)
        .maybeSingle();

      if (sessionError) {
        log.error('Error fetching creator session', sessionError);
        if (isRefresh) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
        return;
      }

      if (!userSession?.encrypted_address) {
        log.warn('No encrypted address found for creator', { creatorAddress });
        // Set default values for creators without encrypted address
        setEarningsData({
          totalEarnings: 0,
          monthlyEarnings: 0,
          tipCount: 0,
          lastClaimed: 'Never',
          claimableAmount: 0
        });
        if (isRefresh) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
        return;
      }

      const creatorEncryptedAddress = userSession.encrypted_address;

      // Fetch tip earnings from access_logs table
      const { data: tipData, error: tipError } = await supabase
        .from('access_logs')
        .select('amount_wei, created_at')
        .eq('user_encrypted_id', creatorEncryptedAddress)
        .eq('access_type', 'tip');

      if (tipError) {
        log.error('Error fetching tip data', tipError);
        toast.error('Failed to load tip data');
        if (isRefresh) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
        return;
      }

      // Calculate tip earnings
      const tips = tipData || [];
      
      // Convert from wei to ETH and calculate totals
      const totalEarningsWei = tips.reduce((sum, tip) => sum + (tip.amount_wei || 0), 0);
      const totalEarnings = totalEarningsWei / 1e18; // Convert wei to ETH
      
      const monthlyEarningsWei = tips
        .filter(tip => {
          const tipDate = new Date(tip.created_at);
          const now = new Date();
          return tipDate.getMonth() === now.getMonth() && tipDate.getFullYear() === now.getFullYear();
        })
        .reduce((sum, tip) => sum + (tip.amount_wei || 0), 0);
      const monthlyEarnings = monthlyEarningsWei / 1e18; // Convert wei to ETH

      const tipCount = tips.length;

      // Get last claimed date (this would come from contract in production)
      const lastClaimed = 'Never'; // Placeholder - would need contract integration

      setEarningsData({
        totalEarnings,
        monthlyEarnings,
        tipCount,
        lastClaimed,
        claimableAmount: totalEarnings * 0.9 // 90% claimable (10% platform fee)
      });

      log.info('Tip earnings data fetched', {
        totalEarnings,
        monthlyEarnings,
        tipCount,
        creatorEncryptedAddress: creatorEncryptedAddress.substring(0, 10) + '...'
      });

      if (isRefresh) {
        toast.success('Earnings data refreshed!');
      }

    } catch (error) {
      log.error('Failed to fetch earnings data', error);
      toast.error('Failed to load earnings data');
    } finally {
      if (isRefresh) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchEarningsData();
  }, [creatorAddress]);

  const handleClaimEarnings = async () => {
    if (!walletClient || !address) {
      toast.error('Wallet not connected');
      return;
    }

    if (earningsData.claimableAmount <= 0) {
      toast.error('No earnings to claim');
      return;
    }

    // Verify the connected wallet matches the creator address
    if (address.toLowerCase() !== creatorAddress.toLowerCase()) {
      toast.error('You can only claim earnings for your own account');
      return;
    }

    setIsClaiming(true);

    try {
      log.info('Claiming earnings', { amount: earningsData.claimableAmount });
      
      // Import contract and claim earnings
      const { VentbuddyContract } = await import('../lib/contract');
      const contract = new VentbuddyContract(walletClient);
      
      // Convert ETH to wei for the contract call
      const claimAmountWei = BigInt(Math.floor(earningsData.claimableAmount * 1e18));
      
      log.info('Calling contract.claimEarnings with amount', {
        eth: earningsData.claimableAmount,
        wei: claimAmountWei.toString()
      });
      
      // Call the smart contract to claim earnings
      const txHash = await contract.claimEarnings(claimAmountWei);
      
      log.info('Claim transaction submitted', { txHash });
      toast.success(`Claim transaction submitted! Hash: ${txHash.substring(0, 10)}...`);
      
      // Update earnings data after successful claim
      setEarningsData(prev => ({
        ...prev,
        claimableAmount: 0,
        lastClaimed: new Date().toLocaleDateString()
      }));
      
      // Refresh earnings data to get updated amounts
      setTimeout(() => {
        window.location.reload(); // Simple refresh - could be improved with state management
      }, 3000);
      
    } catch (error: any) {
      log.error('Claim earnings failed', error);
      
      // Handle specific error cases
      if (error.message?.includes('insufficient funds')) {
        toast.error('Insufficient funds for transaction gas');
      } else if (error.message?.includes('user rejected')) {
        toast.error('Transaction was rejected by user');
      } else if (error.message?.includes('no earnings to claim')) {
        toast.error('No earnings available to claim');
      } else {
        toast.error(`Failed to claim earnings: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsClaiming(false);
    }
  };


  const formatEarnings = (amount: number) => {
    if (amount === 0) return '0.00';
    if (amount < 0.01) return amount.toFixed(6); // Show more decimals for small amounts
    return amount.toFixed(4); // Show 4 decimals for larger amounts
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading earnings data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Earnings Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Earnings Overview
              </CardTitle>
              <CardDescription>
                Track your earnings and manage payouts
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchEarningsData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {formatEarnings(earningsData.totalEarnings)} ETH
              </div>
              <div className="text-sm text-muted-foreground">Total Tip Earnings</div>
            </div>
            
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {formatEarnings(earningsData.monthlyEarnings)} ETH
              </div>
              <div className="text-sm text-muted-foreground">This Month's Tips</div>
            </div>
            
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {earningsData.tipCount}
              </div>
              <div className="text-sm text-muted-foreground">Total Tips Received</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Claimable Earnings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Claimable Earnings
          </CardTitle>
          <CardDescription>
            Withdraw your earnings to your wallet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {formatEarnings(earningsData.claimableAmount)} ETH
              </div>
              <div className="text-sm text-muted-foreground">
                Available to claim
              </div>
            </div>
            <Button 
              onClick={handleClaimEarnings}
              disabled={isClaiming || earningsData.claimableAmount <= 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {isClaiming ? 'Claiming...' : 'Claim Earnings'}
            </Button>
          </div>
        </CardContent>
      </Card>


    </div>
  );
}
