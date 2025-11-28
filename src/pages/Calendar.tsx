import { useEffect, useState, useRef } from "react";
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
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO, startOfDay } from "date-fns";
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
  const [currentStartDate, setCurrentStartDate] = useState<Date>(new Date());
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const [visibleDays, setVisibleDays] = useState(7);
  const [slotHeights, setSlotHeights] = useState<Record<number, number>>({});

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
  }, [currentStartDate, visibleDays, userId, userRole]);

  const getAppointmentsForDay = (day: Date) => {
    return appointments.filter(apt => {
      const aptDate = parseISO(apt.scheduled_at);
      return isSameDay(aptDate, day);
    });
  };

  const getAppointmentPosition = (scheduledAt: string, durationMinutes: number, hourlySlotHeights: Record<number, number>) => {
    const aptDate = new Date(scheduledAt);
    const hours = aptDate.getHours();
    const minutes = aptDate.getMinutes();
    
    const startHour = 8;
    
    // Calculate top by summing all slot heights before this appointment
    let top = 0;
    for (let h = startHour; h < hours; h++) {
      top += hourlySlotHeights[h] || 80;
    }
    top += (minutes / 60) * (hourlySlotHeights[hours] || 80);
    
    // Calculate height spanning multiple slots if needed
    const endHour = Math.floor(hours + (minutes + durationMinutes) / 60);
    const endMinutes = (minutes + durationMinutes) % 60;
    
    let height = 0;
    for (let h = hours; h <= endHour; h++) {
      const slotH = hourlySlotHeights[h] || 80;
      if (h === hours) {
        // First slot: from current minutes to end of hour
        const remainingMinutes = h === endHour ? endMinutes : 60 - minutes;
        height += (remainingMinutes / 60) * slotH;
      } else if (h === endHour) {
        // Last slot: from start of hour to end minutes
        height += (endMinutes / 60) * slotH;
      } else {
        // Full slot
        height += slotH;
      }
    }
    
    return { top, height };
  };

  // Compute non-overlapping columns per day cluster for side-by-side layout
  const computeDayLayout = (dayAppointments: Appointment[]) => {
    type Evt = { id: string; start: number; end: number };
    const startHour = 8;
    const toMinutesFromStart = (iso: string) => {
      const d = parseISO(iso);
      return (d.getHours() - startHour) * 60 + d.getMinutes();
    };
    const events: Evt[] = dayAppointments
      .map(a => ({ id: a.id, start: toMinutesFromStart(a.scheduled_at), end: toMinutesFromStart(a.scheduled_at) + a.duration_minutes }))
      .sort((a, b) => a.start - b.start || a.end - b.end);

    const indexById: Record<string, number> = {};
    const sizeById: Record<string, number> = {};

    let active: { id: string; end: number; col: number }[] = [];
    let clusterIds: string[] = [];
    let clusterMax = 0;

    const finalizeCluster = () => {
      clusterIds.forEach(id => { sizeById[id] = Math.max(1, clusterMax); });
      clusterIds = [];
      clusterMax = 0;
    };

    for (let i = 0; i < events.length; i++) {
      const evt = events[i];
      // Drop finished events
      active = active.filter(a => a.end > evt.start);
      const used = new Set(active.map(a => a.col));
      let col = 0; while (used.has(col)) col++;
      active.push({ id: evt.id, end: evt.end, col });
      indexById[evt.id] = col;
      clusterIds.push(evt.id);
      clusterMax = Math.max(clusterMax, active.length);

      const next = events[i + 1];
      const latestEnd = Math.max(...active.map(a => a.end));
      if (!next || next.start >= latestEnd) {
        finalizeCluster();
        active = [];
      }
    }

    return { indexById, sizeById };
  };

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
      const start = startOfDay(currentStartDate);
      const end = startOfDay(addDays(currentStartDate, visibleDays));

      let query = supabase
        .from("appointments")
        .select(`
          *,
          clients(full_name, phone, notes),
          services(name),
          employees(display_name, profiles(full_name))
        `)
        .gte("scheduled_at", start.toISOString())
        .lt("scheduled_at", end.toISOString())
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
    if (!phone || phone.length < 9) return;
    
    // Нормалізуємо номер: прибираємо все крім цифр
    const normalizedPhone = phone.replace(/\D/g, '');
    
    // Пошук за різними форматами
    const { data, error } = await supabase
      .from("clients")
      .select("id, full_name, phone, email, notes")
      .or(`phone.ilike.%${normalizedPhone},phone.ilike.+${normalizedPhone},phone.ilike.%${normalizedPhone.slice(-10)}`)
      .limit(1)
      .maybeSingle();

    if (data) {
      setNewAppointment(prev => ({ ...prev, client_id: data.id }));
      setIsNewClient(false);
      setClientNotes(data.notes || "");
      // Заповнюємо дані клієнта з БД
      setNewClientData({ 
        full_name: data.full_name || "", 
        email: data.email || "" 
      });
    } else {
      setIsNewClient(true);
      setNewAppointment(prev => ({ ...prev, client_id: "" }));
      setClientNotes("");
      // Очищаємо дані для нового клієнта
      setNewClientData({ full_name: "", email: "" });
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
      toast.success("Коментар для майстра збережено");
      loadAppointments();
    } catch (error) {
      console.error("Error updating employee notes:", error);
      toast.error("Помилка збереження коментаря");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-success/20 border-success";
      case "confirmed": return "bg-primary/20 border-primary";
      case "cancelled": return "bg-destructive/20 border-destructive";
      default: return "bg-warning/20 border-warning";
    }
  };

  const getEmployeeColor = (employeeId: string) => {
    const colors = [
      "bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-600",
      "bg-purple-100 dark:bg-purple-900/40 border-purple-400 dark:border-purple-600",
      "bg-green-100 dark:bg-green-900/40 border-green-400 dark:border-green-600",
      "bg-orange-100 dark:bg-orange-900/40 border-orange-400 dark:border-orange-600",
      "bg-pink-100 dark:bg-pink-900/40 border-pink-400 dark:border-pink-600",
      "bg-teal-100 dark:bg-teal-900/40 border-teal-400 dark:border-teal-600",
      "bg-indigo-100 dark:bg-indigo-900/40 border-indigo-400 dark:border-indigo-600",
      "bg-rose-100 dark:bg-rose-900/40 border-rose-400 dark:border-rose-600",
    ];
    const hash = employeeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Start from current day and show only forward days
  const weekDays = Array.from({ length: visibleDays }, (_, i) => addDays(currentStartDate, i));
  const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 - 20:00

  // Calculate optimal number of visible days and slot heights
  useEffect(() => {
    const updateLayout = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.offsetWidth - 48;
      // Базова мінімальна ширина картки = довжині найдовшого імені працівника в один рядок
      const longestNameChars = employees.reduce((max, e) => Math.max(max, (e.display_name || e.profiles?.full_name || "").length), 0);
      const approxCharPx = 7; // приблизна ширина символу для маленького шрифту
      const paddingPx = 24; // горизонтальні відступи
      const minCardWidth = Math.max(160, Math.min(360, longestNameChars * approxCharPx + paddingPx));
      const timeColumnWidth = 80;
      
      const availableWidth = containerWidth - timeColumnWidth;

      // Враховуємо максимально можливу кількість одночасних записів СЬОГОДНІ
      const todayAppointments = appointments.filter(apt => isSameDay(parseISO(apt.scheduled_at), currentStartDate));
      let maxColsToday = 1;
      if (todayAppointments.length > 0) {
        const { sizeById } = computeDayLayout(todayAppointments);
        maxColsToday = Math.max(...Object.values(sizeById), 1);
      }

      const requiredDayWidth = minCardWidth * maxColsToday; // щоб кожна картка >= ширині імені працівника
      const maxDays = Math.max(1, Math.min(7, Math.floor(availableWidth / requiredDayWidth)));
      setVisibleDays(maxDays);

      // Calculate slot heights based on content requirements
      const newSlotHeights: Record<number, number> = {};
      hours.forEach(hour => {
        let maxRequiredHeight = 80; // Base height
        
        weekDays.forEach(day => {
          const dayAppointments = appointments.filter(apt => {
            const aptDate = parseISO(apt.scheduled_at);
            const aptHour = aptDate.getHours();
            const aptEndMinutes = aptDate.getMinutes() + apt.duration_minutes;
            const aptEndHour = Math.floor(aptEndMinutes / 60) + aptHour;
            
            // Check if appointment overlaps with this hour slot
            return isSameDay(aptDate, day) && 
                   ((aptHour === hour) || (aptHour < hour && aptEndHour > hour));
          });
          
          if (dayAppointments.length > 0) {
            const { sizeById } = computeDayLayout(dayAppointments);
            const maxCols = Math.max(...Object.values(sizeById), 1);
            
            // Calculate required height based on content:
            // Name (10px) + Employee (9px) + Service (9px) + Time (8px) + padding (4px) = ~40px minimum
            // If notes exist: + separator (1px) + padding (1px) + 2-3 lines of notes (~24px) = ~66px
            // Base: 90px for 1 column, 110px for 2-3 columns, 130px for 4+ columns
            let requiredHeight = 90;
            if (maxCols >= 4) {
              requiredHeight = 130;
            } else if (maxCols >= 2) {
              requiredHeight = 110;
            }
            
            maxRequiredHeight = Math.max(maxRequiredHeight, requiredHeight);
          }
        });
        
        newSlotHeights[hour] = maxRequiredHeight;
      });
      setSlotHeights(newSlotHeights);
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, [appointments, weekDays.length, employees, currentStartDate]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      const sbw = el.offsetWidth - el.clientWidth;
      setScrollbarWidth(sbw > 0 ? sbw : 0);
    };

    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    window.addEventListener('resize', update);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [appointments]);

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
                  {format(currentStartDate, "d MMMM", { locale: uk })} - {format(addDays(currentStartDate, Math.max(visibleDays - 1, 0)), "d MMMM yyyy", { locale: uk })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentStartDate(addDays(currentStartDate, -visibleDays))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentStartDate(new Date())}>
                Сьогодні
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentStartDate(addDays(currentStartDate, visibleDays))}>
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
                          onChange={(e) => {
                            setClientPhone(e.target.value);
                            // Автопошук при введенні достатньої кількості цифр
                            if (e.target.value.replace(/\D/g, '').length >= 10) {
                              searchClientByPhone(e.target.value);
                            }
                          }}
                          onBlur={(e) => searchClientByPhone(e.target.value)}
                        />
                        {!isNewClient && newAppointment.client_id && (
                          <p className="text-xs text-success mt-1">✓ Клієнт знайдений в базі</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="client_name">Ім'я клієнта {isNewClient && "*"}</Label>
                        <Input
                          id="client_name"
                          value={newClientData.full_name}
                          onChange={(e) => isNewClient && setNewClientData({...newClientData, full_name: e.target.value})}
                          placeholder={isNewClient ? "Введіть ім'я" : ""}
                          disabled={!isNewClient && !!newAppointment.client_id}
                          className={!isNewClient && newAppointment.client_id ? "bg-muted" : ""}
                        />
                      </div>
                      <div>
                        <Label htmlFor="client_email">Email (опціонально)</Label>
                        <Input
                          id="client_email"
                          type="email"
                          value={newClientData.email}
                          onChange={(e) => isNewClient && setNewClientData({...newClientData, email: e.target.value})}
                          placeholder={isNewClient ? "email@example.com" : ""}
                          disabled={!isNewClient && !!newAppointment.client_id}
                          className={!isNewClient && newAppointment.client_id ? "bg-muted" : ""}
                        />
                      </div>
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
                        <Label htmlFor="notes">Коментар для майстра</Label>
                        <Textarea
                          id="notes"
                          value={newAppointment.admin_notes}
                          onChange={(e) => setNewAppointment({...newAppointment, admin_notes: e.target.value})}
                          placeholder="Побажання клієнта, деталі запису тощо..."
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

      <div ref={containerRef} className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Завантаження...</p>
          </div>
        ) : (
          <div className="bg-card rounded-lg shadow-medium overflow-hidden">
            <div 
              className="grid border-b" 
              style={{ 
                gridTemplateColumns: `80px repeat(${visibleDays}, 1fr)`,
                paddingRight: `${scrollbarWidth}px` 
              }}
            >
              <div className="border-r p-2 text-sm font-medium text-muted-foreground bg-muted/50"></div>
              {weekDays.map((day, i) => (
                <div key={i} className="border-r last:border-r-0 p-2 text-center bg-muted/50">
                  <div className="text-xs text-muted-foreground">{format(day, "EEE", { locale: uk })}</div>
                  <div className="text-sm font-medium">{format(day, "d MMM", { locale: uk })}</div>
                </div>
              ))}
            </div>
            
            <div ref={scrollRef} className="max-h-[600px] overflow-auto">
              <div className="relative" style={{ height: `${Object.values(slotHeights).reduce((sum, h) => sum + h, hours.length * 80)}px` }}>
                {/* Background grid (hours and vertical day separators) */}
                <div className="absolute inset-0">
                  {hours.map((hour, hourIdx) => {
                    const slotHeight = slotHeights[hour] || 80;
                    let topOffset = 0;
                    for (let i = 0; i < hourIdx; i++) {
                      topOffset += slotHeights[hours[i]] || 80;
                    }
                    
                    return (
                      <div 
                        key={hour} 
                        className="grid border-b last:border-b-0" 
                        style={{ 
                          gridTemplateColumns: `80px repeat(${visibleDays}, 1fr)`,
                          height: `${slotHeight}px`,
                          position: 'absolute',
                          top: `${topOffset}px`,
                          left: 0,
                          right: 0
                        }}
                      >
                        <div className="border-r p-2 text-sm text-muted-foreground bg-muted/20 flex items-start justify-center">
                          {`${hour}:00`}
                        </div>
                        {weekDays.map((_, idx) => (
                          <div key={idx} className="border-r last:border-r-0" />
                        ))}
                      </div>
                    );
                  })}
                </div>

                {/* Appointments overlay */}
                <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: `80px repeat(${visibleDays}, 1fr)` }}>
                  <div />
                  {weekDays.map((day, dayIndex) => {
                    const dayAppointments = getAppointmentsForDay(day);
                    const { indexById, sizeById } = computeDayLayout(dayAppointments);
                    return (
                      <div key={dayIndex} className="relative">
                        {dayAppointments.map(apt => {
                          const { top, height } = getAppointmentPosition(apt.scheduled_at, apt.duration_minutes, slotHeights);
                          const cols = sizeById[apt.id] || 1;
                          const colIndex = indexById[apt.id] || 0;
                          const widthPercent = 100 / cols;
                          const leftPercent = widthPercent * colIndex;

                          const employeeName = apt.employees.display_name || apt.employees.profiles?.full_name || "Майстер";
                          
                          return (
                            <div
                              key={apt.id}
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                                left: `${leftPercent}%`,
                                width: `${widthPercent}%`,
                                padding: '2px'
                              }}
                              className="absolute pointer-events-auto"
                            >
                              <div 
                                className={`h-full rounded border-2 cursor-pointer hover:shadow-medium hover:scale-[1.02] transition-all overflow-hidden ${getEmployeeColor(apt.employee_id)}`}
                                onClick={() => {
                                  setSelectedAppointment(apt);
                                  setIsDetailsDialogOpen(true);
                                }}
                              >
                                <div className="p-1 h-full flex flex-col text-foreground overflow-hidden">
                                  <div className="font-semibold text-[10px] leading-tight">{apt.clients.full_name}</div>
                                  <div className="text-[9px] font-medium opacity-90">{employeeName}</div>
                                  <div className="text-[9px] opacity-80">{apt.services.name}</div>
                                  <div className="text-[8px] opacity-70">{format(parseISO(apt.scheduled_at), "HH:mm")} • {apt.duration_minutes} хв</div>
                                  {apt.clients.notes && height > 40 && (
                                    <div className="mt-0.5 pt-0.5 border-t border-foreground/20 flex-1 overflow-hidden">
                                      <div className="text-[8px] opacity-75 line-clamp-3">{apt.clients.notes}</div>
                                    </div>
                                  )}
                                  {apt.admin_notes && height > 65 && (
                                    <div className="mt-0.5 pt-0.5 border-t border-foreground/20">
                                      <div className="text-[8px] opacity-75 italic line-clamp-2">Адмін: {apt.admin_notes}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
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
                  <p className="text-sm text-muted-foreground mb-1">Коментар для майстра</p>
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
                <Label htmlFor="employee_notes">Коментар для майстра</Label>
                <Textarea
                  id="employee_notes"
                  defaultValue={selectedAppointment.employee_notes || ""}
                  onBlur={(e) => updateEmployeeNotes(selectedAppointment.id, e.target.value)}
                  placeholder="Додати коментар..."
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
