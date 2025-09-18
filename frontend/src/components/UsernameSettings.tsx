import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { useUserProfile } from '../hooks/useUserProfile';
import { toast } from 'sonner';
import { 
  User, 
  Eye, 
  EyeOff, 
  Check, 
  X, 
  Loader2,
  Globe,
  Lock
} from 'lucide-react';

export function UsernameSettings() {
  const { profile, isLoading, error, updateProfile, createProfile, checkUsernameAvailability } = useUserProfile();
  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    bio: '',
    is_username_public: false,
    is_profile_public: false
  });
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form data when profile loads
  React.useEffect(() => {
    if (profile) {
      setFormData({
        username: profile.username || '',
        display_name: profile.display_name || '',
        bio: profile.bio || '',
        is_username_public: profile.is_username_public,
        is_profile_public: profile.is_profile_public
      });
    }
  }, [profile]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Check username availability when username changes
    if (field === 'username' && typeof value === 'string') {
      if (value.length >= 3) {
        checkUsernameAvailabilityLocal(value);
      } else {
        setUsernameAvailable(null);
      }
    }
  };

  const checkUsernameAvailabilityLocal = async (username: string) => {
    if (username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setIsCheckingUsername(true);
    try {
      const available = await checkUsernameAvailability(username);
      setUsernameAvailable(available);
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameAvailable(false);
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleSave = async () => {
    if (!profile) {
      // Create new profile
      setIsSaving(true);
      try {
        await createProfile(formData);
        toast.success('Profile created successfully!');
      } catch (error) {
        toast.error('Failed to create profile');
      } finally {
        setIsSaving(false);
      }
    } else {
      // Update existing profile
      setIsSaving(true);
      try {
        await updateProfile(formData);
        toast.success('Profile updated successfully!');
      } catch (error) {
        toast.error('Failed to update profile');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const getUsernameStatus = () => {
    if (isCheckingUsername) {
      return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking...
        </div>
      );
    }

    if (formData.username.length === 0) {
      return null;
    }

    if (formData.username.length < 3) {
      return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <X className="h-3 w-3" />
          Username must be at least 3 characters
        </div>
      );
    }

    if (usernameAvailable === true) {
      return (
        <div className="flex items-center gap-1 text-xs text-green-500">
          <Check className="h-3 w-3" />
          Username available
        </div>
      );
    }

    if (usernameAvailable === false) {
      return (
        <div className="flex items-center gap-1 text-xs text-red-500">
          <X className="h-3 w-3" />
          Username taken
        </div>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading profile settings...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Profile Settings
        </CardTitle>
        <CardDescription>
          Customize your username and privacy settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Username */}
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="space-y-1">
            <Input
              id="username"
              placeholder="Enter your username"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              className={usernameAvailable === false ? 'border-red-500' : ''}
            />
            {getUsernameStatus()}
          </div>
          <p className="text-xs text-muted-foreground">
            Choose a unique username (3-30 characters, letters, numbers, and underscores only). 
            Leave empty to appear as "Anon" to other users.
          </p>
        </div>

        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="display_name">Display Name</Label>
          <Input
            id="display_name"
            placeholder="Enter your display name"
            value={formData.display_name}
            onChange={(e) => handleInputChange('display_name', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            A friendly name to display (optional)
          </p>
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            placeholder="Tell us about yourself..."
            value={formData.bio}
            onChange={(e) => handleInputChange('bio', e.target.value)}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            A short description about yourself (optional)
          </p>
        </div>

        {/* Privacy Settings */}
        <div className="space-y-4">
          <h4 className="font-medium">Privacy Settings</h4>
          
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span className="font-medium">Public Username</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Allow others to see your username instead of wallet address
              </p>
            </div>
            <Switch
              checked={formData.is_username_public}
              onCheckedChange={(checked) => handleInputChange('is_username_public', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <span className="font-medium">Public Profile</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Make your entire profile visible to other users
              </p>
            </div>
            <Switch
              checked={formData.is_profile_public}
              onCheckedChange={(checked) => handleInputChange('is_profile_public', checked)}
            />
          </div>
        </div>

        {/* Privacy Notice */}
        <Alert>
          <AlertDescription>
            <strong>Privacy Notice:</strong> Your wallet address is always private. 
            By default, you'll appear as "Anon" to other users. You can choose to show your username publicly or keep it anonymous. 
            Profile information is only visible if you enable "Public Profile".
          </AlertDescription>
        </Alert>

        {/* Save Button */}
        <Button 
          onClick={handleSave}
          disabled={isSaving || (formData.username && usernameAvailable === false)}
          className="w-full"
        >
          {isSaving ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </div>
          ) : (
            profile ? 'Update Profile' : 'Create Profile'
          )}
        </Button>

        {/* Current Status */}
        {profile && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Current Status</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Username:</span>
                <span className="font-mono">
                  {profile.username || 'Not set'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Visibility:</span>
                <div className="flex gap-2">
                  {profile.is_username_public && (
                    <Badge variant="default" className="bg-green-500">
                      <Globe className="h-3 w-3 mr-1" />
                      Public Username
                    </Badge>
                  )}
                  {profile.is_profile_public && (
                    <Badge variant="default" className="bg-blue-500">
                      <Eye className="h-3 w-3 mr-1" />
                      Public Profile
                    </Badge>
                  )}
                  {!profile.is_username_public && !profile.is_profile_public && (
                    <Badge variant="outline">
                      <EyeOff className="h-3 w-3 mr-1" />
                      Anonymous
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
