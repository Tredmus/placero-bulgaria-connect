import { useState } from 'react';
import { CompanyForm } from './CompanyForm';
import { LocationForm } from './LocationForm';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CompanyLocationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function CompanyLocationForm({ onSuccess, onCancel }: CompanyLocationFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<'company' | 'location'>('company');
  const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationNameEdited, setLocationNameEdited] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [mainPhotoFile, setMainPhotoFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<(File | null)[]>([null, null, null, null, null]);
  
  const [formData, setFormData] = useState({
    companyName: '',
    companyLogo: '',
    companyDescription: '',
    locationName: '',
    address: '',
    city: '',
    description: '',
    mainPhoto: '',
    photos: ['', '', '', '', ''],
    priceDay: '',
    priceWeek: '',
    priceMonth: ''
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
      let logoUrl = formData.companyLogo;
      let mainPhotoUrl = formData.mainPhoto;
      const photoUrls: string[] = [];

      // Upload logo if file is selected
      if (logoFile) {
        const logoPath = `${user?.id}/${Date.now()}-logo.${logoFile.name.split('.').pop()}`;
        logoUrl = await uploadFile(logoFile, 'company-logos', logoPath) || '';
      }

      // Upload main photo if file is selected
      if (mainPhotoFile) {
        const mainPhotoPath = `${user?.id}/${Date.now()}-main.${mainPhotoFile.name.split('.').pop()}`;
        mainPhotoUrl = await uploadFile(mainPhotoFile, 'location-photos', mainPhotoPath) || '';
      }

      // Upload gallery photos
      for (let i = 0; i < photoFiles.length; i++) {
        if (photoFiles[i]) {
          const photoPath = `${user?.id}/${Date.now()}-photo-${i}.${photoFiles[i]!.name.split('.').pop()}`;
          const photoUrl = await uploadFile(photoFiles[i]!, 'location-photos', photoPath);
          if (photoUrl) photoUrls.push(photoUrl);
        } else if (formData.photos[i].trim() !== '') {
          photoUrls.push(formData.photos[i]);
        }
      }

      // Create company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: formData.companyName,
          description: formData.companyDescription,
          logo: logoUrl,
          owner_id: user?.id,
          status: 'pending'
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // Create location
      const { error: locationError } = await supabase
        .from('locations')
        .insert({
          company_id: company.id,
          name: formData.locationName || formData.companyName,
          address: formData.address,
          city: formData.city,
          description: formData.description,
          main_photo: mainPhotoUrl,
          photos: photoUrls,
          price_day: formData.priceDay ? parseFloat(formData.priceDay) : null,
          price_week: formData.priceWeek ? parseFloat(formData.priceWeek) : null,
          price_month: formData.priceMonth ? parseFloat(formData.priceMonth) : null,
          status: 'pending'
        });

      if (locationError) throw locationError;

      toast({
        title: "Success!",
        description: "Your space has been submitted for review."
      });

      onSuccess();
    } catch (error) {
      console.error('Error adding space:', error);
      toast({
        title: "Error",
        description: "Failed to add your space. Please try again.",
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
        {/* Company form content would go here - simplified for space */}
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Location Information</h3>
        {/* Location form content would go here - simplified for space */}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit for Review'}
        </button>
      </div>
    </form>
  );
}