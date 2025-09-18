import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { 
  FileText, 
  Lock, 
  Shield, 
  Smartphone, 
  Database,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

export interface ProgressStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progress: number; // 0-100
}

interface ContentCreationProgressProps {
  steps: ProgressStep[];
  currentStep: number;
  isVisible: boolean;
  error?: string | null;
}

export function ContentCreationProgress({ 
  steps, 
  currentStep, 
  isVisible, 
  error 
}: ContentCreationProgressProps) {
  if (!isVisible) return null;

  const getStepIcon = (step: ProgressStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return step.icon;
    }
  };

  const getStepBadge = (step: ProgressStep) => {
    switch (step.status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-xs px-1.5 py-0.5">Done</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600 text-xs px-1.5 py-0.5">Active</Badge>;
      case 'error':
        return <Badge variant="destructive" className="text-xs px-1.5 py-0.5">Error</Badge>;
      default:
        return <Badge variant="outline" className="text-xs px-1.5 py-0.5">Pending</Badge>;
    }
  };

  const overallProgress = steps.reduce((acc, step) => acc + step.progress, 0) / steps.length;

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-4 w-4" />
          Creating Post
        </CardTitle>
        <CardDescription className="text-sm">
          Processing your content securely
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{Math.round(overallProgress)}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="h-3 w-3" />
              <span className="text-xs font-medium">Error occurred</span>
            </div>
            <p className="text-xs text-red-300 mt-1">{error}</p>
          </div>
        )}

        {/* Steps */}
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div 
              key={step.id}
              className={`flex items-center gap-3 p-2 rounded-md transition-all ${
                step.status === 'in_progress' 
                  ? 'bg-blue-500/10 border border-blue-500/20' 
                  : step.status === 'completed'
                  ? 'bg-green-500/10 border border-green-500/20'
                  : step.status === 'error'
                  ? 'bg-red-500/10 border border-red-500/20'
                  : 'bg-muted/30'
              }`}
            >
              <div className="flex-shrink-0">
                {getStepIcon(step)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-xs">{step.title}</h4>
                  {getStepBadge(step)}
                </div>
                
                {step.status === 'in_progress' && (
                  <div className="mt-1">
                    <Progress value={step.progress} className="h-1" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Security Notice */}
        <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-md">
          <div className="flex items-center gap-2 text-blue-400 mb-1">
            <Shield className="h-3 w-3" />
            <span className="font-medium text-xs">Secure Processing</span>
          </div>
          <p className="text-xs text-blue-300">
            Content encrypted with FHE and stored securely
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Default steps for content creation
export const defaultContentCreationSteps: ProgressStep[] = [
  {
    id: 'writing',
    title: 'Content Preparation',
    description: 'Validating your post content and settings',
    icon: <FileText className="h-4 w-4 text-muted-foreground" />,
    status: 'pending',
    progress: 0
  },
  {
    id: 'encryption',
    title: 'Content Encryption',
    description: 'Encrypting and storing your content securely',
    icon: <Lock className="h-4 w-4 text-muted-foreground" />,
    status: 'pending',
    progress: 0
  },
  {
    id: 'fhe_encryption',
    title: 'FHE Parameter Encryption',
    description: 'Encrypting visibility and pricing parameters',
    icon: <Shield className="h-4 w-4 text-muted-foreground" />,
    status: 'pending',
    progress: 0
  },
  {
    id: 'contract',
    title: 'Smart Contract Interaction',
    description: 'Submitting your post to the blockchain',
    icon: <Smartphone className="h-4 w-4 text-muted-foreground" />,
    status: 'pending',
    progress: 0
  },
  {
    id: 'logging',
    title: 'Event Logging',
    description: 'Logging visibility events for real-time updates',
    icon: <Database className="h-4 w-4 text-muted-foreground" />,
    status: 'pending',
    progress: 0
  }
];
