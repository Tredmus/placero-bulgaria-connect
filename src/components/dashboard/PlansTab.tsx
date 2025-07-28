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
        title: 'Error',
        description: 'Failed to load plans',
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
        title: 'Error',
        description: 'Failed to start checkout process',
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
    return <div className="text-center py-8">Loading plans...</div>;
  }

  const hasCompany = userCompanies.length > 0;

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">Choose Your Plan</h2>
        <p className="text-muted-foreground">
          {hasCompany 
            ? "Upgrade your workspace to unlock premium features" 
            : "Please create your first company and location before selecting a plan"
          }
        </p>
      </div>

      {!hasCompany && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-amber-600" />
              <p className="text-amber-800">
                You need to create your first company and location before you can select a plan.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const Icon = getPlanIcon(plan.tier);
          const isCurrentPlan = currentPlan === plan.id;
          const isPopular = plan.tier === 2;

          return (
            <Card 
              key={plan.id} 
              className={`relative ${getPlanColor(plan.tier)} ${isCurrentPlan ? 'ring-2 ring-primary' : ''}`}
            >
              {isPopular && (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}
              {isCurrentPlan && (
                <Badge variant="secondary" className="absolute -top-2 right-4">
                  Current Plan
                </Badge>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-2">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">
                    ${plan.price_month}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </CardDescription>
                <p className="text-sm text-muted-foreground">
                  or ${plan.price_year}/year (save ${((plan.price_month * 12) - plan.price_year).toFixed(2)})
                </p>
              </CardHeader>

              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.perks.map((perk, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-sm">{perk}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={isCurrentPlan ? "outline" : "default"}
                  disabled={!hasCompany || processingPlan === plan.id || isCurrentPlan}
                  onClick={() => handleSelectPlan(plan)}
                >
                  {processingPlan === plan.id ? (
                    "Processing..."
                  ) : isCurrentPlan ? (
                    "Current Plan"
                  ) : (
                    `Select ${plan.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {hasCompany && !currentPlan && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="font-semibold text-blue-900 mb-2">Ready to get started?</h3>
              <p className="text-blue-800 mb-4">
                Choose a plan above to unlock premium features for your workspace.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PlansTab;