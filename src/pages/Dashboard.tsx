import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Calendar, Users, LogOut, MessageSquare, BellRing, TrendingUp } from "lucide-react";

interface UserRole {
  role: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [stats, setStats] = useState({
    todayAppointments: 0,
    totalClients: 0
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (userRole) {
      loadStats();
    }
  }, [userRole]);

  const loadStats = async () => {
    try {
      // Get total clients
      const { count: clientsCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true });

      // Get today's appointments
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { count: todayCount } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .gte("scheduled_at", today.toISOString())
        .lt("scheduled_at", tomorrow.toISOString());

      setStats({
        todayAppointments: todayCount || 0,
        totalClients: clientsCount || 0
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

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

      // Get user roles (handle multiple roles gracefully)
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (error) {
        console.error("Error fetching roles:", error);
        toast.error("Помилка перевірки ролі користувача");
        return;
      }

      let role: string | null = null;
      if (roles && roles.length > 0) {
        const roleList = roles.map(r => r.role);
        role = roleList.includes("admin") ? "admin" : (roleList.includes("employee") ? "employee" : null);
      }

      // Fallback: if no explicit role, check if user is linked to employees table
      if (!role) {
        const { data: emp } = await supabase
          .from("employees")
          .select("id")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (emp) role = "employee";
      }

      if (!role) {
        toast.error("У вас немає доступу до системи");
        await supabase.auth.signOut();
        navigate("/login");
        return;
      }

      setUserRole(role);
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
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <StatCard
            title="Записи сьогодні"
            value={stats.todayAppointments.toString()}
            icon={<Calendar className="h-8 w-8" />}
            description="Нових записів"
          />
          <StatCard
            title="Всього клієнтів"
            value={stats.totalClients.toString()}
            icon={<Users className="h-8 w-8" />}
            description="У базі даних"
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
                  onClick={() => navigate("/employees/manage")}
                >
                  <Users className="mr-2 h-6 w-6" />
                  Працівники
                </Button>
                <Button
                  variant="outline"
                  className="h-20 text-lg hover:shadow-medium transition-all"
                  onClick={() => navigate("/communications")}
                >
                  <MessageSquare className="mr-2 h-6 w-6" />
                  Комунікації
                </Button>
                <Button
                  variant="outline"
                  className="h-20 text-lg hover:shadow-medium transition-all"
                  onClick={() => navigate("/auto-messages")}
                >
                  <BellRing className="mr-2 h-6 w-6" />
                  Автоповідомлення
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