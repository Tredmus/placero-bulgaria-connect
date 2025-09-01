import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Edit, Plus, Trash2 } from 'lucide-react';

interface CompanyCardProps {
  company: any;
  locations: any[];
  onEditCompany: (company: any) => void;
  onEditLocation: (location: any) => void;
  onAddLocation: (companyId: string) => void;
  onDeleteCompany: (companyId: string) => void;
  onDeleteLocation: (locationId: string) => void;
}

export function CompanyCard({ company, locations, onEditCompany, onEditLocation, onAddLocation, onDeleteCompany, onDeleteLocation }: CompanyCardProps) {
  return (
    <Card className={company.status === 'pending' ? 'opacity-60' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {company.logo && (
              <img src={company.logo} alt={company.name} className="w-12 h-12 object-cover rounded" />
            )}
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {company.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {company.status === 'pending' && (
                  <>
                    <Badge variant="secondary">в изчакване</Badge>
                    <span className="text-sm text-muted-foreground">Чака одобрение</span>
                  </>
                )}
                {company.status === 'rejected' && (
                  <>
                    <Badge variant="destructive">отхвърлена</Badge>
                    {company.rejection_reason && (
                      <span className="text-sm text-red-600">Причина: {company.rejection_reason}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onEditCompany(company)}>
              <Edit className="h-4 w-4 mr-2" />
              Редактирай компания
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDeleteCompany(company.id)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Изтрий
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {company.description && (
          <p className="text-muted-foreground mb-4">{company.description}</p>
        )}
        
        {/* Locations for this company */}
        <div className="space-y-3">
          <h4 className="font-medium">Локации</h4>
          {locations.map((location) => (
            <div key={location.id} className={`p-4 border rounded-lg ${location.status === 'pending' ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {location.main_photo && (
                    <img src={location.main_photo} alt={location.name} className="w-16 h-12 object-cover rounded" />
                  )}
                  <div>
                    <h5 className="font-medium">{location.name}</h5>
                    <p className="text-sm text-muted-foreground">{location.address}, {location.city}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {location.status === 'pending' && (
                        <>
                          <Badge variant="secondary" className="text-xs">в изчакване</Badge>
                          <span className="text-xs text-muted-foreground">Чака одобрение</span>
                        </>
                      )}
                      {location.status === 'rejected' && (
                        <>
                          <Badge variant="destructive" className="text-xs">отхвърлена</Badge>
                          {location.rejection_reason && (
                            <span className="text-xs text-red-600">Причина: {location.rejection_reason}</span>
                          )}
                        </>
                      )}
                    </div>
                    {(location.price_day || location.price_week || location.price_month) && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {location.price_day && `€${location.price_day}/day`}
                        {location.price_day && location.price_week && ' • '}
                        {location.price_week && `€${location.price_week}/week`}
                        {(location.price_day || location.price_week) && location.price_month && ' • '}
                        {location.price_month && `€${location.price_month}/month`}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEditLocation(location)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Редактирай локация
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onDeleteLocation(location.id)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Изтрий
                  </Button>
                </div>
              </div>
              {location.description && (
                <p className="text-sm text-muted-foreground mt-2">{location.description}</p>
              )}
            </div>
          ))}
          
          <Button variant="outline" className="w-full" onClick={() => onAddLocation(company.id)}>
            <Plus className="h-4 w-4 mr-2" />
            Добави друга локация
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}