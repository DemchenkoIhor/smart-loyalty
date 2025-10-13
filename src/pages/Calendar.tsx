import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar as CalendarIcon, ArrowLeft, Plus, Edit, X, Check } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

interface Appointment {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  price: number;
  status: string;
  employee_id: string;
  service_id: string;
  client_id: string;
  employee_notes?: string;
  admin_notes?: string;
  clients: { full_name: string; phone: string };
  services: { name: string };
  employees: { profiles: { full_name: string } };
}

const Calendar = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  useEffect(() => {
    if (date && userId) {
      loadAppointments();
    }
  }, [date, userId]);

  const checkAuthAndLoadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      setUserId(session.user.id);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (roleData) {
        setUserRole(roleData.role);
      }
    } catch (error) {
      console.error("Auth error:", error);
      toast.error("Помилка автентифікації");
    }
  };

  const loadAppointments = async () => {
    if (!date) return;
    
    setLoading(true);
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      let query = supabase
        .from("appointments")
        .select(`
          *,
          clients(full_name, phone),
          services(name),
          employees(profiles(full_name))
        `)
        .gte("scheduled_at", startOfDay.toISOString())
        .lte("scheduled_at", endOfDay.toISOString())
        .order("scheduled_at");

      // Працівник бачить тільки свої записи
      if (userRole === "employee") {
        const { data: empData } = await supabase
          .from("employees")
          .select("id")
          .eq("user_id", userId)
          .single();

        if (empData) {
          query = query.eq("employee_id", empData.id);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error("Error loading appointments:", error);
      toast.error("Помилка завантаження записів");
    } finally {
      setLoading(false);
    }
  };

  const updateAppointmentStatus = async (id: string, status: "pending" | "confirmed" | "completed" | "cancelled") => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ 
          status,
          ...(status === "completed" ? { completed_at: new Date().toISOString() } : {}),
          ...(status === "cancelled" ? { cancelled_at: new Date().toISOString() } : {})
        })
        .eq("id", id);

      if (error) throw error;
      
      toast.success("Статус оновлено");
      loadAppointments();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Помилка оновлення статусу");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "confirmed": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed": return "Завершено";
      case "confirmed": return "Підтверджено";
      case "cancelled": return "Скасовано";
      default: return "Очікує";
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
              <h1 className="text-2xl font-bold">Календар записів</h1>
              <p className="text-sm text-muted-foreground">
                {date ? format(date, "d MMMM yyyy", { locale: uk }) : "Оберіть дату"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 shadow-medium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Оберіть дату
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CalendarComponent
                mode="single"
                selected={date}
                onSelect={setDate}
                locale={uk}
                className="rounded-md border"
              />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 shadow-medium">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Записи на {date ? format(date, "d MMMM", { locale: uk }) : ""}</CardTitle>
                  <CardDescription>
                    Всього записів: {appointments.length}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-sm text-muted-foreground">Завантаження...</p>
                </div>
              ) : appointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Немає записів на цю дату</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {appointments.map((apt) => (
                    <Card key={apt.id} className="shadow-soft">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold">
                                {format(new Date(apt.scheduled_at), "HH:mm")}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs ${getStatusColor(apt.status)}`}>
                                {getStatusText(apt.status)}
                              </span>
                            </div>
                            <p className="font-medium">{apt.clients.full_name}</p>
                            <p className="text-sm text-muted-foreground">{apt.clients.phone}</p>
                            <p className="text-sm mt-1">{apt.services.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {apt.duration_minutes} хв • {apt.price} грн
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Майстер: {apt.employees.profiles?.full_name}
                            </p>
                            {apt.admin_notes && (
                              <p className="text-sm mt-2 text-blue-600 dark:text-blue-400">
                                📝 {apt.admin_notes}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {apt.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAppointmentStatus(apt.id, "confirmed")}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            {apt.status === "confirmed" && userRole === "admin" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAppointmentStatus(apt.id, "completed")}
                              >
                                Завершити
                              </Button>
                            )}
                            {(apt.status === "pending" || apt.status === "confirmed") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAppointmentStatus(apt.id, "cancelled")}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
