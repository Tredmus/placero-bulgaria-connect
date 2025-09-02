import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Building2, MapPin, FileText, Eye, Crown } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CompanyCard } from '@/components/dashboard/CompanyCard';
import { CompanyForm } from '@/components/dashboard/CompanyForm';
import { LocationForm } from '@/components/dashboard/LocationForm';
import ArticleForm from '@/components/dashboard/ArticleForm';
import { PreviewDialog } from '@/components/dashboard/PreviewDialog';
import { CompanyLocationForm } from '@/components/dashboard/CompanyLocationForm';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import BannerForm from '@/components/dashboard/BannerForm';
import PlansTab from '@/components/dashboard/PlansTab';

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
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<any>(null);
  const [selectedCompanyForArticle, setSelectedCompanyForArticle] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('tab') || 'locations';
    }
    return 'locations';
  });

  const [pendingCompanies, setPendingCompanies] = useState<any[]>([]);
  const [pendingLocations, setPendingLocations] = useState<any[]>([]);
  const [pendingArticles, setPendingArticles] = useState<PendingItem[]>([]);
  const [pendingBanners, setPendingBanners] = useState<any[]>([]);

  const [userCompanies, setUserCompanies] = useState<any[]>([]);
  const [userLocations, setUserLocations] = useState<any[]>([]);
  const [userArticles, setUserArticles] = useState<any[]>([]);
  const [userBanners, setUserBanners] = useState<any[]>([]);
  const [showPlansCTA, setShowPlansCTA] = useState(false);
  const [showPreview, setShowPreview] = useState<{ type: string; item: any } | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    if (user) fetchUserRole();
  }, [user]);

  useEffect(() => {
    if (userRole === 'admin' || userRole === 'moderator') {
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
    } catch {
      setUserRole('host');
    }
  };

  const fetchPendingItems = async () => {
    try {
      const [companiesRes, locationsRes, articlesRes, bannersRes] = await Promise.all([
        supabase.from('companies').select('*, profiles(username)').eq('status', 'pending'),
        supabase.from('locations').select('*, companies(name, logo)').eq('status', 'pending'),
        supabase.from('articles').select('*, companies(name, logo)').eq('status', 'pending'),
        supabase.from('banners').select('*, companies(name, logo)').eq('status', 'pending'),
      ]);

      setPendingCompanies(companiesRes.data || []);
      setPendingLocations(locationsRes.data || []);
      setPendingArticles((articlesRes.data || []).map((a) => ({ ...a, name: a.title })));
      setPendingBanners((bannersRes.data || []).map((b) => ({ ...b, name: `Banner: ${b.text?.substring(0, 30)}...` })));
    } catch {}
  };

  const fetchUserSpaces = async () => {
    try {
      const [companiesRes, locationsRes, articlesRes, bannersRes] = await Promise.all([
        supabase.from('companies').select('*').eq('owner_id', user?.id),
        supabase.from('locations').select('*, companies(name, logo)'),
        supabase.from('articles').select('*, companies(name, logo)'),
        supabase.from('banners').select('*, companies(name, logo)'),
      ]);

      setUserCompanies(companiesRes.data || []);

      const userCompanyIds = (companiesRes.data || []).map((c) => c.id);

      setUserLocations((locationsRes.data || []).filter((l) => userCompanyIds.includes(l.company_id)));
      setUserArticles((articlesRes.data || []).filter((a) => userCompanyIds.includes(a.company_id)));
      setUserBanners((bannersRes.data || []).filter((b) => userCompanyIds.includes(b.company_id)));

      const hasContent = userCompanyIds.length > 0 && (locationsRes.data || []).some((l) => userCompanyIds.includes(l.company_id));
      const hasNoPlan = (companiesRes.data || []).every((company) => !company.plan_id);
      setShowPlansCTA(hasContent && hasNoPlan);
    } catch {}
  };

  const handleApproval = async (
    table: 'companies' | 'locations' | 'articles' | 'banners',
    id: string,
    action: 'approved' | 'rejected',
    rejectionReason?: string
  ) => {
    try {
      const updateData: any = { status: action };
      if (action === 'rejected' && rejectionReason) updateData.rejection_reason = rejectionReason;
      else if (action === 'approved') updateData.rejection_reason = null;

      const { error } = await supabase.from(table).update(updateData).eq('id', id);
      if (error) throw error;

      toast({
        title: 'Успех!',
        description: `Елементът е ${action === 'approved' ? 'одобрен' : 'отхвърлен'} успешно.`,
      });

      fetchPendingItems();
    } catch {
      toast({
        title: 'Грешка',
        description: `Неуспешно ${action === 'approved' ? 'одобряване' : 'отхвърляне'} на елемента.`,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Изтриване на компания',
      description:
        'Сигурни ли сте, че искате да изтриете тази компания? Това действие не може да бъде отменено и ще изтрие също всички свързани локации и статии.',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('companies').delete().eq('id', companyId);
          if (error) throw error;
          toast({ title: 'Успех!', description: 'Компанията е изтрита успешно.' });
          fetchUserSpaces();
        } catch {
          toast({ title: 'Грешка', description: 'Неуспешно изтриване на компанията.', variant: 'destructive' });
        }
        setConfirmDialog((p) => ({ ...p, open: false }));
      },
    });
  };

  const handleDeleteLocation = async (locationId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Изтриване на локация',
      description: 'Сигурни ли сте, че искате да изтриете тази локация? Това действие не може да бъде отменено.',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('locations').delete().eq('id', locationId);
          if (error) throw error;
          toast({ title: 'Успех!', description: 'Локацията е изтрита успешно.' });
          fetchUserSpaces();
        } catch {
          toast({ title: 'Грешка', description: 'Неуспешно изтриване на локацията.', variant: 'destructive' });
        }
        setConfirmDialog((p) => ({ ...p, open: false }));
      },
    });
  };

  const handleDeleteArticle = async (articleId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Изтриване на статия',
      description: 'Сигурни ли сте, че искате да изтриете тази статия? Това действие не може да бъде отменено.',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('articles').delete().eq('id', articleId);
          if (error) throw error;
          toast({ title: 'Успех!', description: 'Статията е изтрита успешно.' });
          fetchUserSpaces();
        } catch {
          toast({ title: 'Грешка', description: 'Неуспешно изтриване на статията.', variant: 'destructive' });
        }
        setConfirmDialog((p) => ({ ...p, open: false }));
      },
    });
  };

  const handleFormSuccess = () => {
    setShowAddSpaceForm(false);
    setShowEditCompanyForm(null);
    setShowEditLocationForm(null);
    setShowAddLocationForm(null);
    setShowArticleForm(false);
    setEditingArticle(null);
    setSelectedCompanyForArticle(null);
    fetchUserSpaces();
    setShowPlansCTA(false);
  };

  if (!userRole) return <div className="container mx-auto py-6 px-3 text-sm">Зареждане...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-6">
        {/* Header */}
        <div className="mb-4 sm:mb-8 placero-fade-in">
          <div className="flex items-center gap-2 sm:gap-4 mb-2 sm:mb-4">
            <div className="p-2 sm:p-3 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl">
              <Building2 className="h-5 w-5 sm:h-8 sm:w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Табло
              </h1>
              <p className="text-muted-foreground text-xs sm:text-lg">
                {userRole === 'admin' || userRole === 'moderator'
                  ? 'Управлявайте чакащите за одобрение'
                  : 'Управлявайте вашите работни пространства'}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mt-3 sm:mt-6">
            {[
              { label: 'Компании', value: userCompanies.length },
              { label: 'Локации', value: userLocations.length },
              { label: 'Статии', value: userArticles.length },
              { label: 'Банери', value: userBanners.length },
            ].map((s, i) => (
              <div
                key={s.label}
                className={`placero-card p-2 sm:p-6 text-center placero-hover-lift placero-scale-in placero-stagger-${
                  i + 1
                } relative overflow-hidden`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5" />
                <div className="relative z-10">
                  <div className="text-lg sm:text-3xl font-bold text-primary mb-0.5 sm:mb-1">{s.value}</div>
                  <div className="text-[10px] sm:text-sm text-muted-foreground">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {userRole === 'host' && (
          <div className="space-y-4 sm:space-y-6">
            {userCompanies.length === 0 ? (
              <Card>
                <CardHeader className="py-3 sm:py-5">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Building2 className="h-4 w-4" />
                    Вашите пространства
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Добавяйте и управлявайте вашите coworking пространства
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-4 sm:pb-6">
                  <Dialog open={showAddSpaceForm} onOpenChange={setShowAddSpaceForm}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Добавете вашето пространство
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Добавете вашето пространство</DialogTitle>
                        <DialogDescription>Създайте обява за вашето coworking пространство</DialogDescription>
                      </DialogHeader>
                      <CompanyLocationForm onSuccess={handleFormSuccess} onCancel={() => setShowAddSpaceForm(false)} />
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ) : (
              <>
                {showPlansCTA && (
                  <div className="mb-4 sm:mb-6 placero-card-hero relative overflow-hidden placero-fade-in">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5" />
                    <div className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 bg-primary/10 rounded-full -translate-y-12 translate-x-12 sm:-translate-y-16 sm:translate-x-16" />
                    <div className="absolute bottom-0 left-0 w-16 h-16 sm:w-24 sm:h-24 bg-primary/5 rounded-full translate-y-8 -translate-x-8 sm:translate-y-12 sm:-translate-x-12" />

                    <CardContent className="pt-6 sm:pt-8 pb-5 sm:pb-6 relative z-10">
                      <div className="text-center">
                        <div className="mb-3 sm:mb-4 flex justify-center">
                          <div className="p-2 sm:p-3 bg-primary/20 rounded-full">
                            <Crown className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                          </div>
                        </div>
                        <h3 className="text-lg sm:text-2xl font-bold mb-1.5 sm:mb-2 text-foreground placero-heading">
                          🎉 Страхотна работа! Вашето работно пространство е готово
                        </h3>
                        <p className="text-xs sm:text-base text-muted-foreground mb-4 sm:mb-6 max-w-md mx-auto">
                          Сега изберете план, за да отключите премиум функции и получите повече видимост.
                        </p>
                        <Button size="sm" className="placero-button-primary shadow-[var(--shadow-glow)]" onClick={() => setActiveTab('plans')}>
                          Изберете вашия план ✨
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                )}

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6 placero-slide-up">
                  <TabsList className="grid w-full grid-cols-3 placero-surface p-0.5 sm:p-1 h-auto rounded-lg">
                    <TabsTrigger
                      value="locations"
                      className="flex items-center gap-1.5 sm:gap-2 py-2 sm:py-3 px-2.5 sm:px-4 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
                    >
                      <MapPin className="h-4 w-4" />
                      Локации
                    </TabsTrigger>
                    <TabsTrigger
                      value="articles"
                      className="flex items-center gap-1.5 sm:gap-2 py-2 sm:py-3 px-2.5 sm:px-4 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
                    >
                      <FileText className="h-4 w-4" />
                      Статии
                    </TabsTrigger>
                    <TabsTrigger
                      value="plans"
                      className="flex items-center gap-1.5 sm:gap-2 py-2 sm:py-3 px-2.5 sm:px-4 text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
                    >
                      <Building2 className="h-4 w-4" />
                      Планове
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="locations" className="space-y-4 sm:space-y-6">
                    {userCompanies.map((company) => (
                      <CompanyCard
                        key={company.id}
                        company={company}
                        locations={userLocations.filter((loc) => loc.company_id === company.id)}
                        onEditCompany={(c) => setShowEditCompanyForm(c)}
                        onEditLocation={(l) => setShowEditLocationForm(l)}
                        onAddLocation={(companyId) => setShowAddLocationForm(companyId)}
                        onDeleteCompany={handleDeleteCompany}
                        onDeleteLocation={handleDeleteLocation}
                      />
                    ))}
                  </TabsContent>

                  <TabsContent value="articles" className="space-y-4 sm:space-y-6">
                    {userCompanies.map((company) => (
                      <Card key={company.id}>
                        <CardHeader className="pb-3 sm:pb-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 sm:gap-3">
                              {company.logo && (
                                <img src={company.logo} alt={company.name} className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded" />
                              )}
                              <div>
                                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                                  <Building2 className="h-4 w-4" />
                                  {company.name}
                                </CardTitle>
                                <CardDescription className="text-xs sm:text-sm">{company.description}</CardDescription>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => {
                                  setSelectedCompanyForArticle(company);
                                  setShowArticleForm(true);
                                }}
                                size="sm"
                              >
                                Добави статия
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {userArticles.filter((a) => a.company_id === company.id).length > 0 ? (
                            <div className="grid gap-3 sm:gap-4">
                              {userArticles
                                .filter((a) => a.company_id === company.id)
                                .map((article) => (
                                  <div key={article.id} className={`p-3 sm:p-4 border rounded-lg ${article.status === 'pending' ? 'opacity-60' : ''}`}>
                                    <div className="flex items-center justify-between gap-3 sm:gap-4 mb-2">
                                      <div className="flex items-center gap-2 sm:gap-3">
                                        {article.image && (
                                          <img src={article.image} alt={article.title} className="w-20 h-14 object-cover rounded" />
                                        )}
                                        <div>
                                          <h5 className="font-medium text-sm sm:text-base">{article.title}</h5>
                                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{article.content}</p>
                                        </div>
                                      </div>
                                      <div className="flex gap-2 shrink-0">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            setEditingArticle(article);
                                            setSelectedCompanyForArticle(company);
                                            setShowArticleForm(true);
                                          }}
                                        >
                                          Редактиране
                                        </Button>
                                        <Button variant="destructive" size="sm" onClick={() => handleDeleteArticle(article.id)}>
                                          Изтриване
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="text-[11px] sm:text-xs text-muted-foreground">
                                      Статус:{' '}
                                      {article.status === 'pending'
                                        ? 'Чака преглед'
                                        : article.status === 'approved'
                                        ? 'Одобрена'
                                        : 'Отхвърлена'}
                                      {article.rejection_reason && <span className="text-destructive ml-2">- {article.rejection_reason}</span>}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-sm">Все още няма статии.</p>
                          )}

                          <div className="mt-5 sm:mt-6 pt-4 sm:pt-6 border-t">
                            <h6 className="font-medium mb-2 sm:mb-3">Банери</h6>
                            <div className="space-y-3 sm:space-y-4 mb-3 sm:mb-4">
                              {userBanners
                                .filter((b) => b.company_id === company.id)
                                .map((banner) => (
                                  <div key={banner.id} className={`p-3 border rounded-lg ${banner.status === 'pending' ? 'opacity-60' : ''}`}>
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex-1">
                                        <p className="text-sm font-medium">{banner.text}</p>
                                        {banner.image && <p className="text-[11px] sm:text-xs text-muted-foreground">С изображение</p>}
                                      </div>
                                      <div className="text-[11px] sm:text-xs text-muted-foreground">
                                        Статус:{' '}
                                        {banner.status === 'pending'
                                          ? 'Чака преглед'
                                          : banner.status === 'approved'
                                          ? 'Одобрен'
                                          : 'Отхвърлен'}
                                        {banner.rejection_reason && <span className="text-destructive block">- {banner.rejection_reason}</span>}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                            </div>
                            <BannerForm companyId={company.id} onSuccess={fetchUserSpaces} />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  <TabsContent value="plans">
                    <PlansTab userCompanies={userCompanies} onSubscriptionUpdate={fetchUserSpaces} />
                  </TabsContent>
                </Tabs>
              </>
            )}

            {/* Edit Company */}
            {showEditCompanyForm && (
              <Dialog open={!!showEditCompanyForm} onOpenChange={() => setShowEditCompanyForm(null)}>
                <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Редактиране на компания</DialogTitle>
                    <DialogDescription>Актуализирайте информацията за вашата компания</DialogDescription>
                  </DialogHeader>
                  <CompanyForm company={showEditCompanyForm} onSuccess={handleFormSuccess} onCancel={() => setShowEditCompanyForm(null)} />
                </DialogContent>
              </Dialog>
            )}

            {/* Edit Location */}
            {showEditLocationForm && (
              <Dialog open={!!showEditLocationForm} onOpenChange={() => setShowEditLocationForm(null)}>
                <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Редактиране на локация</DialogTitle>
                    <DialogDescription>Актуализирайте информацията за вашата локация</DialogDescription>
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

            {/* Add Location */}
            {showAddLocationForm && (
              <Dialog open={!!showAddLocationForm} onOpenChange={() => setShowAddLocationForm(null)}>
                <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Добавяне на нова локация</DialogTitle>
                    <DialogDescription>Добавете още една локация към вашата компания</DialogDescription>
                  </DialogHeader>
                  <LocationForm companyId={showAddLocationForm} onSuccess={handleFormSuccess} onCancel={() => setShowAddLocationForm(null)} />
                </DialogContent>
              </Dialog>
            )}

            {/* Article */}
            <ArticleForm
              isOpen={showArticleForm}
              onClose={() => {
                setShowArticleForm(false);
                setEditingArticle(null);
                setSelectedCompanyForArticle(null);
              }}
              onSuccess={handleFormSuccess}
              companyId={selectedCompanyForArticle?.id}
              article={editingArticle}
            />
          </div>
        )}

        {(userRole === 'admin' || userRole === 'moderator') && (
          <>
            <div className="mb-4 sm:mb-8 placero-fade-in">
              <h2 className="text-xl sm:text-3xl font-bold mb-4 sm:mb-6 placero-heading">Чакащи прегледи</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                {[
                  { icon: Building2, label: 'Компании', value: pendingCompanies.length, bg: 'from-primary/10 to-primary/5' },
                  { icon: MapPin, label: 'Локации', value: pendingLocations.length, bg: 'from-accent/20 to-accent/10' },
                  { icon: FileText, label: 'Статии', value: pendingArticles.length, bg: 'from-secondary/20 to-secondary/10' },
                  { icon: FileText, label: 'Банери', value: pendingBanners.length, bg: 'from-muted/20 to-muted/10' },
                ].map((s, i) => (
                  <div key={s.label} className="placero-card-elevated relative overflow-hidden placero-hover-lift">
                    <div className={`absolute inset-0 bg-gradient-to-br ${s.bg}`} />
                    <CardHeader className="pb-2 sm:pb-3 relative z-10">
                      <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                        <s.icon className="h-4 w-4 text-primary" />
                        {s.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <div className="text-2xl sm:text-3xl font-bold text-primary">{s.value}</div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Чака преглед</p>
                    </CardContent>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {/* Companies */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2 className="h-5 w-5" />
                      Чакащи компании ({pendingCompanies.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5 sm:space-y-3">
                    {pendingCompanies.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Няма чакащи компании</p>
                    ) : (
                      pendingCompanies.map((company) => (
                        <div key={company.id} className="p-3 border rounded-lg space-y-1.5">
                          <h4 className="font-medium text-sm">{company.name}</h4>
                          <p className="text-[11px] text-muted-foreground">{new Date(company.created_at).toLocaleDateString()}</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setShowPreview({ type: 'company', item: company })}>
                              <Eye className="h-4 w-4 mr-1" />
                              Преглед и решение
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Locations */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MapPin className="h-5 w-5" />
                      Чакащи локации ({pendingLocations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5 sm:space-y-3">
                    {pendingLocations.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Няма чакащи локации</p>
                    ) : (
                      pendingLocations.map((location) => (
                        <div key={location.id} className="p-3 border rounded-lg space-y-1.5">
                          <h4 className="font-medium text-sm">{location.name}</h4>
                          <p className="text-[11px] text-muted-foreground">{new Date(location.created_at).toLocaleDateString()}</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setShowPreview({ type: 'location', item: location })}>
                              <Eye className="h-4 w-4 mr-1" />
                              Преглед и решение
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Articles */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-5 w-5" />
                      Чакащи статии ({pendingArticles.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5 sm:space-y-3">
                    {pendingArticles.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Няма чакащи статии</p>
                    ) : (
                      pendingArticles.map((article) => (
                        <div key={article.id} className="p-3 border rounded-lg space-y-1.5">
                          <h4 className="font-medium text-sm">{article.name}</h4>
                          <p className="text-[11px] text-muted-foreground">{new Date(article.created_at).toLocaleDateString()}</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setShowPreview({ type: 'article', item: article })}>
                              <Eye className="h-4 w-4 mr-1" />
                              Преглед и решение
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Banners */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-5 w-5" />
                      Чакащи банери ({pendingBanners.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2.5 sm:space-y-3">
                    {pendingBanners.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Няма чакащи банери</p>
                    ) : (
                      pendingBanners.map((banner) => (
                        <div key={banner.id} className="p-3 border rounded-lg space-y-1.5">
                          <h4 className="font-medium text-sm">{banner.name}</h4>
                          <p className="text-[11px] text-muted-foreground">{new Date(banner.created_at).toLocaleDateString()}</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setShowPreview({ type: 'banner', item: banner })}>
                              <Eye className="h-4 w-4 mr-1" />
                              Преглед и решение
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}

        <PreviewDialog showPreview={showPreview} onClose={() => setShowPreview(null)} onApproval={handleApproval} />

        <ConfirmationDialog
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
          title={confirmDialog.title}
          description={confirmDialog.description}
          onConfirm={confirmDialog.onConfirm}
        />
      </div>
    </div>
  );
}
