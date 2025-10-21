import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Calendar, Clock, User, MapPin, DollarSign, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

interface AppointmentData {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  price: number;
  status: string;
  employee_notes: string | null;
  client: {
    full_name: string;
    phone: string;
    email: string | null;
  };
  employee: {
    display_name: string;
  };
  service: {
    name: string;
    description: string | null;
  };
}

const AppointmentView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState<AppointmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (id) {
      loadAppointment();
    }
  }, [id]);

  const loadAppointment = async () => {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          scheduled_at,
          duration_minutes,
          price,
          status,
          employee_notes,
          client:clients(full_name, phone, email),
          employee:employees(display_name),
          service:services(name, description)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;

      setAppointment(data as any);
    } catch (error: any) {
      console.error("Error loading appointment:", error);
      toast.error("Не вдалося завантажити запис");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!appointment) return;

    setCancelling(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("id", appointment.id);

      if (error) throw error;

      toast.success("Запис успішно скасовано");
      setAppointment({ ...appointment, status: "cancelled" });
    } catch (error: any) {
      console.error("Error cancelling appointment:", error);
      toast.error("Не вдалося скасувати запис");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Завантаження...</p>
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen gradient-subtle flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Запис не знайдено
            </CardTitle>
            <CardDescription>
              Можливо, запис було видалено або посилання застаріле
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              На головну
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const scheduledDate = new Date(appointment.scheduled_at);
  const isCancelled = appointment.status === "cancelled";
  const isCompleted = appointment.status === "completed";
  const isPending = appointment.status === "pending";

  return (
    <div className="min-h-screen gradient-subtle py-12 px-4">
      <div className="container mx-auto max-w-2xl">
        <Card className="shadow-strong animate-scale-in">
          <CardHeader>
            <CardTitle className="text-3xl text-center">
              {isCancelled ? "Скасований запис" : isCompleted ? "Завершений запис" : "Ваш запис"}
            </CardTitle>
            <CardDescription className="text-center">
              {isCancelled ? (
                <span className="text-destructive font-medium">Цей запис було скасовано</span>
              ) : isCompleted ? (
                <span className="text-success font-medium">Ваш візит завершено</span>
              ) : (
                "Деталі вашого запису"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Service Info */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Послуга</h3>
              <Card>
                <CardContent className="p-4">
                  <p className="font-medium text-lg">{appointment.service.name}</p>
                  {appointment.service.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {appointment.service.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Employee Info */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Майстер</h3>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <User className="h-5 w-5 text-primary" />
                  <span>{appointment.employee.display_name}</span>
                </CardContent>
              </Card>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Дата</h3>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    <span>{format(scheduledDate, "d MMMM yyyy", { locale: uk })}</span>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Час</h3>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Clock className="h-5 w-5 text-primary" />
                    <span>{format(scheduledDate, "HH:mm")}</span>
                    <span className="text-muted-foreground">
                      ({appointment.duration_minutes} хв)
                    </span>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Price */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Вартість</h3>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="text-lg font-bold">{appointment.price} ₴</span>
                </CardContent>
              </Card>
            </div>

            {/* Client Info */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Контактні дані</h3>
              <Card>
                <CardContent className="p-4 space-y-2">
                  <p><span className="font-medium">Ім'я:</span> {appointment.client.full_name}</p>
                  <p><span className="font-medium">Телефон:</span> {appointment.client.phone}</p>
                  {appointment.client.email && (
                    <p><span className="font-medium">Email:</span> {appointment.client.email}</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Notes */}
            {appointment.employee_notes && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Нотатки майстра</h3>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-muted-foreground">{appointment.employee_notes}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="flex-1"
              >
                На головну
              </Button>
              {isPending && (
                <Button
                  variant="destructive"
                  onClick={handleCancelAppointment}
                  disabled={cancelling}
                  className="flex-1"
                >
                  {cancelling ? "Скасування..." : "Скасувати запис"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AppointmentView;
