import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Building2, MapPin, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface PendingItem {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showAddSpaceForm, setShowAddSpaceForm] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Pending items for admin
  const [pendingCompanies, setPendingCompanies] = useState<PendingItem[]>([]);
  const [pendingLocations, setPendingLocations] = useState<PendingItem[]>([]);
  const [pendingArticles, setPendingArticles] = useState<PendingItem[]>([]);

  // Form state for adding space
  const [formData, setFormData] = useState({
    companyName: '',
    companyLogo: '',
    locationName: '',
    address: '',
    city: '',
    description: '',
    mapLocation: '',
    mainPhoto: '',
    photos: ['', '', '', '', '']
  });

  useEffect(() => {
    if (user) {
      fetchUserRole();
    }
  }, [user]);

  useEffect(() => {
    if (userRole === 'admin') {
      fetchPendingItems();
    }
  }, [userRole]);

  const fetchUserRole = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();
      
      if (error) throw error;
      setUserRole(data?.role || 'host');
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole('host'); // Default to host
    }
  };

  const fetchPendingItems = async () => {
    try {
      const [companiesRes, locationsRes, articlesRes] = await Promise.all([
        supabase.from('companies').select('id, name, status, created_at').eq('status', 'pending'),
        supabase.from('locations').select('id, name, status, created_at').eq('status', 'pending'),
        supabase.from('articles').select('id, title, status, created_at').eq('status', 'pending')
      ]);

      setPendingCompanies(companiesRes.data || []);
      setPendingLocations(locationsRes.data || []);
      setPendingArticles((articlesRes.data || []).map(article => ({ ...article, name: article.title })));
    } catch (error) {
      console.error('Error fetching pending items:', error);
    }
  };

  const handleAddSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: formData.companyName,
          logo: formData.companyLogo,
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
          photos: formData.photos.filter(photo => photo.trim() !== ''),
          status: 'pending'
        });

      if (locationError) throw locationError;

      toast({
        title: "Success!",
        description: "Your space has been submitted for review."
      });

      setShowAddSpaceForm(false);
      setFormData({
        companyName: '',
        companyLogo: '',
        locationName: '',
        address: '',
        city: '',
        description: '',
        mapLocation: '',
        mainPhoto: '',
        photos: ['', '', '', '', '']
      });
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

  const handleApproval = async (table: 'companies' | 'locations' | 'articles', id: string, action: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from(table)
        .update({ status: action })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Item ${action} successfully.`
      });

      fetchPendingItems();
    } catch (error) {
      console.error(`Error ${action} item:`, error);
      toast({
        title: "Error",
        description: `Failed to ${action} item.`,
        variant: "destructive"
      });
    }
  };

  if (!userRole) {
    return <div className="container mx-auto py-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">
          {userRole === 'admin' ? 'Manage pending submissions' : 'Manage your workspace listings'}
        </p>
      </div>

      {userRole === 'host' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Your Spaces
              </CardTitle>
              <CardDescription>
                Add and manage your coworking spaces
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog open={showAddSpaceForm} onOpenChange={setShowAddSpaceForm}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Your Space
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Your Space</DialogTitle>
                    <DialogDescription>
                      Create a listing for your coworking space
                    </DialogDescription>
                  </DialogHeader>
                  
                  <form onSubmit={handleAddSpace} className="space-y-6">
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Company Information</h3>
                      
                      <div className="space-y-2">
                        <Label htmlFor="companyName">Company Name *</Label>
                        <Input
                          id="companyName"
                          value={formData.companyName}
                          onChange={(e) => setFormData(prev => ({ 
                            ...prev, 
                            companyName: e.target.value,
                            locationName: prev.locationName || e.target.value
                          }))}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="companyLogo">Company Logo URL</Label>
                        <Input
                          id="companyLogo"
                          type="url"
                          value={formData.companyLogo}
                          onChange={(e) => setFormData(prev => ({ ...prev, companyLogo: e.target.value }))}
                          placeholder="https://example.com/logo.png"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Location Information</h3>
                      
                      <div className="space-y-2">
                        <Label htmlFor="locationName">Location Name</Label>
                        <Input
                          id="locationName"
                          value={formData.locationName}
                          onChange={(e) => setFormData(prev => ({ ...prev, locationName: e.target.value }))}
                          placeholder="Will use company name if empty"
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

                      <div className="space-y-2">
                        <Label>Photo Gallery (up to 5 photos)</Label>
                        {formData.photos.map((photo, index) => (
                          <Input
                            key={index}
                            type="url"
                            value={photo}
                            onChange={(e) => {
                              const newPhotos = [...formData.photos];
                              newPhotos[index] = e.target.value;
                              setFormData(prev => ({ ...prev, photos: newPhotos }));
                            }}
                            placeholder={`Photo ${index + 1} URL`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setShowAddSpaceForm(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={loading}>
                        {loading ? 'Submitting...' : 'Submit for Review'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      )}

      {userRole === 'admin' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pending Companies */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Pending Companies ({pendingCompanies.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingCompanies.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No pending companies</p>
                ) : (
                  pendingCompanies.map((company) => (
                    <div key={company.id} className="p-3 border rounded-lg space-y-2">
                      <h4 className="font-medium">{company.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(company.created_at).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleApproval('companies', company.id, 'approved')}
                        >
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleApproval('companies', company.id, 'rejected')}
                        >
                          Deny
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Pending Locations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Pending Locations ({pendingLocations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingLocations.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No pending locations</p>
                ) : (
                  pendingLocations.map((location) => (
                    <div key={location.id} className="p-3 border rounded-lg space-y-2">
                      <h4 className="font-medium">{location.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(location.created_at).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleApproval('locations', location.id, 'approved')}
                        >
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleApproval('locations', location.id, 'rejected')}
                        >
                          Deny
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Pending Articles */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Pending Articles ({pendingArticles.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingArticles.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No pending articles</p>
                ) : (
                  pendingArticles.map((article) => (
                    <div key={article.id} className="p-3 border rounded-lg space-y-2">
                      <h4 className="font-medium">{article.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(article.created_at).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleApproval('articles', article.id, 'approved')}
                        >
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleApproval('articles', article.id, 'rejected')}
                        >
                          Deny
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}