import { useAccount } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLogger } from '@/hooks/useLogger';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Wallet, 
  Copy, 
  ExternalLink, 
  Shield, 
  Coins, 
  User,
  TrendingUp,
  UserPlus,
  CheckCircle
} from 'lucide-react';
import { useRegistrationStatus } from '@/hooks/useContract';
import { CreatorEarnings } from '@/components/CreatorEarnings';
import { UsernameSettings } from './UsernameSettings';
import { EnhancedRegistrationModal } from '@/components/EnhancedRegistrationModal';
import { ProfileCardSkeleton } from './ProfileCardSkeleton';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function ProfileCard() {
  const log = useLogger('ProfileCard');
  const { address, isConnected, connector } = useAccount();
  const { isRegistered } = useRegistrationStatus();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'earnings' | 'username'>('profile');
  const [accountStats, setAccountStats] = useState({
    postsCreated: 0,
    ethEarned: 0,
    tipsReceived: 0,
    totalUpvotes: 0,
    totalDownvotes: 0
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);

  useEffect(() => {
    const fetchAccountStats = async () => {
      if (!address) {
        setIsLoadingStats(false);
        return;
      }

      setIsLoadingStats(true);
      try {
        log.info('Fetching account stats', { address });

        const { data: userSession, error: sessionError } = await supabase
          .from('user_sessions')
          .select('encrypted_address')
          .eq('wallet_address', address)
          .maybeSingle();

        if (sessionError) {
          log.error('Error fetching user session', sessionError);
          setIsLoadingStats(false);
          return;
        }

        const encryptedAddress = userSession?.encrypted_address;
        if (!encryptedAddress) {
          log.warn('No encrypted address found for user - user may not be registered yet', { address });
          setAccountStats({
            postsCreated: 0,
            ethEarned: 0,
            tipsReceived: 0,
            totalUpvotes: 0,
            totalDownvotes: 0
          });
          setIsLoadingStats(false);
          return;
        }

        const { data: postsData, error: postsError } = await supabase
          .from('encrypted_content')
          .select('id')
          .eq('author_id', encryptedAddress);

        if (postsError) {
          log.error('Error fetching posts', postsError);
        }

        const { data: tipData, error: tipError } = await supabase
          .from('access_logs')
          .select('amount_wei')
          .eq('user_encrypted_id', encryptedAddress)
          .eq('access_type', 'tip');

        if (tipError) {
          log.error('Error fetching tip data', tipError);
        }


        const { data: postEngagementData, error: postEngagementError } = await supabase
          .from('post_engagement')
          .select('engagement_type')
          .eq('user_encrypted_id', encryptedAddress);

        if (postEngagementError) {
          log.error('Error fetching post engagement data', postEngagementError);
        }

        const postsCreated = postsData?.length || 0;
        const ethEarned = tipData?.reduce((sum, tip) => sum + (tip.amount_wei || 0), 0) || 0;
        const tipsReceived = tipData?.length || 0;
        
        const totalUpvotes = postEngagementData?.filter(engagement => engagement.engagement_type === 'upvote').length || 0;
        const totalDownvotes = postEngagementData?.filter(engagement => engagement.engagement_type === 'downvote').length || 0;

        setAccountStats({
          postsCreated,
          ethEarned: ethEarned / 1e18,
          tipsReceived,
          totalUpvotes,
          totalDownvotes
        });

        log.info('Account stats fetched', {
          postsCreated,
          ethEarned: ethEarned / 1e18,
          tipsReceived,
          totalUpvotes,
          totalDownvotes,
          encryptedAddress: encryptedAddress.substring(0, 10) + '...'
        });

      } catch (error) {
        log.error('Failed to fetch account stats', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchAccountStats();
  }, [address]);

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

  const handleRegistration = () => {
    setShowRegistrationModal(true);
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>
            Connect your wallet to view your profile
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Please connect your wallet to access your Ventbuddy profile and settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoadingStats) {
    return <ProfileCardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        <Button
          variant={activeTab === 'profile' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('profile')}
          className="flex items-center gap-2"
        >
          <User className="h-4 w-4" />
          Profile
        </Button>
        <Button
          variant={activeTab === 'username' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('username')}
          className="flex items-center gap-2"
        >
          <User className="h-4 w-4" />
          Username
        </Button>
        <Button
          variant={activeTab === 'earnings' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('earnings')}
          className="flex items-center gap-2"
        >
          <TrendingUp className="h-4 w-4" />
          Earnings
        </Button>
      </div>

      {activeTab === 'profile' && (
        <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Connected Wallet
          </CardTitle>
          <CardDescription>
            Your wallet information and connection details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-gradient-primary text-primary-foreground text-2xl">
                {getWalletIcon()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold">{connector?.name || 'Unknown Wallet'}</h3>
                <Badge variant="outline" className="text-xs">
                  Connected
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground font-mono">
                {formatAddress(address)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Sepolia Testnet
              </p>
              <div className="flex items-center gap-1 mt-2">
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
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {isRegistered === false && (
              <Button variant="default" size="sm" onClick={handleRegistration}>
                <UserPlus className="h-4 w-4 mr-2" />
                Register Account
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={copyAddress}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Address
            </Button>
            <Button variant="outline" size="sm" onClick={openExplorer}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View on Etherscan
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Account Statistics
          </CardTitle>
          <CardDescription>
            {isRegistered === false ? 'Register your account to start tracking your activity and earnings' : 'Your activity and earnings on Ventbuddy'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">
                {isLoadingStats ? '...' : accountStats.postsCreated}
              </div>
              <div className="text-sm text-muted-foreground">Posts Created</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {isLoadingStats ? '...' : `${accountStats.ethEarned.toFixed(4)} ETH`}
              </div>
              <div className="text-sm text-muted-foreground">ETH Earned</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {isLoadingStats ? '...' : accountStats.tipsReceived}
              </div>
              <div className="text-sm text-muted-foreground">Tips Received</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-emerald-600">
                {isLoadingStats ? '...' : accountStats.totalUpvotes}
              </div>
              <div className="text-sm text-muted-foreground">Upvotes Received</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy & Security
          </CardTitle>
          <CardDescription>
            Your privacy settings and security information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Content Encryption</h4>
              <p className="text-sm text-muted-foreground">
                All your content is encrypted client-side
              </p>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-600">
              Active
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Wallet Privacy</h4>
              <p className="text-sm text-muted-foreground">
                Your wallet address is encrypted on-chain
              </p>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-600">
              Protected
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">FHEVM Integration</h4>
              <p className="text-sm text-muted-foreground">
                Fully homomorphic encryption for on-chain privacy
              </p>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-600">
              Enabled
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Tip Settings
          </CardTitle>
          <CardDescription>
            Manage your tippable content settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="h-4 w-4 text-yellow-500" />
              <h4 className="font-medium">Tippable Content</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              When creating posts, you can set them as "Tippable" to require a minimum tip amount for users to unlock and view the content. 
              This allows you to monetize your content directly through tips.
            </p>
          </div>
          
        </CardContent>
      </Card>
        </>
      )}

      {activeTab === 'username' && (
        <UsernameSettings />
      )}

      {activeTab === 'earnings' && (
        <CreatorEarnings
          creatorAddress={address}
        />
      )}

      {address && (
        <EnhancedRegistrationModal
          isOpen={showRegistrationModal}
          onClose={() => setShowRegistrationModal(false)}
          userAddress={address}
        />
      )}
    </div>
  );
}
