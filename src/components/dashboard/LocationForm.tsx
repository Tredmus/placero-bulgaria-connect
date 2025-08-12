import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { X, Plus, ChevronsUpDown, Check, Loader2 } from 'lucide-react';
import { CoordinateValidator } from '@/components/CoordinateValidator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface LocationFormProps {
  location?: any;
  companyId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

type Option = { id: string; name: string };

function ComboBox({
  value, // selected option or null
  onSelect,
  options,
  placeholder,
  disabled,
  loading,
  error,
  onSearchChange,
}: {
  value: Option | null;
  onSelect: (opt: Option) => void;
  options: Option[];
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
  onSearchChange?: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          role="combobox"
          variant="outline"
          className={cn(
            'w-full justify-between',
            disabled && 'opacity-60 cursor-not-allowed',
            error && 'border-red-500 focus-visible:ring-red-500'
          )}
          disabled={disabled}
        >
          <span className={cn(!value && 'text-muted-foreground')}>{value?.name || placeholder}</span>
          {loading ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
        <Command shouldFilter={true}>
          <CommandInput
            placeholder={placeholder}
            // shadcn CommandInput exposes onValueChange
            onValueChange={(v) => onSearchChange?.(v)}
          />
          <CommandEmpty>Няма резултати</CommandEmpty>
          <CommandGroup>
            {options.map((opt) => (
              <CommandItem
                key={opt.id}
                value={opt.name}
                onSelect={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', value?.id === opt.id ? 'opacity-100' : 'opacity-0')} />
                {opt.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function LocationForm({ location, companyId, onSuccess, onCancel }: LocationFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [mainPhotoFile, setMainPhotoFile] = useState<File | null>(null);
  const [mainPhotoPreview, setMainPhotoPreview] = useState<string>('');
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [selectedPreviews, setSelectedPreviews] = useState<string[]>([]);

  // --- NEW: Province → City → Street state ---
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [cities, setCities] = useState<Option[]>([]);
  const [streets, setStreets] = useState<Option[]>([]);

  const [provinceSearch, setProvinceSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [streetSearch, setStreetSearch] = useState('');

  const [selectedProvince, setSelectedProvince] = useState<Option | null>(null);
  const [selectedCity, setSelectedCity] = useState<Option | null>(null);
  const [selectedStreet, setSelectedStreet] = useState<Option | null>(null);

  const [provinceLoading, setProvinceLoading] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const [streetLoading, setStreetLoading] = useState(false);

  // Visual error flags for red borders
  const [provinceError, setProvinceError] = useState(false);
  const [cityError, setCityError] = useState(false);
  const [streetError, setStreetError] = useState(false);

  const [formData, setFormData] = useState({
    name: location?.name || '',
    address: location?.address || '', // will mirror selected street name
    city: location?.city || '', // will mirror selected city name
    description: location?.description || '',
    mainPhoto: location?.main_photo || '',
    existingPhotos: location?.photos || [],
    priceDay: location?.price_day || '',
    priceWeek: location?.price_week || '',
    priceMonth: location?.price_month || '',
    latitude: location?.latitude || null,
    longitude: location?.longitude || null,
  });

  // Load provinces once
  useEffect(() => {
    let active = true;
    (async () => {
      setProvinceLoading(true);
      const { data, error } = await supabase.from('provinces').select('id, name').order('name');
      if (!active) return;
      if (error) {
        console.error('Load provinces error:', error);
      }
      const opts = (data || []).map((r: any) => ({ id: String(r.id), name: r.name }));
      setProvinces(opts);
      setProvinceLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Debounce helper
  function useDebounced(value: string, delay = 250) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
      const id = setTimeout(() => setDebounced(value), delay);
      return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
  }

  const debCity = useDebounced(citySearch);
  const debStreet = useDebounced(streetSearch);

  // Load cities when province or search changes
  useEffect(() => {
    let active = true;
    setCities([]);
    setSelectedCity(null);
    setSelectedStreet(null);
    setStreets([]);
    setCityError(false);
    setStreetError(false);
    if (!selectedProvince) return;
    (async () => {
      setCityLoading(true);
      const query = supabase
        .from('cities')
        .select('id, name')
        .eq('province_id', selectedProvince.id)
        .order('name')
        .limit(100);
      if (debCity) query.ilike('name', `%${debCity}%`);
      const { data, error } = await query;
      if (!active) return;
      if (error) console.error('Load cities error:', error);
      setCities((data || []).map((r: any) => ({ id: String(r.id), name: r.name })));
      setCityLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvince?.id, debCity]);

  // Load streets when city or search changes
  useEffect(() => {
    let active = true;
    setSelectedStreet(null);
    setStreets([]);
    setStreetError(false);
    if (!selectedCity) return;
    (async () => {
      setStreetLoading(true);
      const query = supabase
        .from('streets')
        .select('id, name')
        .eq('city_id', selectedCity.id)
        .order('name')
        .limit(200);
      if (debStreet) query.ilike('name', `%${debStreet}%`);
      const { data, error } = await query;
      if (!active) return;
      if (error) console.error('Load streets error:', error);
      setStreets((data || []).map((r: any) => ({ id: String(r.id), name: r.name })));
      setStreetLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity?.id, debStreet]);

  // Mirror selections into formData strings
  useEffect(() => {
    if (selectedCity) setFormData((p) => ({ ...p, city: selectedCity.name }));
  }, [selectedCity]);
  useEffect(() => {
    if (selectedStreet) setFormData((p) => ({ ...p, address: selectedStreet.name }));
  }, [selectedStreet]);

  const uploadFile = async (file: File, bucket: string, path: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasProvince = !!selectedProvince?.id;
    const hasCity = !!selectedCity?.id;
    const hasStreet = !!selectedStreet?.id;

    setProvinceError(!hasProvince);
    setCityError(!hasCity);
    setStreetError(!hasStreet);

    if (!hasProvince || !hasCity || !hasStreet) {
      toast({ title: 'Грешка', description: 'Моля избери област, населено място и улица.', variant: 'destructive' });
      return;
    }

    if (!mainPhotoFile && !formData.mainPhoto.trim()) {
      toast({ title: 'Error', description: 'Main photo is required.', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      let mainPhotoUrl = formData.mainPhoto;
      const photoUrls: string[] = [];

      if (mainPhotoFile) {
        const mainPhotoPath = `${user?.id}/${Date.now()}-main.${mainPhotoFile.name.split('.').pop()}`;
        mainPhotoUrl = (await uploadFile(mainPhotoFile, 'location-photos', mainPhotoPath)) || '';
      }

      photoUrls.push(...formData.existingPhotos);

      for (let i = 0; i < selectedPhotos.length; i++) {
        const photoPath = `${user?.id}/${Date.now()}-photo-${i}.${selectedPhotos[i].name.split('.').pop()}`;
        const photoUrl = await uploadFile(selectedPhotos[i], 'location-photos', photoPath);
        if (photoUrl) photoUrls.push(photoUrl);
      }

      const locationData = {
        company_id: companyId,
        name: formData.name,
        address: selectedStreet?.name || formData.address,
        city: selectedCity?.name || formData.city,
        description: formData.description,
        main_photo: mainPhotoUrl,
        photos: photoUrls,
        price_day: formData.priceDay ? parseFloat(formData.priceDay) : null,
        price_week: formData.priceWeek ? parseFloat(formData.priceWeek) : null,
        price_month: formData.priceMonth ? parseFloat(formData.priceMonth) : null,
        latitude: formData.latitude,
        longitude: formData.longitude,
        status: location ? location.status : 'pending',
        // If you later add columns, uncomment:
        // province_id: selectedProvince?.id,
        // city_id: selectedCity?.id,
        // street_id: selectedStreet?.id,
      } as any;

      if (location) {
        const updateData = {
          ...locationData,
          status: location.status === 'rejected' ? 'pending' : location.status,
          rejection_reason: location.status === 'rejected' ? null : location.rejection_reason,
        };

        const { error } = await supabase.from('locations').update(updateData).eq('id', location.id);
        if (error) throw error;
        toast({ title: 'Success!', description: 'Location updated successfully.' });
      } else {
        const { error } = await supabase.from('locations').insert(locationData);
        if (error) throw error;
        toast({ title: 'Success!', description: 'Location created and submitted for review.' });
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving location:', error);
      toast({ title: 'Error', description: 'Failed to save location. Please try again.', variant: 'destructive' });
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
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>

        {/* NEW: Cascading Province → City → Street (searchable comboboxes) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Област *</Label>
            <ComboBox
              value={selectedProvince}
              onSelect={(opt) => {
                setSelectedProvince(opt);
                setProvinceError(false);
                // reset downstream
                setSelectedCity(null);
                setSelectedStreet(null);
                setCities([]);
                setStreets([]);
                setCitySearch('');
                setStreetSearch('');
              }}
              options={provinces}
              placeholder="Избери област..."
              disabled={false}
              loading={provinceLoading}
              error={provinceError}
              onSearchChange={setProvinceSearch}
            />
          </div>

          <div className="space-y-2">
            <Label>Населено място *</Label>
            <ComboBox
              value={selectedCity}
              onSelect={(opt) => {
                setSelectedCity(opt);
                setCityError(false);
                setStreetSearch('');
              }}
              options={cities}
              placeholder={selectedProvince ? 'Търси град/село...' : 'Първо избери област'}
              disabled={!selectedProvince}
              loading={cityLoading}
              error={cityError}
              onSearchChange={setCitySearch}
            />
          </div>

          <div className="space-y-2">
            <Label>Улица *</Label>
            <ComboBox
              value={selectedStreet}
              onSelect={(opt) => {
                setSelectedStreet(opt);
                setStreetError(false);
              }}
              options={streets}
              placeholder={selectedCity ? 'Търси улица...' : 'Първо избери населено място'}
              disabled={!selectedCity}
              loading={streetLoading}
              error={streetError}
              onSearchChange={setStreetSearch}
            />
          </div>
        </div>

        {/* Coordinate Validator (kept). If you want to auto-fill lat/lng from selected street, add columns to streets and fetch them. */}
        {formData.latitude && formData.longitude && (
          <CoordinateValidator
            latitude={formData.latitude}
            longitude={formData.longitude}
            address={formData.address}
            onCoordinatesChange={(lat, lng) => {
              setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
            }}
          />
        )}

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
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
              onChange={(e) => setFormData((prev) => ({ ...prev, priceDay: e.target.value }))}
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
              onChange={(e) => setFormData((prev) => ({ ...prev, priceWeek: e.target.value }))}
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
              onChange={(e) => setFormData((prev) => ({ ...prev, priceMonth: e.target.value }))}
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
                setFormData((prev) => ({ ...prev, mainPhoto: '' })); // Clear URL when file is selected
              }
            }}
          />

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
                onChange={(e) => setFormData((prev) => ({ ...prev, mainPhoto: e.target.value }))}
                placeholder="https://example.com/main-photo.jpg"
              />
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label>Additional Photos (up to 5 total)</Label>

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
                        setFormData((prev) => ({ ...prev, existingPhotos: newPhotos }));
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                      setSelectedPhotos((prev) => [...prev, file]);
                      setSelectedPreviews((prev) => [...prev, url]);
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
