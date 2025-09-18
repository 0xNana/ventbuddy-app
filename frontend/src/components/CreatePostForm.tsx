import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { useCreatePost } from '../hooks/useContract';
import { useWallet } from '../hooks/useContract';
import { useRegistrationStatus } from '../hooks/useContract';
import { useFHEEncryption } from '../lib/fhe-encryption';
import { ContentCreationProgress, defaultContentCreationSteps, type ProgressStep } from './ContentCreationProgress';
import { toast } from 'sonner';

interface CreatePostFormProps {
  onPostCreated?: (postId: string) => void;
  onPostCreatedCallback?: () => void; // Callback to refresh feed
}

export function CreatePostForm({ onPostCreated, onPostCreatedCallback }: CreatePostFormProps) {
  const { isConnected, connectWallet, address } = useWallet();
  const { createPost, isLoading, error } = useCreatePost();
  const { isRegistered, isLoading: isCheckingRegistration } = useRegistrationStatus();
  const { isReady: isFHEReady, error: fheError } = useFHEEncryption();
  
  const [formData, setFormData] = useState({
    content: '',
    visibility: '0', // 0 = Public, 1 = Tippable
    minTipAmount: '0', // Minimum tip amount for tippable posts (in ETH)
  });

  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>(defaultContentCreationSteps);
  const [currentStep, setCurrentStep] = useState(0);
  const [showProgress, setShowProgress] = useState(false);

  const updateProgressStep = (stepId: string, status: ProgressStep['status'], progress: number = 0) => {
    setProgressSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, progress }
        : step
    ));
  };

  const resetProgress = () => {
    setProgressSteps(defaultContentCreationSteps);
    setCurrentStep(0);
    setShowProgress(false);
  };

  const createPostWithProgress = async (
    content: string,
    visibility: number,
    minTipAmount: number
  ) => {
    // This function will call the original createPost but with progress tracking
    // For now, we'll simulate the progress steps and call the original function
    
    // Step 2: Content Encryption (simulated)
    updateProgressStep('encryption', 'in_progress', 50);
    await new Promise(resolve => setTimeout(resolve, 1000));
    updateProgressStep('encryption', 'completed', 100);

    // Step 3: FHE Encryption
    updateProgressStep('fhe_encryption', 'in_progress', 50);
    setCurrentStep(3);
    await new Promise(resolve => setTimeout(resolve, 1000));
    updateProgressStep('fhe_encryption', 'completed', 100);

    // Step 4: Contract Interaction
    updateProgressStep('contract', 'in_progress', 50);
    setCurrentStep(4);
    
    // Call the actual createPost function
    const result = await createPost(content, visibility, minTipAmount);
    
    updateProgressStep('contract', 'completed', 100);

    // Step 5: Event Logging
    updateProgressStep('logging', 'in_progress', 50);
    setCurrentStep(5);
    await new Promise(resolve => setTimeout(resolve, 500));
    updateProgressStep('logging', 'completed', 100);

    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected || !address) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (isCheckingRegistration) {
      toast.error('Please wait while we check your registration status');
      return;
    }

    if (!isRegistered) {
      toast.error('Please register your wallet first before creating posts');
      return;
    }

    if (!formData.content.trim()) {
      toast.error('Please enter some content');
      return;
    }

    // Validate pricing based on visibility
    if (formData.visibility === '1' && parseFloat(formData.minTipAmount) === 0) {
      toast.error('Please set a minimum tip amount for tippable posts');
      return;
    }

    try {
      // Show progress bar
      setShowProgress(true);
      setCurrentStep(0);
      
      console.log('🚀 Creating post with data:', {
        content: formData.content.substring(0, 50) + '...',
        visibility: formData.visibility,
        minTipAmount: formData.minTipAmount
      });

      // Step 1: Content Preparation
      updateProgressStep('writing', 'in_progress', 100);
      setCurrentStep(1);
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for UX
      updateProgressStep('writing', 'completed', 100);

      // Step 2: Content Encryption
      updateProgressStep('encryption', 'in_progress', 0);
      setCurrentStep(2);
      
      // Create a custom createPost function that reports progress
      const result = await createPostWithProgress(
        formData.content,
        parseInt(formData.visibility),
        parseFloat(formData.minTipAmount) * 1e18 // Convert to wei (18 decimals for ETH)
      );

      if (result && result.txHash && result.rawPostId) {
        toast.success('Post created successfully!');
        console.log('✅ Post creation result:', result);
        setFormData({
          content: '',
          visibility: '0',
          minTipAmount: '0',
        });
        onPostCreated?.(result.contentData.id.toString());
        onPostCreatedCallback?.(); // Refresh the feed
        
        // Hide progress after success
        setTimeout(() => {
          resetProgress();
        }, 2000);
      } else {
        // Post creation failed - blockchain transaction didn't complete
        console.error('❌ Post creation failed - missing blockchain data:', result);
        toast.error('Post creation failed. The content was saved locally but the blockchain transaction failed. Please try again.');
        
        // Mark current step as error
        if (currentStep > 0) {
          const currentStepId = progressSteps[currentStep - 1]?.id;
          if (currentStepId) {
            updateProgressStep(currentStepId, 'error', 0);
          }
        }
      }
    } catch (err) {
      console.error('❌ Create post error:', err);
      
      // Mark current step as error
      if (currentStep > 0) {
        const currentStepId = progressSteps[currentStep - 1]?.id;
        if (currentStepId) {
          updateProgressStep(currentStepId, 'error', 0);
        }
      }
      
      // Error message is already set by the hook
      if (error) {
        toast.error(error);
      } else {
        toast.error('Failed to create post. Please try again.');
      }
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // No complex pricing logic needed with simplified contract
      
      return newData;
    });
  };

  if (!isConnected) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Connect Wallet</CardTitle>
          <CardDescription>
            Connect your wallet to start creating posts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={connectWallet} className="w-full">
            Connect Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isCheckingRegistration) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Checking Registration</CardTitle>
          <CardDescription>
            Please wait while we verify your registration status...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isRegistered) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Registration Required</CardTitle>
          <CardDescription>
            You need to register your wallet before creating posts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Please register your wallet first to start creating posts. Registration is required to use FHE encryption features.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!isFHEReady) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>FHE Service Not Ready</CardTitle>
          <CardDescription>
            FHE encryption service is initializing...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
            <Alert>
              <AlertDescription>
                <strong>Initializing FHE Service...</strong><br/>
                Please ensure you are connected to the Sepolia network. The FHE encryption service needs to be ready before creating posts.
                {fheError && (
                  <div className="mt-2 text-sm text-red-600">
                    Error: {fheError}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show progress bar if posting is in progress
  if (showProgress) {
    return (
      <ContentCreationProgress
        steps={progressSteps}
        currentStep={currentStep}
        isVisible={showProgress}
        error={error}
      />
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create New Post</CardTitle>
        <CardDescription>
          A privacy-preserving space to express yourself and find support
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              placeholder="What's on your mind?"
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              rows={6}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="visibility">Visibility</Label>
            <Select value={formData.visibility} onValueChange={(value) => handleInputChange('visibility', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Public - Anyone can see</SelectItem>
                <SelectItem value="1">Tippable - Pay to unlock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.visibility === '1' && (
            <div className="space-y-2">
              <Label htmlFor="minTipAmount">Minimum Tip Amount (ETH)</Label>
              <Input
                id="minTipAmount"
                type="number"
                step="0.01"
                placeholder="1.00"
                value={formData.minTipAmount}
                onChange={(e) => handleInputChange('minTipAmount', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Minimum amount users need to tip to unlock the full content
              </p>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Alert>
              <AlertDescription>
                <strong>Privacy Notice:</strong> Your post content will be encrypted using FHE (Fully Homomorphic Encryption) 
                and stored securely. Only you and authorized users will be able to decrypt the content.
              </AlertDescription>
            </Alert>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || !formData.content.trim() || isCheckingRegistration || !isFHEReady}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creating Post...
              </div>
            ) : (
              'Create Post'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
