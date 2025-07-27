import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface LocationFormProps {
  location?: any;
  companyId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function LocationForm({ location, companyId, onSuccess, onCancel }: LocationFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [mainPhotoFile, setMainPhotoFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<(File | null)[]>([null, null, null, null, null]);
  
  const [formData, setFormData] = useState({
    name: location?.name || '',
    address: location?.address || '',
    city: location?.city || '',
    description: location?.description || '',
    mainPhoto: location?.main_photo || '',
    photos: location?.photos || ['', '', '', '', ''],
    priceDay: location?.price_day || '',
    priceWeek: location?.price_week || '',
    priceMonth: location?.price_month || ''
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
      let mainPhotoUrl = formData.mainPhoto;
      const photoUrls: string[] = [];

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

      const locationData = {
        company_id: companyId,
        name: formData.name,
        address: formData.address,
        city: formData.city,
        description: formData.description,
        main_photo: mainPhotoUrl,
        photos: photoUrls,
        price_day: formData.priceDay ? parseFloat(formData.priceDay) : null,
        price_week: formData.priceWeek ? parseFloat(formData.priceWeek) : null,
        price_month: formData.priceMonth ? parseFloat(formData.priceMonth) : null,
        status: location ? location.status : 'pending'
      };

      if (location) {
        // Update existing location
        const { error } = await supabase
          .from('locations')
          .update(locationData)
          .eq('id', location.id);

        if (error) throw error;

        toast({
          title: "Success!",
          description: "Location updated successfully."
        });
      } else {
        // Create new location
        const { error } = await supabase
          .from('locations')
          .insert(locationData);

        if (error) throw error;

        toast({
          title: "Success!",
          description: "Location created and submitted for review."
        });
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving location:', error);
      toast({
        title: "Error",
        description: "Failed to save location. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Location Information</h3>
        
        <div className="space-y-2">
          <Label htmlFor="locationName">Location Name *</Label>
          <Input
            id="locationName"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City *</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
              required
            />
          </div>
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

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="priceDay">Price per Day (€)</Label>
            <Input
              id="priceDay"
              type="number"
              step="0.01"
              value={formData.priceDay}
              onChange={(e) => setFormData(prev => ({ ...prev, priceDay: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="priceWeek">Price per Week (€)</Label>
            <Input
              id="priceWeek"
              type="number"
              step="0.01"
              value={formData.priceWeek}
              onChange={(e) => setFormData(prev => ({ ...prev, priceWeek: e.target.value }))}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="priceMonth">Price per Month (€)</Label>
            <Input
              id="priceMonth"
              type="number"
              step="0.01"
              value={formData.priceMonth}
              onChange={(e) => setFormData(prev => ({ ...prev, priceMonth: e.target.value }))}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mainPhoto">Main Photo</Label>
          <Input
            id="mainPhoto"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setMainPhotoFile(file);
            }}
          />
          {mainPhotoFile && (
            <p className="text-sm text-muted-foreground">Selected: {mainPhotoFile.name}</p>
          )}
          <div className="text-sm text-muted-foreground">Or provide URL:</div>
          <Input
            type="url"
            value={formData.mainPhoto}
            onChange={(e) => setFormData(prev => ({ ...prev, mainPhoto: e.target.value }))}
            placeholder="https://example.com/main-photo.jpg"
          />
        </div>

        <div className="space-y-2">
          <Label>Photo Gallery (up to 5 photos)</Label>
          {formData.photos.map((photo, index) => (
            <div key={index} className="space-y-2">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const newPhotoFiles = [...photoFiles];
                    newPhotoFiles[index] = file;
                    setPhotoFiles(newPhotoFiles);
                  }
                }}
              />
              {photoFiles[index] && (
                <p className="text-sm text-muted-foreground">Selected: {photoFiles[index]!.name}</p>
              )}
              <div className="text-sm text-muted-foreground">Or provide URL:</div>
              <Input
                type="url"
                value={photo}
                onChange={(e) => {
                  const newPhotos = [...formData.photos];
                  newPhotos[index] = e.target.value;
                  setFormData(prev => ({ ...prev, photos: newPhotos }));
                }}
                placeholder={`Photo ${index + 1} URL`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : location ? 'Update Location' : 'Create Location'}
        </Button>
      </div>
    </form>
  );
}