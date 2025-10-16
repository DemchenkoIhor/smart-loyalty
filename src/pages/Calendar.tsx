import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns";
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
  clients: { full_name: string; phone: string; notes?: string };
  services: { name: string };
  employees: { display_name?: string; profiles: { full_name: string } };
}

interface Employee {
  id: string;
  display_name?: string;
  profiles: { full_name: string };
}

interface Client {
  id: string;
  full_name: string;
  phone: string;
}

interface Service {
  id: string;
  name: string;
}

const Calendar = () => {
  const navigate = useNavigate();
  const [currentWeek, setCurrentWeek] = useState<Date>(startOfWeek(new Date(), { locale: uk }));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [clientPhone, setClientPhone] = useState("");
  const [isNewClient, setIsNewClient] = useState(false);
  const [newClientData, setNewClientData] = useState({ full_name: "", email: "" });
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [clientNotes, setClientNotes] = useState("");
  const [newAppointment, setNewAppointment] = useState({
    employee_id: "",
    client_id: "",
    service_id: "",
    scheduled_date: "",
    scheduled_time: "",
    admin_notes: "",
  });

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  useEffect(() => {
    if (userId) {
      loadAppointments();
      if (userRole === "admin") {
        loadEmployees();
        loadClients();
        loadServices();
      }
    }
  }, [currentWeek, userId, userRole]);

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
    setLoading(true);
    try {
      const weekStart = currentWeek;
      const weekEnd = addDays(currentWeek, 7);

      let query = supabase
        .from("appointments")
        .select(`
          *,
          clients(full_name, phone, notes),
          services(name),
          employees(display_name, profiles(full_name))
        `)
        .gte("scheduled_at", weekStart.toISOString())
        .lt("scheduled_at", weekEnd.toISOString())
        .order("scheduled_at");

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

  const loadEmployees = async () => {
    const { data, error } = await supabase
      .from("employees")
      .select("id, display_name, profiles(full_name)")
      .eq("is_active", true);
    if (error) {
      console.error("Error loading employees:", error);
    } else {
      setEmployees(data || []);
    }
  };

  const loadClients = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("id, full_name, phone");
    if (error) {
      console.error("Error loading clients:", error);
    } else {
      setClients(data || []);
    }
  };

  const loadServices = async () => {
    const { data, error } = await supabase
      .from("services")
      .select("id, name");
    if (error) {
      console.error("Error loading services:", error);
    } else {
      setServices(data || []);
    }
  };

  const searchClientByPhone = async (phone: string) => {
    if (!phone || phone.length < 10) return;
    
    const { data, error } = await supabase
      .from("clients")
      .select("id, full_name, phone, email, notes")
      .eq("phone", phone)
      .maybeSingle();

    if (data) {
      setNewAppointment({ ...newAppointment, client_id: data.id });
      setIsNewClient(false);
      setClientNotes(data.notes || "");
    } else {
      setIsNewClient(true);
      setNewAppointment({ ...newAppointment, client_id: "" });
      setClientNotes("");
    }
  };

  const loadEmployeeServices = async (employeeId: string) => {
    if (!employeeId) {
      setFilteredServices([]);
      return;
    }

    const { data, error } = await supabase
      .from("employee_services")
      .select("service_id, services(id, name)")
      .eq("employee_id", employeeId)
      .eq("is_active", true);

    if (error) {
      console.error("Error loading employee services:", error);
      setFilteredServices([]);
    } else {
      const servicesData = data
        .filter(es => es.services)
        .map(es => es.services as unknown as Service);
      setFilteredServices(servicesData);
    }
  };

  const createAppointment = async () => {
    if (!newAppointment.employee_id || !newAppointment.service_id || !newAppointment.scheduled_date || !newAppointment.scheduled_time) {
      toast.error("Заповніть всі обов'язкові поля");
      return;
    }

    if (!clientPhone) {
      toast.error("Введіть номер телефону клієнта");
      return;
    }

    try {
      let clientId = newAppointment.client_id;

      // Створити нового клієнта якщо потрібно
      if (isNewClient) {
        if (!newClientData.full_name) {
          toast.error("Введіть ім'я клієнта");
          return;
        }

        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert({
            full_name: newClientData.full_name,
            phone: clientPhone,
            email: newClientData.email || null,
            notes: clientNotes || null,
          })
          .select()
          .single();

        if (clientError) throw clientError;
        clientId = newClient.id;
      } else if (clientNotes) {
        // Оновити нотатки існуючого клієнта
        await supabase
          .from("clients")
          .update({ notes: clientNotes })
          .eq("id", clientId);
      }

      const scheduledAt = new Date(`${newAppointment.scheduled_date}T${newAppointment.scheduled_time}`);
      
      const { data: empService } = await supabase
        .from("employee_services")
        .select("duration_minutes, price")
        .eq("employee_id", newAppointment.employee_id)
        .eq("service_id", newAppointment.service_id)
        .eq("is_active", true)
        .single();

      if (!empService) {
        toast.error("Майстер не надає цю послугу");
        return;
      }

      const { error } = await supabase
        .from("appointments")
        .insert({
          employee_id: newAppointment.employee_id,
          client_id: clientId,
          service_id: newAppointment.service_id,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: empService.duration_minutes,
          price: empService.price,
          admin_notes: newAppointment.admin_notes || null,
          status: "confirmed",
        });

      if (error) {
        if (error.message.includes("APPOINTMENT_TIME_CONFLICT")) {
          toast.error("Цей час вже зайнятий");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Запис створено");
      setIsCreateDialogOpen(false);
      setClientPhone("");
      setIsNewClient(false);
      setNewClientData({ full_name: "", email: "" });
      setClientNotes("");
      setNewAppointment({
        employee_id: "",
        client_id: "",
        service_id: "",
        scheduled_date: "",
        scheduled_time: "",
        admin_notes: "",
      });
      loadAppointments();
      loadClients();
    } catch (error) {
      console.error("Error creating appointment:", error);
      toast.error("Помилка створення запису");
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
      setIsDetailsDialogOpen(false);
      setSelectedAppointment(null);
      loadAppointments();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Помилка оновлення статусу");
    }
  };

  const updateClientNotes = async (clientId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from("clients")
        .update({ notes })
        .eq("id", clientId);

      if (error) throw error;
      toast.success("Коментар збережено");
      loadAppointments();
    } catch (error) {
      console.error("Error updating client notes:", error);
      toast.error("Помилка збереження коментаря");
    }
  };

  const updateEmployeeNotes = async (appointmentId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ employee_notes: notes })
        .eq("id", appointmentId);

      if (error) throw error;
      toast.success("Коментар майстра збережено");
      loadAppointments();
    } catch (error) {
      console.error("Error updating employee notes:", error);
      toast.error("Помилка збереження коментаря");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-success/20 text-success-foreground border-success";
      case "confirmed": return "bg-primary/20 text-primary border-primary";
      case "cancelled": return "bg-destructive/20 text-destructive-foreground border-destructive";
      default: return "bg-warning/20 text-warning-foreground border-warning";
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));
  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 - 20:00

  const getAppointmentsForSlot = (day: Date, hour: number) => {
    return appointments.filter(apt => {
      const aptDate = parseISO(apt.scheduled_at);
      return isSameDay(aptDate, day) && aptDate.getHours() === hour;
    });
  };

  return (
    <div className="min-h-screen gradient-subtle">
      <div className="border-b bg-card shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Календар записів</h1>
                <p className="text-sm text-muted-foreground">
                  {format(currentWeek, "d MMMM", { locale: uk })} - {format(addDays(currentWeek, 6), "d MMMM yyyy", { locale: uk })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentWeek(startOfWeek(new Date(), { locale: uk }))}>
                Сьогодні
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {userRole === "admin" && (
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Створити запис
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Створити новий запис</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <Label htmlFor="employee">Майстер *</Label>
                        <Select 
                          value={newAppointment.employee_id} 
                          onValueChange={(v) => {
                            setNewAppointment({...newAppointment, employee_id: v, service_id: ""});
                            loadEmployeeServices(v);
                          }}
                        >
                          <SelectTrigger id="employee">
                            <SelectValue placeholder="Оберіть майстра" />
                          </SelectTrigger>
                          <SelectContent>
                            {employees.map(emp => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.display_name || emp.profiles?.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="phone">Телефон клієнта *</Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+380..."
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          onBlur={(e) => searchClientByPhone(e.target.value)}
                        />
                      </div>
                      {isNewClient && (
                        <>
                          <div>
                            <Label htmlFor="client_name">Ім'я клієнта *</Label>
                            <Input
                              id="client_name"
                              value={newClientData.full_name}
                              onChange={(e) => setNewClientData({...newClientData, full_name: e.target.value})}
                              placeholder="Введіть ім'я"
                            />
                          </div>
                          <div>
                            <Label htmlFor="client_email">Email (опціонально)</Label>
                            <Input
                              id="client_email"
                              type="email"
                              value={newClientData.email}
                              onChange={(e) => setNewClientData({...newClientData, email: e.target.value})}
                              placeholder="email@example.com"
                            />
                          </div>
                        </>
                      )}
                      <div>
                        <Label htmlFor="client_notes">Коментар про клієнта</Label>
                        <Textarea
                          id="client_notes"
                          value={clientNotes}
                          onChange={(e) => setClientNotes(e.target.value)}
                          placeholder="Примітки про клієнта..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="service">Послуга *</Label>
                        <Select 
                          value={newAppointment.service_id} 
                          onValueChange={(v) => setNewAppointment({...newAppointment, service_id: v})}
                          disabled={!newAppointment.employee_id}
                        >
                          <SelectTrigger id="service">
                            <SelectValue placeholder={newAppointment.employee_id ? "Оберіть послугу" : "Спочатку оберіть майстра"} />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredServices.map(service => (
                              <SelectItem key={service.id} value={service.id}>
                                {service.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="date">Дата *</Label>
                          <Input
                            id="date"
                            type="date"
                            value={newAppointment.scheduled_date}
                            onChange={(e) => setNewAppointment({...newAppointment, scheduled_date: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="time">Час *</Label>
                          <Input
                            id="time"
                            type="time"
                            value={newAppointment.scheduled_time}
                            onChange={(e) => setNewAppointment({...newAppointment, scheduled_time: e.target.value})}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="notes">Нотатки адміна</Label>
                        <Textarea
                          id="notes"
                          value={newAppointment.admin_notes}
                          onChange={(e) => setNewAppointment({...newAppointment, admin_notes: e.target.value})}
                          placeholder="Додаткова інформація..."
                        />
                      </div>
                      <Button onClick={createAppointment} className="w-full">
                        Створити запис
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Завантаження...</p>
          </div>
        ) : (
          <div className="bg-card rounded-lg shadow-medium overflow-hidden">
            <div className="grid grid-cols-8 border-b">
              <div className="border-r p-2 text-sm font-medium text-muted-foreground bg-muted/50"></div>
              {weekDays.map((day, i) => (
                <div key={i} className="border-r last:border-r-0 p-2 text-center bg-muted/50">
                  <div className="text-xs text-muted-foreground">{format(day, "EEE", { locale: uk })}</div>
                  <div className="text-sm font-medium">{format(day, "d MMM", { locale: uk })}</div>
                </div>
              ))}
            </div>
            
            <div className="max-h-[600px] overflow-auto">
              {hours.map(hour => (
                <div key={hour} className="grid grid-cols-8 border-b last:border-b-0 min-h-[80px]">
                  <div className="border-r p-2 text-sm text-muted-foreground bg-muted/20 flex items-start justify-center sticky left-0">
                    {`${hour}:00`}
                  </div>
                  {weekDays.map((day, dayIndex) => {
                    const slotsAppts = getAppointmentsForSlot(day, hour);
                    return (
                      <div key={dayIndex} className="border-r last:border-r-0 p-1 hover:bg-accent/5 transition-colors">
                        <div className="space-y-1">
                          {slotsAppts.map(apt => (
                            <div
                              key={apt.id}
                              className={`text-xs p-2 rounded border cursor-pointer hover:shadow-soft transition-shadow ${getStatusColor(apt.status)}`}
                              onClick={() => {
                                setSelectedAppointment(apt);
                                setIsDetailsDialogOpen(true);
                              }}
                            >
                              <div className="font-medium truncate">{apt.clients.full_name}</div>
                              <div className="truncate text-[10px] opacity-75">{apt.services.name}</div>
                              <div className="text-[10px] opacity-75">{apt.duration_minutes} хв</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Деталі запису</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4 pt-4">
              <div>
                <p className="text-sm text-muted-foreground">Клієнт</p>
                <p className="font-medium">{selectedAppointment.clients.full_name}</p>
                <p className="text-sm text-muted-foreground">{selectedAppointment.clients.phone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Майстер</p>
                <p className="font-medium">{selectedAppointment.employees.display_name || selectedAppointment.employees.profiles?.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Послуга</p>
                <p className="font-medium">{selectedAppointment.services.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Час</p>
                <p className="font-medium">
                  {format(parseISO(selectedAppointment.scheduled_at), "d MMMM yyyy, HH:mm", { locale: uk })} ({selectedAppointment.duration_minutes} хв)
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ціна</p>
                <p className="font-medium">{selectedAppointment.price} грн</p>
              </div>
              {selectedAppointment.admin_notes && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded">
                  <p className="text-sm text-muted-foreground mb-1">Коментар до запису (адміністратор)</p>
                  <p className="text-sm">{selectedAppointment.admin_notes}</p>
                </div>
              )}
              <div>
                <Label htmlFor="client_notes">Коментар про клієнта</Label>
                <Textarea
                  id="client_notes"
                  defaultValue={selectedAppointment.clients.notes || ""}
                  onBlur={(e) => updateClientNotes(selectedAppointment.client_id, e.target.value)}
                  placeholder="Примітки про клієнта (доступні всім майстрам)..."
                  disabled={userRole !== "admin" && userRole !== "employee"}
                />
              </div>
              <div>
                <Label htmlFor="employee_notes">Коментар майстра до запису</Label>
                <Textarea
                  id="employee_notes"
                  defaultValue={selectedAppointment.employee_notes || ""}
                  onBlur={(e) => updateEmployeeNotes(selectedAppointment.id, e.target.value)}
                  placeholder="Додати коментар до цього запису..."
                  disabled={userRole !== "admin" && userRole !== "employee"}
                />
              </div>
              <div className="flex gap-2">
                {selectedAppointment.status !== "completed" && (
                  <Button
                    onClick={() => updateAppointmentStatus(selectedAppointment.id, "completed")}
                    className="flex-1"
                    variant="default"
                  >
                    Візит відбувся
                  </Button>
                )}
                {selectedAppointment.status !== "cancelled" && (
                  <Button
                    onClick={() => updateAppointmentStatus(selectedAppointment.id, "cancelled")}
                    className="flex-1"
                    variant="destructive"
                  >
                    Скасувати
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Calendar;
