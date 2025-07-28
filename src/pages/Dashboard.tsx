import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Building2, MapPin, FileText, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CompanyCard } from '@/components/dashboard/CompanyCard';
import { CompanyForm } from '@/components/dashboard/CompanyForm';
import { LocationForm } from '@/components/dashboard/LocationForm';
import { PreviewDialog } from '@/components/dashboard/PreviewDialog';
import { CompanyLocationForm } from '@/components/dashboard/CompanyLocationForm';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

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
  const [showEditCompanyForm, setShowEditCompanyForm] = useState<any>(null);
  const [showEditLocationForm, setShowEditLocationForm] = useState<any>(null);
  const [showAddLocationForm, setShowAddLocationForm] = useState<string | null>(null);
  
  // Pending items for admin
  const [pendingCompanies, setPendingCompanies] = useState<any[]>([]);
  const [pendingLocations, setPendingLocations] = useState<any[]>([]);
  const [pendingArticles, setPendingArticles] = useState<PendingItem[]>([]);

  // User's companies and locations for host
  const [userCompanies, setUserCompanies] = useState<any[]>([]);
  const [userLocations, setUserLocations] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState<{type: string, item: any} | null>(null);
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    if (user) {
      fetchUserRole();
    }
  }, [user]);

  useEffect(() => {
    if (userRole === 'admin') {
      fetchPendingItems();
    } else if (userRole === 'host') {
      fetchUserSpaces();
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
        supabase.from('companies').select('*, profiles(username)').eq('status', 'pending'),
        supabase.from('locations').select('*, companies(name, logo)').eq('status', 'pending'),
        supabase.from('articles').select('id, title, status, created_at').eq('status', 'pending')
      ]);

      setPendingCompanies(companiesRes.data || []);
      setPendingLocations(locationsRes.data || []);
      setPendingArticles((articlesRes.data || []).map(article => ({ ...article, name: article.title })));
    } catch (error) {
      console.error('Error fetching pending items:', error);
    }
  };

  const fetchUserSpaces = async () => {
    try {
      const [companiesRes, locationsRes] = await Promise.all([
        supabase.from('companies').select('*').eq('owner_id', user?.id),
        supabase.from('locations').select('*, companies(name, logo)')
      ]);

      setUserCompanies(companiesRes.data || []);
      
      // Filter locations that belong to user's companies
      const userCompanyIds = (companiesRes.data || []).map(c => c.id);
      const userOwnedLocations = (locationsRes.data || []).filter(l => 
        userCompanyIds.includes(l.company_id)
      );
      setUserLocations(userOwnedLocations);
    } catch (error) {
      console.error('Error fetching user spaces:', error);
    }
  };

  const handleApproval = async (table: 'companies' | 'locations' | 'articles', id: string, action: 'approved' | 'rejected', rejectionReason?: string) => {
    try {
      const updateData: any = { status: action };
      if (action === 'rejected' && rejectionReason) {
        updateData.rejection_reason = rejectionReason;
      } else if (action === 'approved') {
        updateData.rejection_reason = null;
      }

      const { error } = await supabase
        .from(table)
        .update(updateData)
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

  const handleDeleteCompany = async (companyId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Company',
      description: 'Are you sure you want to delete this company? This action cannot be undone and will also delete all associated locations.',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('companies')
            .delete()
            .eq('id', companyId);

          if (error) throw error;

          toast({
            title: "Success!",
            description: "Company deleted successfully."
          });

          fetchUserSpaces();
        } catch (error) {
          console.error('Error deleting company:', error);
          toast({
            title: "Error",
            description: "Failed to delete company.",
            variant: "destructive"
          });
        }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    });
  };

  const handleDeleteLocation = async (locationId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Location',
      description: 'Are you sure you want to delete this location? This action cannot be undone.',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('locations')
            .delete()
            .eq('id', locationId);

          if (error) throw error;

          toast({
            title: "Success!",
            description: "Location deleted successfully."
          });

          fetchUserSpaces();
        } catch (error) {
          console.error('Error deleting location:', error);
          toast({
            title: "Error",
            description: "Failed to delete location.",
            variant: "destructive"
          });
        }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    });
  };

  const handleFormSuccess = () => {
    setShowAddSpaceForm(false);
    setShowEditCompanyForm(null);
    setShowEditLocationForm(null);
    setShowAddLocationForm(null);
    fetchUserSpaces();
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
          {userCompanies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              locations={userLocations.filter(loc => loc.company_id === company.id)}
              onEditCompany={(company) => setShowEditCompanyForm(company)}
              onEditLocation={(location) => setShowEditLocationForm(location)}
              onAddLocation={(companyId) => setShowAddLocationForm(companyId)}
              onDeleteCompany={handleDeleteCompany}
              onDeleteLocation={handleDeleteLocation}
            />
          ))}

          {userCompanies.length === 0 && (
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
                    
                    <CompanyLocationForm
                      onSuccess={handleFormSuccess}
                      onCancel={() => setShowAddSpaceForm(false)}
                    />
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          )}

          {/* Edit Company Dialog */}
          {showEditCompanyForm && (
            <Dialog open={!!showEditCompanyForm} onOpenChange={() => setShowEditCompanyForm(null)}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Company</DialogTitle>
                  <DialogDescription>
                    Update your company information
                  </DialogDescription>
                </DialogHeader>
                
                <CompanyForm
                  company={showEditCompanyForm}
                  onSuccess={handleFormSuccess}
                  onCancel={() => setShowEditCompanyForm(null)}
                />
              </DialogContent>
            </Dialog>
          )}

          {/* Edit Location Dialog */}
          {showEditLocationForm && (
            <Dialog open={!!showEditLocationForm} onOpenChange={() => setShowEditLocationForm(null)}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Location</DialogTitle>
                  <DialogDescription>
                    Update your location information
                  </DialogDescription>
                </DialogHeader>
                
                <LocationForm
                  location={showEditLocationForm}
                  companyId={showEditLocationForm.company_id}
                  onSuccess={handleFormSuccess}
                  onCancel={() => setShowEditLocationForm(null)}
                />
              </DialogContent>
            </Dialog>
          )}

          {/* Add Location Dialog */}
          {showAddLocationForm && (
            <Dialog open={!!showAddLocationForm} onOpenChange={() => setShowAddLocationForm(null)}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Location</DialogTitle>
                  <DialogDescription>
                    Add another location to your company
                  </DialogDescription>
                </DialogHeader>
                
                <LocationForm
                  companyId={showAddLocationForm}
                  onSuccess={handleFormSuccess}
                  onCancel={() => setShowAddLocationForm(null)}
                />
              </DialogContent>
            </Dialog>
          )}
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
                            variant="outline"
                            onClick={() => setShowPreview({type: 'company', item: company})}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview & Decide
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
                            variant="outline"
                            onClick={() => setShowPreview({type: 'location', item: location})}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview & Decide
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

      <PreviewDialog
        showPreview={showPreview}
        onClose={() => setShowPreview(null)}
        onApproval={handleApproval}
      />
      
      <ConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        confirmText="Delete"
        variant="destructive"
      />
    </div>
  );
}