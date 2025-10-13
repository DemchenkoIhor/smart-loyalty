import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Calendar, Users, TrendingUp, LogOut } from "lucide-react";

interface UserRole {
  role: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/login");
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setUserName(profile.full_name);
      }

      // Get user role
      const { data: roleData, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching role:", error);
        toast.error("Помилка перевірки ролі користувача");
        return;
      }

      if (!roleData) {
        toast.error("У вас немає доступу до системи");
        handleLogout();
        return;
      }

      setUserRole(roleData.role);
    } catch (error) {
      console.error("Auth error:", error);
      toast.error("Помилка автентифікації");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Завантаження...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-subtle">
      <div className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">SmartLoyalty CRM</h1>
            <p className="text-sm text-muted-foreground">
              Вітаємо, {userName} ({userRole === "admin" ? "Адміністратор" : "Працівник"})
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Вийти
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Записи сьогодні"
            value="0"
            icon={<Calendar className="h-8 w-8" />}
            description="Нових записів"
          />
          <StatCard
            title="Всього клієнтів"
            value="0"
            icon={<Users className="h-8 w-8" />}
            description="У базі даних"
          />
          <StatCard
            title="Конверсія"
            value="0%"
            icon={<TrendingUp className="h-8 w-8" />}
            description="Повторних візитів"
          />
        </div>

        <Card className="shadow-medium">
          <CardHeader>
            <CardTitle>Швидкий доступ</CardTitle>
            <CardDescription>Основні функції системи</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="h-20 text-lg hover:shadow-medium transition-all"
              onClick={() => navigate("/calendar")}
            >
              <Calendar className="mr-2 h-6 w-6" />
              Календар
            </Button>
            
            {userRole === "admin" && (
              <>
                <Button
                  variant="outline"
                  className="h-20 text-lg hover:shadow-medium transition-all"
                  onClick={() => navigate("/clients")}
                >
                  <Users className="mr-2 h-6 w-6" />
                  Клієнти
                </Button>
                <Button
                  variant="outline"
                  className="h-20 text-lg hover:shadow-medium transition-all"
                  onClick={() => navigate("/employees")}
                >
                  <Users className="mr-2 h-6 w-6" />
                  Працівники
                </Button>
                <Button
                  variant="outline"
                  className="h-20 text-lg hover:shadow-medium transition-all"
                  onClick={() => navigate("/analytics")}
                >
                  <TrendingUp className="mr-2 h-6 w-6" />
                  Аналітика
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, description }: {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
}) => {
  return (
    <Card className="shadow-soft hover:shadow-medium transition-all">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <h3 className="text-3xl font-bold mb-1">{value}</h3>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="text-primary opacity-80">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Dashboard;