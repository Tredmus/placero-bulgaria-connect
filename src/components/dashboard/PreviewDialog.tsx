import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import LightboxGallery from '@/components/LightboxGallery';

interface PreviewDialogProps {
  showPreview: {type: string, item: any} | null;
  onClose: () => void;
  onApproval: (table: 'companies' | 'locations' | 'articles' | 'banners', id: string, action: 'approved' | 'rejected', rejectionReason?: string) => void;
}

export function PreviewDialog({ showPreview, onClose, onApproval }: PreviewDialogProps) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const locationImages = showPreview?.type === 'location'
    ? ([...(showPreview.item?.main_photo ? [showPreview.item.main_photo] : []), ...((showPreview.item?.photos as string[]) || [])])
    : [];
  
  if (!showPreview) return null;

  const handleApproval = (action: 'approved' | 'rejected') => {
    if (action === 'rejected') {
      setShowRejectionForm(true);
      return;
    }
    
    const table = showPreview.type === 'company' ? 'companies' : 
                  showPreview.type === 'location' ? 'locations' : 
                  showPreview.type === 'article' ? 'articles' : 'banners';
    onApproval(table as 'companies' | 'locations' | 'articles' | 'banners', showPreview.item.id, action);
    onClose();
  };

  const handleRejectionSubmit = () => {
    if (!rejectionReason.trim()) return;
    
    const table = showPreview.type === 'company' ? 'companies' : 
                  showPreview.type === 'location' ? 'locations' : 
                  showPreview.type === 'article' ? 'articles' : 'banners';
    onApproval(table as 'companies' | 'locations' | 'articles' | 'banners', showPreview.item.id, 'rejected', rejectionReason);
    setRejectionReason('');
    setShowRejectionForm(false);
    onClose();
  };

  return (
    <Dialog open={!!showPreview} onOpenChange={() => {
      setShowRejectionForm(false);
      setRejectionReason('');
      onClose();
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <div className="max-h-[calc(90vh-8rem)] overflow-y-auto pr-2">
          <DialogHeader>
            <DialogTitle>
              {showPreview.type === 'company' ? 'Company Preview' : 
               showPreview.type === 'location' ? 'Location Preview' : 
               showPreview.type === 'article' ? 'Article Preview' : 'Banner Preview'}
            </DialogTitle>
          </DialogHeader>
          
          {showPreview.type === 'company' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {showPreview.item.logo && (
                  <img 
                    src={showPreview.item.logo} 
                    alt={showPreview.item.name}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                )}
                <div>
                  <h3 className="text-xl font-bold">{showPreview.item.name}</h3>
                  <p className="text-muted-foreground">
                    Created: {new Date(showPreview.item.created_at).toLocaleDateString()}
                  </p>
                  {showPreview.item.profiles?.username && (
                    <p className="text-sm text-muted-foreground">
                      Owner: {showPreview.item.profiles.username}
                    </p>
                  )}
                </div>
              </div>
              {showPreview.item.description && (
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-muted-foreground">{showPreview.item.description}</p>
                </div>
              )}
              
              {!showRejectionForm ? (
                <div className="flex gap-2 pt-4">
                  <Button onClick={() => handleApproval('approved')}>
                    Approve
                  </Button>
                  <Button variant="destructive" onClick={() => handleApproval('rejected')}>
                    Deny
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="rejectionReason">Reason for Rejection *</Label>
                    <Textarea
                      id="rejectionReason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Please explain why this submission is being rejected..."
                      rows={3}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="destructive" 
                      onClick={handleRejectionSubmit}
                      disabled={!rejectionReason.trim()}
                    >
                      Confirm Rejection
                    </Button>
                    <Button variant="outline" onClick={() => setShowRejectionForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {showPreview.type === 'location' && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                {showPreview.item.main_photo && (
                  <img 
                    src={showPreview.item.main_photo} 
                    alt={showPreview.item.name}
                    className="w-32 h-24 object-cover rounded-lg cursor-zoom-in"
                    onClick={() => { setGalleryIndex(0); setGalleryOpen(true); }}
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-bold">{showPreview.item.name}</h3>
                  <p className="text-muted-foreground">
                    {showPreview.item.address}, {showPreview.item.city}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Created: {new Date(showPreview.item.created_at).toLocaleDateString()}
                  </p>
                  {showPreview.item.companies?.name && (
                    <p className="text-sm text-muted-foreground">
                      Company: {showPreview.item.companies.name}
                    </p>
                  )}
                  {(showPreview.item.price_day || showPreview.item.price_week || showPreview.item.price_month) && (
                    <div className="text-sm text-muted-foreground mt-2">
                      <strong>Pricing:</strong>
                      {showPreview.item.price_day && ` €${showPreview.item.price_day}/day`}
                      {showPreview.item.price_day && showPreview.item.price_week && ' • '}
                      {showPreview.item.price_week && ` €${showPreview.item.price_week}/week`}
                      {(showPreview.item.price_day || showPreview.item.price_week) && showPreview.item.price_month && ' • '}
                      {showPreview.item.price_month && ` €${showPreview.item.price_month}/month`}
                    </div>
                  )}
                </div>
              </div>
              
              {showPreview.item.description && (
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-muted-foreground">{showPreview.item.description}</p>
                </div>
              )}
              
              {showPreview.item.photos && showPreview.item.photos.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Photo Gallery</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {showPreview.item.photos.map((photo: string, index: number) => (
                      <img 
                        key={index}
                        src={photo} 
                        alt={`${showPreview.item.name} photo ${index + 1}`}
                        className="w-full h-20 object-cover rounded cursor-zoom-in"
                        onClick={() => { setGalleryIndex((showPreview.item.main_photo ? index + 1 : index)); setGalleryOpen(true); }}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {!showRejectionForm ? (
                <div className="flex gap-2 pt-4">
                  <Button onClick={() => handleApproval('approved')}>
                    Approve
                  </Button>
                  <Button variant="destructive" onClick={() => handleApproval('rejected')}>
                    Deny
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="rejectionReason">Reason for Rejection *</Label>
                    <Textarea
                      id="rejectionReason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Please explain why this submission is being rejected..."
                      rows={3}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="destructive" 
                      onClick={handleRejectionSubmit}
                      disabled={!rejectionReason.trim()}
                    >
                      Confirm Rejection
                    </Button>
                    <Button variant="outline" onClick={() => setShowRejectionForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {showPreview.type === 'article' && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                {showPreview.item.image && (
                  <img 
                    src={showPreview.item.image} 
                    alt={showPreview.item.title}
                    className="w-32 h-24 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1">
                  <h3 className="text-xl font-bold">{showPreview.item.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    Created: {new Date(showPreview.item.created_at).toLocaleDateString()}
                  </p>
                  {showPreview.item.companies?.name && (
                    <p className="text-sm text-muted-foreground">
                      Company: {showPreview.item.companies.name}
                    </p>
                  )}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Content</h4>
                <div className="max-h-48 overflow-y-auto p-3 bg-muted rounded-lg">
                  <p className="text-muted-foreground whitespace-pre-wrap">{showPreview.item.content}</p>
                </div>
              </div>
              
              {!showRejectionForm ? (
                <div className="flex gap-2 pt-4">
                  <Button onClick={() => handleApproval('approved')}>
                    Approve
                  </Button>
                  <Button variant="destructive" onClick={() => handleApproval('rejected')}>
                    Deny
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="rejectionReason">Reason for Rejection *</Label>
                    <Textarea
                      id="rejectionReason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Please explain why this submission is being rejected..."
                      rows={3}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="destructive" 
                      onClick={handleRejectionSubmit}
                      disabled={!rejectionReason.trim()}
                    >
                      Confirm Rejection
                    </Button>
                    <Button variant="outline" onClick={() => setShowRejectionForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {showPreview.type === 'banner' && (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold">Banner Preview</h3>
                  <p className="text-sm text-muted-foreground">
                    Created: {new Date(showPreview.item.created_at).toLocaleDateString()}
                  </p>
                  {showPreview.item.companies?.name && (
                    <p className="text-sm text-muted-foreground">
                      Company: {showPreview.item.companies.name}
                    </p>
                  )}
                </div>
                {showPreview.item.companies?.logo && (
                  <img 
                    src={showPreview.item.companies.logo} 
                    alt={showPreview.item.companies.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                )}
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Banner Text</h4>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-muted-foreground">{showPreview.item.text}</p>
                </div>
              </div>

              {showPreview.item.image && (
                <div>
                  <h4 className="font-medium mb-2">Banner Image</h4>
                  <img 
                    src={showPreview.item.image} 
                    alt="Banner"
                    className="w-full max-w-md h-32 object-cover rounded-lg"
                  />
                </div>
              )}
              
              {!showRejectionForm ? (
                <div className="flex gap-2 pt-4">
                  <Button onClick={() => handleApproval('approved')}>
                    Approve
                  </Button>
                  <Button variant="destructive" onClick={() => handleApproval('rejected')}>
                    Deny
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="rejectionReason">Reason for Rejection *</Label>
                    <Textarea
                      id="rejectionReason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Please explain why this submission is being rejected..."
                      rows={3}
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="destructive" 
                      onClick={handleRejectionSubmit}
                      disabled={!rejectionReason.trim()}
                    >
                      Confirm Rejection
                    </Button>
                    <Button variant="outline" onClick={() => setShowRejectionForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {showPreview.type === 'location' && (
          <LightboxGallery
            images={locationImages}
            open={galleryOpen}
            initialIndex={galleryIndex}
            onOpenChange={setGalleryOpen}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}