import { useArticles } from "@/hooks/useArticles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { BookOpen, Calendar, User, ArrowRight, Sparkles } from "lucide-react";

const FeaturedArticles = () => {
  const { articles, loading } = useArticles();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('bg-BG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateContent = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <section className="py-20 bg-gradient-to-br from-muted/30 via-background to-accent/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text mb-4">
              Последни новини
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Открийте най-актуалните новини от света на работните пространства
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="placero-card-elevated animate-pulse">
                <Skeleton className="h-48 w-full" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const featuredArticles = articles.slice(0, 3);

  return (
    <section className="py-20 bg-gradient-to-br from-muted/30 via-background to-accent/10 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(140,255,141,0.05),rgba(255,255,255,0))]" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16 placero-fade-in">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <BookOpen className="h-4 w-4 mr-2" />
            Последни публикации
          </div>
          <h2 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text mb-4">
            Последни новини
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Открийте най-актуалните новини от света на работните пространства
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {featuredArticles.map((article, index) => (
            <Link key={article.id} to={`/articles/${article.id}`} className={`placero-stagger-${index + 1}`}>
              <Card className="placero-card-elevated placero-hover-lift overflow-hidden h-full group">
                {article.image && (
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      src={article.image}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-all duration-500"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
                  </div>
                )}
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                    {article.title}
                  </CardTitle>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                    <div className="flex items-center">
                      <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 mr-2">
                        <User className="h-3 w-3 text-primary" />
                      </div>
                      <span className="font-medium">{article.companies?.name}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="p-1.5 rounded-lg bg-muted/50 border border-border/50 mr-2">
                        <Calendar className="h-3 w-3 text-foreground" />
                      </div>
                      <span className="font-medium">{formatDate(article.created_at)}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {truncateContent(article.content)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        
        <div className="text-center">
          <Button asChild size="lg" className="placero-button-secondary group">
            <Link to="/articles">
              <Sparkles className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform" />
              Виж всички статии
              <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FeaturedArticles;