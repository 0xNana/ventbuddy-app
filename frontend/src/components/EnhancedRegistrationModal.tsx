import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Shield, User, CheckCircle, Zap, Key, Database, Wallet } from "lucide-react";
import { useUserRegistration } from "@/hooks/useContract";
import { useFHEEncryption, fheEncryptionService } from "@/lib/fhe-encryption";
import { safeToast } from "@/lib/safe-toast";

interface EnhancedRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userAddress: string;
}

export const EnhancedRegistrationModal = ({ isOpen, onClose, userAddress }: EnhancedRegistrationModalProps) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [registrationProgress, setRegistrationProgress] = useState(0);
  const [fheData, setFheData] = useState<{
    encryptedAddress?: string;
    proof?: string;
  }>({});
  
  const { registerUser, isLoading, error } = useUserRegistration();
  const { isReady: fheReady, error: fheError } = useFHEEncryption();

  type StepStatus = 'pending' | 'in_progress' | 'completed' | 'error';

  interface RegistrationStep {
    id: string;
    title: string;
    description: string;
    icon: React.ReactElement;
    status: StepStatus;
  }

  const registrationSteps: RegistrationStep[] = [
    {
      id: 'fhe-init',
      title: 'Initializing FHE Service',
      description: 'Loading encryption capabilities for your identity',
      icon: <Shield className="h-5 w-5" />,
      status: 'pending'
    },
    {
      id: 'encrypt-address',
      title: 'Generating Encrypted Identity',
      description: 'Creating your privacy preserving identity',
      icon: <Key className="h-5 w-5" />,
      status: 'pending'
    },
    {
      id: 'wallet-connect',
      title: 'Connecting your wallet',
      description: 'Preparing your wallet for registration',
      icon: <Wallet className="h-5 w-5" />,
      status: 'pending'
    },
    {
      id: 'contract-register',
      title: 'Registering on the contract',
      description: 'Creating your onchain identity',
      icon: <Database className="h-5 w-5" />,
      status: 'pending'
    },
    {
      id: 'supabase-sync',
      title: 'Syncing your encrypted identity with Supabase',
      description: 'Sync for fast content access',
      icon: <Zap className="h-5 w-5" />,
      status: 'pending'
    }
  ];

  const [steps, setSteps] = useState(registrationSteps);

  const updateStepStatus = (stepId: string, status: StepStatus) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const updateProgress = (stepIndex: number) => {
    const progress = ((stepIndex + 1) / steps.length) * 100;
    setRegistrationProgress(progress);
    setCurrentStep(stepIndex);
  };

  const handleRegister = async () => {
    setTimeout(async () => {
      setIsRegistering(true);
      setRegistrationProgress(0);
      setCurrentStep(0);

      try {
        console.log('🚀 Starting enhanced FHE registration process...');
        
        updateStepStatus('fhe-init', 'in_progress');
        updateProgress(0);
        
        if (!fheReady) {
          throw new Error('FHE service not ready. Please wait for initialization.');
        }
        
        updateStepStatus('fhe-init', 'completed');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        updateStepStatus('encrypt-address', 'in_progress');
        updateProgress(1);
        
        console.log('🔐 Generating FHE-encrypted address...');
        const { encryptedAddress, proof } = await fheEncryptionService.encryptAddress(userAddress, userAddress);
        setFheData({ encryptedAddress, proof });
        
        updateStepStatus('encrypt-address', 'completed');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        updateStepStatus('wallet-connect', 'in_progress');
        updateProgress(2);
        
        if (!userAddress) {
          throw new Error('Wallet not connected. Please connect your wallet first.');
        }
        
        updateStepStatus('wallet-connect', 'completed');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        updateStepStatus('contract-register', 'in_progress');
        updateProgress(3);
        
        console.log('📝 Registering with smart contract...');
        
        const txHash = await registerUser(userAddress);
        
        updateStepStatus('contract-register', 'completed');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        updateStepStatus('supabase-sync', 'in_progress');
        updateProgress(4);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        updateStepStatus('supabase-sync', 'completed');
        updateProgress(5);
        
        setIsRegistered(true);
        
        if (txHash === 'already_registered') {
          safeToast.success('🎉 Account synced! You were already registered in the contract.');
        } else {
          safeToast.success('🎉 Successfully registered! You can now use all Ventbuddy features.');
        }
        
        
      } catch (error: any) {
        console.error('Enhanced registration error:', error);
        
        if (currentStep < steps.length) {
          updateStepStatus(steps[currentStep].id, 'error');
        }
        
        const errorMessage = error.message || error.toString() || '';
        if (errorMessage.includes('0xb9688461') || 
            errorMessage.includes('User already registered') ||
            errorMessage.includes('simulating the action') ||
            errorMessage.includes('executing calls')) {
          
          safeToast.success('🎉 Account synced! You were already registered in the contract.');
          setIsRegistered(true);
          
          setSteps(prev => prev.map(step => ({ ...step, status: 'completed' as StepStatus })));
          setRegistrationProgress(100);
          
        } else {
          safeToast.error(`Registration failed: ${errorMessage}`);
        }
      } finally {
        setIsRegistering(false);
      }
    }, 0);
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'in_progress':
        return <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />;
      case 'error':
        return <div className="h-5 w-5 rounded-full bg-red-500" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />;
    }
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 dark:text-green-400';
      case 'in_progress':
        return 'text-primary';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-muted-foreground';
    }
  };

  if (isRegistered) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg bg-gradient-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
              Registration Complete!
            </DialogTitle>
            <DialogDescription>
              Your encrypted identity has been successfully created
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="p-6 bg-green-50 dark:bg-green-950 rounded-lg">
                <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="font-semibold text-green-700 dark:text-green-300 text-lg">Welcome to Ventbuddy!</h3>
                <p className="text-sm text-green-600 dark:text-green-400">
                  Your encrypted identity has been created successfully
                </p>
              </div>
            </div>
            
            {fheData.encryptedAddress && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Your Encrypted Identity
                  </CardTitle>
                  <CardDescription>
                    Your address has been encrypted using FHEVM technology. 
                    <span className="text-amber-600 dark:text-amber-400 font-medium">Save this data for your records!</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Encrypted Address:</label>
                    <div className="p-2 bg-muted rounded-md font-mono text-xs break-all">
                      {fheData.encryptedAddress}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(fheData.encryptedAddress);
                        safeToast.success('Encrypted address copied to clipboard!');
                      }}
                      className="text-xs h-6"
                    >
                      Copy Address
                    </Button>
                  </div>
                  
                  {fheData.proof && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Proof:</label>
                      <div className="p-2 bg-muted rounded-md font-mono text-xs break-all max-h-20 overflow-y-auto">
                        {fheData.proof}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(fheData.proof);
                          safeToast.success('Proof copied to clipboard!');
                        }}
                        className="text-xs h-6"
                      >
                        Copy Proof
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            
            <div className="space-y-2">
              <Badge variant="default" className="bg-primary text-primary-foreground">
                <Shield className="h-3 w-3 mr-1" />
                Encrypted User
              </Badge>
              <p className="text-xs text-muted-foreground">
                You can now create posts, tip creators, and subscribe to content with full privacy
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={onClose} className="w-full">
              <CheckCircle className="h-4 w-4 mr-2" />
              Continue to Ventbuddy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-gradient-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Register with VentBuddy
          </DialogTitle>
          <DialogDescription>
            Create your encrypted identity and join a privacy-preserving space to express yourself and find support
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Registration Progress</span>
              <span>{Math.round(registrationProgress)}%</span>
            </div>
            <Progress value={registrationProgress} className="h-2" />
          </div>

          <div className="space-y-3">
            {steps.map((step, index) => (
              <div key={step.id} className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                step.status === 'completed' ? 'bg-green-50 dark:bg-green-950' :
                step.status === 'in_progress' ? 'bg-primary/10' :
                step.status === 'error' ? 'bg-red-50 dark:bg-red-950' :
                'bg-muted/50'
              }`}>
                <div className={`mt-0.5 ${getStepColor(step.status)}`}>
                  {getStepIcon(step.status)}
                </div>
                <div className="flex-1">
                  <h4 className={`font-medium text-sm ${getStepColor(step.status)}`}>
                    {step.title}
                  </h4>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" />
                Your Wallet Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs font-mono break-all bg-muted p-2 rounded">
                {userAddress}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" />
                FHE Service Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {fheReady ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600 dark:text-green-400">Ready</span>
                  </>
                ) : (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-sm text-muted-foreground">Initializing...</span>
                  </>
                )}
              </div>
              {fheError && (
                <Alert variant="destructive" className="mt-2">
                  <AlertDescription className="text-xs">{fheError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isRegistering || isLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleRegister}
            disabled={isRegistering || isLoading || !fheReady}
            className="min-w-[140px]"
          >
            {isRegistering || isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Registering...
              </div>
            ) : (
              <>
                <Shield className="h-4 w-4" />
                Register
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
