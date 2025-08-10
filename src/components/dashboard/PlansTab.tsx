import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Check, Crown, Zap, Building2 } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price_month: number;
  price_year: number;
  perks: string[];
  tier: number;
}

interface PlansTabProps {
  userCompanies: any[];
  onSubscriptionUpdate: () => void;
}

const PlansTab = ({ userCompanies, onSubscriptionUpdate }: PlansTabProps) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPlans();
    checkCurrentSubscription();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('tier', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно зареждане на плановете',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const checkCurrentSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;
      
      if (data.subscribed && data.planId) {
        setCurrentPlan(data.planId);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const handleSelectPlan = async (plan: Plan) => {
    try {
      setProcessingPlan(plan.id);

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          planId: plan.id,
          planName: plan.name,
          price: plan.price_month,
        },
      });

      if (error) throw error;

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast({
        title: 'Грешка',
        description: 'Неуспешно стартиране на процеса за абонамент',
        variant: 'destructive',
      });
    } finally {
      setProcessingPlan(null);
    }
  };

  const getPlanIcon = (tier: number) => {
    switch (tier) {
      case 1:
        return Building2;
      case 2:
        return Zap;
      case 3:
        return Crown;
      default:
        return Building2;
    }
  };

  const getPlanColor = (tier: number) => {
    switch (tier) {
      case 1:
        return 'border-border';
      case 2:
        return 'border-primary';
      case 3:
        return 'border-gradient-to-r from-amber-400 to-orange-500';
      default:
        return 'border-border';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Зареждане на плановете...</div>;
  }

  const hasCompany = userCompanies.length > 0;

  return (
    <div className="space-y-6 placero-fade-in">
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl">
            <Crown className="h-10 w-10 text-primary" />
          </div>
        </div>
        <h2 className="text-3xl font-bold mb-4 placero-heading">Изберете план</h2>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          {hasCompany 
            ? "Надградете присъствието си и отключете премиум функции" 
            : "Моля, създайте първата си компания и локация преди да изберете план"
          }
        </p>
      </div>

      {!hasCompany && (
        <div className="placero-card relative overflow-hidden border-l-4 border-l-primary">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/5"></div>
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <p className="text-foreground font-medium">
                Трябва да създадете първата си компания и локация, преди да можете да изберете план.
              </p>
            </div>
          </CardContent>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const Icon = getPlanIcon(plan.tier);
          const isCurrentPlan = currentPlan === plan.id;
          const isPopular = plan.tier === 2;

          return (
            <div 
              key={plan.id} 
              className={`placero-card-elevated relative overflow-hidden ${isCurrentPlan ? 'ring-2 ring-primary placero-hover-glow' : 'placero-hover-lift'} transition-all duration-300`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-card via-card to-muted/30"></div>
              
              {isPopular && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-20">
                  <Badge className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg">
                    Най-популярен
                  </Badge>
                </div>
              )}
              {isCurrentPlan && (
                <div className="absolute -top-2 right-4 z-20">
                  <Badge className="bg-gradient-to-r from-secondary to-secondary/80 text-secondary-foreground shadow-lg">
                    Текущ план
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-4 relative z-10">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold placero-heading">{plan.name}</CardTitle>
                <CardDescription className="mt-4">
                  <span className="text-4xl font-bold text-foreground">
                    {plan.price_month} лв
                  </span>
                  <span className="text-muted-foreground text-lg">/месец</span>
                  <div className="text-sm text-muted-foreground mt-1">≈ €{(plan.price_month/1.95583).toFixed(2)} / месец</div>
                </CardDescription>
                <p className="text-sm text-muted-foreground mt-2">
                  или {plan.price_year} лв/година (спестявате {((plan.price_month * 12) - plan.price_year).toFixed(2)} лв) • ≈ €{(plan.price_year/1.95583).toFixed(2)} / година
                </p>
              </CardHeader>

              <CardContent className="space-y-6 relative z-10">
                <ul className="space-y-3">
                  {plan.perks.map((perk, index) => (
                    <li key={index} className="flex items-center gap-3 placero-fade-in" style={{animationDelay: `${index * 0.1}s`}}>
                      <div className="p-1 bg-primary/20 rounded-full">
                        <Check className="h-3 w-3 text-primary flex-shrink-0" />
                      </div>
                      <span className="text-sm text-foreground">{perk}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full h-12 text-base font-semibold transition-all duration-200 ${
                    isCurrentPlan 
                      ? "placero-button-ghost" 
                      : isPopular 
                        ? "placero-button-primary" 
                        : "placero-button-secondary"
                  }`}
                  disabled={!hasCompany || processingPlan === plan.id || isCurrentPlan}
                  onClick={() => handleSelectPlan(plan)}
                >
                  {processingPlan === plan.id ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                      Обработка...
                    </div>
                  ) : isCurrentPlan ? (
                    "Текущ план"
                  ) : (
                    `Избери ${plan.name}`
                  )}
                </Button>
              </CardContent>
            </div>
          );
        })}
      </div>

      {hasCompany && !currentPlan && (
        <div className="placero-card-hero relative overflow-hidden mt-8">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10"></div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 rounded-full -translate-y-12 translate-x-12"></div>
          <CardContent className="pt-8 pb-6 relative z-10">
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="p-3 bg-primary/20 rounded-full">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Готови ли сте да започнете?</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Изберете план по-горе, за да отключите премиум функции за вашето пространство.
              </p>
            </div>
          </CardContent>
        </div>
      )}
    </div>
  );
};

export default PlansTab;