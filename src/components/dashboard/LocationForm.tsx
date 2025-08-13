import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { X, Plus } from 'lucide-react';
import AddressHierarchy from '@/components/AddressHierarchy';
import { CoordinateValidator } from '@/components/CoordinateValidator';

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
  const [mainPhotoPreview, setMainPhotoPreview] = useState<string>('');
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [selectedPreviews, setSelectedPreviews] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: location?.name || '',
    province: '',
    address: location?.address || '',
    city: location?.city || '',
    description: location?.description || '',
    mainPhoto: location?.main_photo || '',
    existingPhotos: location?.photos || [],
    priceDay: location?.price_day || '',
    priceWeek: location?.price_week || '',
    priceMonth: location?.price_month || '',
    latitude: location?.latitude || null,
    longitude: location?.longitude || null
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

    // Validate main photo is required
    if (!mainPhotoFile && !formData.mainPhoto.trim()) {
      toast({
        title: "Error",
        description: "Main photo is required.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      let mainPhotoUrl = formData.mainPhoto;
      const photoUrls: string[] = [];

      // Upload main photo if file is selected
      if (mainPhotoFile) {
        const mainPhotoPath = `${user?.id}/${Date.now()}-main.${mainPhotoFile.name.split('.').pop()}`;
        mainPhotoUrl = await uploadFile(mainPhotoFile, 'location-photos', mainPhotoPath) || '';
      }

      // Keep existing photos
      photoUrls.push(...formData.existingPhotos);

      // Upload new gallery photos
      for (let i = 0; i < selectedPhotos.length; i++) {
        const photoPath = `${user?.id}/${Date.now()}-photo-${i}.${selectedPhotos[i].name.split('.').pop()}`;
        const photoUrl = await uploadFile(selectedPhotos[i], 'location-photos', photoPath);
        if (photoUrl) photoUrls.push(photoUrl);
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
        latitude: formData.latitude,
        longitude: formData.longitude,
        status: location ? location.status : 'pending'
      };

      if (location) {
        // Update existing location - reset status to pending if it was rejected
        const updateData = {
          ...locationData,
          status: location.status === 'rejected' ? 'pending' : location.status,
          rejection_reason: location.status === 'rejected' ? null : location.rejection_reason
        };
        
        const { error } = await supabase
          .from('locations')
          .update(updateData)
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

        <AddressHierarchy
          provinceValue={formData.province}
          cityValue={formData.city}
          addressValue={formData.address}
          onProvinceChange={(value) => {
            setFormData(prev => ({ ...prev, province: value }));
          }}
          onCityChange={(value, coordinates) => {
            setFormData(prev => ({ 
              ...prev, 
              city: value,
              latitude: coordinates?.lat || null,
              longitude: coordinates?.lng || null
            }));
          }}
          onAddressChange={(value, coordinates) => {
            setFormData(prev => ({ 
              ...prev, 
              address: value,
              latitude: coordinates?.lat || null,
              longitude: coordinates?.lng || null
            }));
          }}
        />

        {/* Coordinate Validator */}
        {(formData.latitude && formData.longitude) && (
          <CoordinateValidator
            latitude={formData.latitude}
            longitude={formData.longitude}
            address={formData.address}
            onCoordinatesChange={(lat, lng) => {
              setFormData(prev => ({ 
                ...prev, 
                latitude: lat,
                longitude: lng
              }));
            }}
          />
        )}

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
          <Label htmlFor="mainPhoto">Main Photo *</Label>
          <Input
            id="mainPhoto"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setMainPhotoFile(file);
                setMainPhotoPreview(URL.createObjectURL(file));
                setFormData(prev => ({ ...prev, mainPhoto: '' })); // Clear URL when file is selected
              }
            }}
          />

          {/* Preview for selected file or URL */}
          {(mainPhotoPreview || (!mainPhotoFile && formData.mainPhoto)) && (
            <div className="mt-2 relative">
              <img
                src={mainPhotoPreview || formData.mainPhoto}
                alt="Main photo preview"
                className="w-full max-w-md h-40 object-cover rounded-md"
              />
              {mainPhotoPreview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-6 w-6 p-0"
                  onClick={() => {
                    URL.revokeObjectURL(mainPhotoPreview);
                    setMainPhotoPreview('');
                    setMainPhotoFile(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {!mainPhotoFile && (
            <>
              <div className="text-sm text-muted-foreground">Or provide URL:</div>
              <Input
                type="url"
                value={formData.mainPhoto}
                onChange={(e) => setFormData(prev => ({ ...prev, mainPhoto: e.target.value }))}
                placeholder="https://example.com/main-photo.jpg"
              />
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label>Additional Photos (up to 5 total)</Label>
          
          {/* Existing photos from database */}
          {formData.existingPhotos.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Existing Photos:</div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {formData.existingPhotos.map((photo, index) => (
                  <div key={index} className="relative group rounded-md overflow-hidden border border-border/50">
                    <img src={photo} alt={`Existing photo ${index + 1}`} className="h-24 w-full object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        const newPhotos = formData.existingPhotos.filter((_, i) => i !== index);
                        setFormData(prev => ({ ...prev, existingPhotos: newPhotos }));
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New photos to upload */}
          {selectedPhotos.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">New Photos to Upload:</div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {selectedPhotos.map((photo, index) => (
                  <div key={index} className="relative group rounded-md overflow-hidden border border-border/50">
                    <img src={selectedPreviews[index]} alt={photo.name} className="h-24 w-full object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        setSelectedPhotos((photos) => photos.filter((_, i) => i !== index));
                        URL.revokeObjectURL(selectedPreviews[index]);
                        setSelectedPreviews((prev) => prev.filter((_, i) => i !== index));
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add photo button */}
          {(formData.existingPhotos.length + selectedPhotos.length) < 5 && (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full flex items-center gap-2"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file && (formData.existingPhotos.length + selectedPhotos.length) < 5) {
                      const url = URL.createObjectURL(file);
                      setSelectedPhotos(prev => [...prev, file]);
                      setSelectedPreviews(prev => [...prev, url]);
                    }
                  };
                  input.click();
                }}
              >
                <Plus className="h-4 w-4" />
                Add Photo ({formData.existingPhotos.length + selectedPhotos.length}/5)
              </Button>
            </div>
          )}
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