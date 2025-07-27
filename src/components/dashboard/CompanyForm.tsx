import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface CompanyFormProps {
  company?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CompanyForm({ company, onSuccess, onCancel }: CompanyFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    name: company?.name || '',
    description: company?.description || '',
    logo: company?.logo || ''
  });

  const uploadFile = async (file: File, bucket: string, path: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let logoUrl = formData.logo;

      // Upload logo if file is selected
      if (logoFile) {
        const logoPath = `${user?.id}/${Date.now()}-logo.${logoFile.name.split('.').pop()}`;
        logoUrl = await uploadFile(logoFile, 'company-logos', logoPath) || '';
      }

      if (company) {
        // Update existing company
        const { error } = await supabase
          .from('companies')
          .update({
            name: formData.name,
            description: formData.description,
            logo: logoUrl
          })
          .eq('id', company.id);

        if (error) throw error;

        toast({
          title: "Success!",
          description: "Company updated successfully."
        });
      } else {
        // Create new company
        const { error } = await supabase
          .from('companies')
          .insert({
            name: formData.name,
            description: formData.description,
            logo: logoUrl,
            owner_id: user?.id,
            status: 'pending'
          });

        if (error) throw error;

        toast({
          title: "Success!",
          description: "Company created and submitted for review."
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving company:', error);
      toast({
        title: "Error",
        description: "Failed to save company. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Company Information</h3>
        
        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name *</Label>
          <Input
            id="companyName"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="companyLogo">Company Logo</Label>
          <Input
            id="companyLogo"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setLogoFile(file);
            }}
          />
          {logoFile && (
            <p className="text-sm text-muted-foreground">Selected: {logoFile.name}</p>
          )}
          <div className="text-sm text-muted-foreground">Or provide URL:</div>
          <Input
            type="url"
            value={formData.logo}
            onChange={(e) => setFormData(prev => ({ ...prev, logo: e.target.value }))}
            placeholder="https://example.com/logo.png"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : company ? 'Update Company' : 'Create Company'}
        </Button>
      </div>
    </form>
  );
}