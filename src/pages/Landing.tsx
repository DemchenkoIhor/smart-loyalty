import { Calendar, Shield, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-subtle">
        <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <h1 className="mb-6 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Інтелектуальна CRM система для вашого бізнесу
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Автоматизуйте записи клієнтів, покращуйте комунікацію та підвищуйте лояльність 
              за допомогою сучасних технологій
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="gradient-primary shadow-glow hover:shadow-strong transition-all duration-300 text-lg px-8"
                onClick={() => navigate('/booking')}
              >
                <Calendar className="mr-2 h-5 w-5" />
                Записатися
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8 border-2 hover:bg-secondary"
                onClick={() => navigate('/login')}
              >
                Вхід для персоналу
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="mb-4">Переваги системи</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Все необхідне для ефективного управління клієнтами та автоматизації бізнес-процесів
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Calendar className="h-10 w-10" />}
              title="Онлайн запис"
              description="Зручна форма запису 24/7 з автоматичним підтвердженням"
            />
            <FeatureCard
              icon={<Zap className="h-10 w-10" />}
              title="Автоматизація"
              description="Автоматичні нагадування та персоналізовані повідомлення"
            />
            <FeatureCard
              icon={<TrendingUp className="h-10 w-10" />}
              title="Аналітика"
              description="Детальна статистика та інсайти для росту бізнесу"
            />
            <FeatureCard
              icon={<Shield className="h-10 w-10" />}
              title="Безпека"
              description="Захист даних клієнтів та відповідність стандартам"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="container mx-auto px-4 text-center relative">
          <div className="max-w-3xl mx-auto text-primary-foreground">
            <h2 className="mb-6">Готові почати?</h2>
            <p className="text-xl mb-10 opacity-90">
              Запишіться на візит прямо зараз та відчуйте зручність нашої системи
            </p>
            <Button 
              size="lg" 
              variant="secondary"
              className="text-lg px-8 shadow-strong hover:shadow-glow transition-all duration-300"
              onClick={() => navigate('/booking')}
            >
              <Calendar className="mr-2 h-5 w-5" />
              Записатися онлайн
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
}) => {
  return (
    <div className="p-8 rounded-xl bg-card shadow-soft hover:shadow-medium transition-all duration-300 animate-slide-up group">
      <div className="mb-4 text-primary group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl mb-3">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
};

export default Landing;