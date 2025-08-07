import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';

import { Building2, Sparkles, Mail, Lock, User as UserIcon } from 'lucide-react';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const from = location.state?.from?.pathname || '/';
  const tab = searchParams.get('tab') || 'signin';

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Attempting signin with:', { email });
    setLoading(true);
    
    try {
      const { error } = await signIn(email, password);
      console.log('Signin result:', { error });
      
      if (!error) {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      console.error('Signin error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      console.log('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      console.log('Password too short');
      return;
    }
    
    console.log('Attempting signup with:', { email, username });
    setLoading(true);
    
    try {
      const { error } = await signUp(email, password, username);
      console.log('Signup result:', { error });
      
      if (!error) {
        // Reset form on success
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setUsername('');
      }
    } catch (err) {
      console.error('Signup error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-gradient-to-br from-background via-muted/20 to-accent/10">
      <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center space-x-3 mb-8 placero-fade-in">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/60 rounded-xl blur-lg opacity-30"></div>
              <Building2 className="h-10 w-10 text-primary relative z-10" />
            </div>
            <span className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Placero
            </span>
          </div>

          <Card className="placero-card-elevated placero-scale-in border-border/50">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                Добре дошли
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Влезте в профила си или създайте нов акаунт
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={tab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-2 placero-glass">
                  <TabsTrigger value="signin" className="font-medium">Вход</TabsTrigger>
                  <TabsTrigger value="signup" className="font-medium">Регистрация</TabsTrigger>
                </TabsList>
                
                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center font-medium">
                        <Mail className="h-4 w-4 mr-2 text-primary" />
                        Имейл
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="Въведете вашия имейл"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="placero-glass border-border/50 focus:border-primary/50 transition-all"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="flex items-center font-medium">
                        <Lock className="h-4 w-4 mr-2 text-primary" />
                        Парола
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Въведете вашата парола"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="placero-glass border-border/50 focus:border-primary/50 transition-all"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full placero-button-primary" disabled={loading}>
                      {loading ? (
                        <div className="flex items-center">
                          <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                          Влизане...
                        </div>
                      ) : (
                        'Влизане'
                      )}
                    </Button>
                  </form>
                </TabsContent>
                
                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="username" className="flex items-center font-medium">
                        <UserIcon className="h-4 w-4 mr-2 text-primary" />
                        Потребителско име
                      </Label>
                      <Input
                        id="username"
                        type="text"
                        placeholder="Изберете потребителско име"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="placero-glass border-border/50 focus:border-primary/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="flex items-center font-medium">
                        <Mail className="h-4 w-4 mr-2 text-primary" />
                        Имейл
                      </Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="Въведете вашия имейл"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="placero-glass border-border/50 focus:border-primary/50 transition-all"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="flex items-center font-medium">
                        <Lock className="h-4 w-4 mr-2 text-primary" />
                        Парола
                      </Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Създайте парола (мин. 6 символа)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="placero-glass border-border/50 focus:border-primary/50 transition-all"
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password" className="flex items-center font-medium">
                        <Lock className="h-4 w-4 mr-2 text-primary" />
                        Потвърдете паролата
                      </Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="Потвърдете вашата парола"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="placero-glass border-border/50 focus:border-primary/50 transition-all"
                        required
                        minLength={6}
                      />
                      {password !== confirmPassword && confirmPassword && (
                        <p className="text-sm text-destructive flex items-center mt-2">
                          <span className="w-1 h-1 bg-destructive rounded-full mr-2"></span>
                          Паролите не съвпадат
                        </p>
                      )}
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full placero-button-primary" 
                      disabled={loading || password !== confirmPassword || password.length < 6}
                    >
                      {loading ? (
                        <div className="flex items-center">
                          <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                          Създаване на акаунт...
                        </div>
                      ) : (
                        'Създаване на акаунт'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
        </CardContent>
      </Card>
    </div>
  </div>
);
};

export default Auth;