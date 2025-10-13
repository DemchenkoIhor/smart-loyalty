import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, TrendingUp, Users, Calendar, DollarSign } from "lucide-react";

interface AnalyticsData {
  totalClients: number;
  totalAppointments: number;
  completedAppointments: number;
  totalRevenue: number;
  avgAppointmentValue: number;
  repeatClientRate: number;
}

const Analytics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalClients: 0,
    totalAppointments: 0,
    completedAppointments: 0,
    totalRevenue: 0,
    avgAppointmentValue: 0,
    repeatClientRate: 0,
  });

  useEffect(() => {
    checkAuthAndLoadAnalytics();
  }, []);

  const checkAuthAndLoadAnalytics = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!roleData || roleData.role !== "admin") {
        toast.error("Доступ заборонено");
        navigate("/dashboard");
        return;
      }

      loadAnalytics();
    } catch (error) {
      console.error("Auth error:", error);
      toast.error("Помилка автентифікації");
    }
  };

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Загальна кількість клієнтів
      const { count: clientsCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true });

      // Всі записи
      const { data: allAppointments, count: appointmentsCount } = await supabase
        .from("appointments")
        .select("*", { count: "exact" });

      // Завершені записи
      const { data: completedAppts, count: completedCount } = await supabase
        .from("appointments")
        .select("price", { count: "exact" })
        .eq("status", "completed");

      // Розрахунок доходу
      const totalRevenue = completedAppts?.reduce((sum, apt) => sum + Number(apt.price), 0) || 0;
      const avgValue = completedCount ? totalRevenue / completedCount : 0;

      // Розрахунок повторних клієнтів
      const clientAppointmentCounts = allAppointments?.reduce((acc, apt) => {
        acc[apt.client_id] = (acc[apt.client_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const repeatClients = Object.values(clientAppointmentCounts).filter(count => count > 1).length;
      const repeatRate = clientsCount ? (repeatClients / clientsCount) * 100 : 0;

      setAnalytics({
        totalClients: clientsCount || 0,
        totalAppointments: appointmentsCount || 0,
        completedAppointments: completedCount || 0,
        totalRevenue,
        avgAppointmentValue: avgValue,
        repeatClientRate: repeatRate,
      });
    } catch (error) {
      console.error("Error loading analytics:", error);
      toast.error("Помилка завантаження аналітики");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-subtle">
      <div className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Аналітика</h1>
              <p className="text-sm text-muted-foreground">
                Огляд основних показників
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Завантаження...</p>
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <Card className="shadow-medium">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Всього клієнтів</p>
                      <h3 className="text-3xl font-bold mb-1">{analytics.totalClients}</h3>
                      <p className="text-xs text-muted-foreground">У базі даних</p>
                    </div>
                    <div className="text-primary opacity-80">
                      <Users className="h-8 w-8" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-medium">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Всього записів</p>
                      <h3 className="text-3xl font-bold mb-1">{analytics.totalAppointments}</h3>
                      <p className="text-xs text-muted-foreground">
                        Завершено: {analytics.completedAppointments}
                      </p>
                    </div>
                    <div className="text-primary opacity-80">
                      <Calendar className="h-8 w-8" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-medium">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Загальний дохід</p>
                      <h3 className="text-3xl font-bold mb-1">{analytics.totalRevenue.toFixed(0)} грн</h3>
                      <p className="text-xs text-muted-foreground">
                        Завершені записи
                      </p>
                    </div>
                    <div className="text-primary opacity-80">
                      <DollarSign className="h-8 w-8" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-medium">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Середній чек</p>
                      <h3 className="text-3xl font-bold mb-1">{analytics.avgAppointmentValue.toFixed(0)} грн</h3>
                      <p className="text-xs text-muted-foreground">
                        На один візит
                      </p>
                    </div>
                    <div className="text-primary opacity-80">
                      <TrendingUp className="h-8 w-8" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-medium">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Повторні клієнти</p>
                      <h3 className="text-3xl font-bold mb-1">{analytics.repeatClientRate.toFixed(1)}%</h3>
                      <p className="text-xs text-muted-foreground">
                        Відсоток клієнтів з 2+ візитами
                      </p>
                    </div>
                    <div className="text-primary opacity-80">
                      <Users className="h-8 w-8" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-medium">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Конверсія</p>
                      <h3 className="text-3xl font-bold mb-1">
                        {analytics.totalAppointments > 0 
                          ? ((analytics.completedAppointments / analytics.totalAppointments) * 100).toFixed(1)
                          : 0}%
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Завершених записів
                      </p>
                    </div>
                    <div className="text-primary opacity-80">
                      <TrendingUp className="h-8 w-8" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Про аналітику</CardTitle>
                <CardDescription>
                  Дані оновлюються автоматично на основі завершених записів
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5"></div>
                    <p><strong>Загальний дохід</strong> - сума всіх завершених записів</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5"></div>
                    <p><strong>Середній чек</strong> - середня вартість одного візиту</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5"></div>
                    <p><strong>Повторні клієнти</strong> - відсоток клієнтів, які відвідали салон більше одного разу</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5"></div>
                    <p><strong>Конверсія</strong> - відсоток записів, які були успішно завершені</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default Analytics;
