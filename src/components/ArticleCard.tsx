import { Calendar, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

interface ArticleCardProps {
  id: string;
  title: string;
  company: string;
  content: string;
  image?: string;
  createdAt: string;
}

const ArticleCard = ({
  id,
  title,
  company,
  content,
  image,
  createdAt,
}: ArticleCardProps) => {
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

  return (
    <Link to={`/articles/${id}`}>
      <Card className="placero-card-elevated placero-hover-lift cursor-pointer group h-full overflow-hidden">
        {image && (
          <div className="relative overflow-hidden">
            <img
              src={image}
              alt={title}
              className="w-full h-52 object-cover group-hover:scale-110 transition-all duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
          </div>
        )}

        <CardHeader className="pb-4 px-6 pt-6">
          <CardTitle className="text-xl font-bold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </CardTitle>
          <div className="flex items-center gap-6 text-sm text-muted-foreground pt-2">
            <div className="flex items-center">
              <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 mr-2">
                <User className="h-3 w-3 text-primary" />
              </div>
              <span className="font-medium">{company}</span>
            </div>
            <div className="flex items-center">
              <div className="p-1.5 rounded-lg bg-muted/50 border border-border/50 mr-2">
                <Calendar className="h-3 w-3 text-foreground" />
              </div>
              <span className="font-medium">{formatDate(createdAt)}</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6">
          <p className="text-muted-foreground leading-relaxed">
            {truncateContent(content)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
};

export default ArticleCard;