import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface PreviewDialogProps {
  showPreview: {type: string, item: any} | null;
  onClose: () => void;
  onApproval: (table: 'companies' | 'locations' | 'articles', id: string, action: 'approved' | 'rejected') => void;
}

export function PreviewDialog({ showPreview, onClose, onApproval }: PreviewDialogProps) {
  if (!showPreview) return null;

  const handleApproval = (action: 'approved' | 'rejected') => {
    const table = showPreview.type === 'company' ? 'companies' : 'locations';
    onApproval(table as 'companies' | 'locations', showPreview.item.id, action);
    onClose();
  };

  return (
    <Dialog open={!!showPreview} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {showPreview.type === 'company' ? 'Company Preview' : 'Location Preview'}
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
            
            <div className="flex gap-2 pt-4">
              <Button onClick={() => handleApproval('approved')}>
                Approve
              </Button>
              <Button variant="destructive" onClick={() => handleApproval('rejected')}>
                Deny
              </Button>
            </div>
          </div>
        )}
        
        {showPreview.type === 'location' && (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              {showPreview.item.main_photo && (
                <img 
                  src={showPreview.item.main_photo} 
                  alt={showPreview.item.name}
                  className="w-32 h-24 object-cover rounded-lg"
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
                      className="w-full h-20 object-cover rounded"
                    />
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex gap-2 pt-4">
              <Button onClick={() => handleApproval('approved')}>
                Approve
              </Button>
              <Button variant="destructive" onClick={() => handleApproval('rejected')}>
                Deny
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}