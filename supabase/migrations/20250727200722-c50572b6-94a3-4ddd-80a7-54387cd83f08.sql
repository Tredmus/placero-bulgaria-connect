-- Create enums for user roles and statuses
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'host', 'business_moderator');
CREATE TYPE public.status_type AS ENUM ('active', 'approved', 'pending', 'rejected');

-- Create plans table
CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price_month DECIMAL(10,2) NOT NULL,
  price_year DECIMAL(10,2) NOT NULL,
  tier INTEGER NOT NULL CHECK (tier IN (1, 2, 3)),
  perks TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  role app_role NOT NULL DEFAULT 'host',
  status status_type NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  logo TEXT,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status status_type NOT NULL DEFAULT 'pending',
  plan_id UUID REFERENCES public.plans(id),
  moderators UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create locations table
CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  description TEXT,
  photos TEXT[] DEFAULT '{}',
  amenities TEXT[] DEFAULT '{}',
  price_day DECIMAL(10,2),
  price_week DECIMAL(10,2),
  price_month DECIMAL(10,2),
  rating DECIMAL(3,2) DEFAULT 0,
  status status_type NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create articles table
CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image TEXT,
  status status_type NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create banners table
CREATE TABLE public.banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  image TEXT NOT NULL,
  text TEXT,
  status status_type NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

-- Create security definer functions to avoid recursive RLS issues
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS app_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_company_owner(company_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = company_uuid AND owner_id = auth.uid()
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_company_moderator(company_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = company_uuid AND (
      owner_id = auth.uid() OR 
      auth.uid() = ANY(moderators)
    )
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS Policies for plans table (public read, admin write)
CREATE POLICY "Plans are viewable by everyone" 
ON public.plans FOR SELECT USING (true);

CREATE POLICY "Only admins can manage plans" 
ON public.plans FOR ALL 
USING (public.get_current_user_role() = 'admin');

-- RLS Policies for profiles table
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles" 
ON public.profiles FOR ALL 
USING (public.get_current_user_role() = 'admin');

-- RLS Policies for companies table
CREATE POLICY "Approved companies are viewable by everyone" 
ON public.companies FOR SELECT 
USING (status = 'approved' OR owner_id = auth.uid() OR public.get_current_user_role() IN ('admin', 'moderator'));

CREATE POLICY "Company owners can update their companies" 
ON public.companies FOR UPDATE 
USING (owner_id = auth.uid() OR public.get_current_user_role() IN ('admin', 'moderator'));

CREATE POLICY "Authenticated users can create companies" 
ON public.companies FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins and moderators can delete companies" 
ON public.companies FOR DELETE 
USING (public.get_current_user_role() IN ('admin', 'moderator'));

-- RLS Policies for locations table
CREATE POLICY "Approved locations are viewable by everyone" 
ON public.locations FOR SELECT 
USING (
  status = 'approved' OR 
  public.is_company_moderator(company_id) OR 
  public.get_current_user_role() IN ('admin', 'moderator')
);

CREATE POLICY "Company moderators can manage locations" 
ON public.locations FOR ALL 
USING (
  public.is_company_moderator(company_id) OR 
  public.get_current_user_role() IN ('admin', 'moderator')
);

CREATE POLICY "Company moderators can create locations" 
ON public.locations FOR INSERT 
WITH CHECK (
  public.is_company_moderator(company_id) OR 
  public.get_current_user_role() IN ('admin', 'moderator')
);

-- RLS Policies for articles table
CREATE POLICY "Approved articles are viewable by everyone" 
ON public.articles FOR SELECT 
USING (
  status = 'approved' OR 
  public.is_company_moderator(company_id) OR 
  public.get_current_user_role() IN ('admin', 'moderator')
);

CREATE POLICY "Company moderators can manage articles" 
ON public.articles FOR ALL 
USING (
  public.is_company_moderator(company_id) OR 
  public.get_current_user_role() IN ('admin', 'moderator')
);

CREATE POLICY "Company moderators can create articles" 
ON public.articles FOR INSERT 
WITH CHECK (
  public.is_company_moderator(company_id) OR 
  public.get_current_user_role() IN ('admin', 'moderator')
);

-- RLS Policies for banners table
CREATE POLICY "Approved banners are viewable by everyone" 
ON public.banners FOR SELECT 
USING (
  status = 'approved' OR 
  public.is_company_moderator(company_id) OR 
  public.get_current_user_role() IN ('admin', 'moderator')
);

CREATE POLICY "Company moderators can manage banners" 
ON public.banners FOR ALL 
USING (
  public.is_company_moderator(company_id) OR 
  public.get_current_user_role() IN ('admin', 'moderator')
);

CREATE POLICY "Company moderators can create banners" 
ON public.banners FOR INSERT 
WITH CHECK (
  public.is_company_moderator(company_id) OR 
  public.get_current_user_role() IN ('admin', 'moderator')
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_banners_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role, status)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'username',
    'host',
    'pending'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert default plans
INSERT INTO public.plans (name, price_month, price_year, tier, perks) VALUES
('Basic', 29.99, 299.99, 1, ARRAY['Up to 3 locations', 'Basic listing', 'Email support']),
('Professional', 59.99, 599.99, 2, ARRAY['Up to 10 locations', 'Featured listing', 'Priority support', 'Analytics dashboard']),
('Enterprise', 99.99, 999.99, 3, ARRAY['Unlimited locations', 'Premium placement', '24/7 support', 'Advanced analytics', 'Custom branding']);