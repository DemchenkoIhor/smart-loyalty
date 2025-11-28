import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Calendar, Clock, User, ArrowLeft, MessageSquare, Mail } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

interface Employee {
  id: string;
  user_id: string;
  bio: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
}

interface EmployeeService {
  id: string;
  employee_id: string;
  service_id: string;
  price: number;
  duration_minutes: number;
  services: Service;
}

const normalizePhone = (input: string) => {
  const digits = (input || '').replace(/\D/g, '');
  return digits ? `+${digits}` : '';
};

const Booking = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeServices, setEmployeeServices] = useState<EmployeeService[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [telegramConnecting, setTelegramConnecting] = useState(false);
  const [telegramCheckInterval, setTelegramCheckInterval] = useState<number | null>(null);

  const [busySlots, setBusySlots] = useState<{ start_at: string; end_at: string }[]>([]);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [daysOff, setDaysOff] = useState<string[]>([]);
  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      loadEmployeeServices(selectedEmployee);
      loadDaysOff(selectedEmployee);
    }
  }, [selectedEmployee]);

  const loadDaysOff = async (employeeId: string) => {
    const { data, error } = await supabase
      .from("employee_days_off")
      .select("date_off")
      .eq("employee_id", employeeId)
      .gte("date_off", format(new Date(), "yyyy-MM-dd"));
    
    if (!error && data) {
      setDaysOff(data.map(d => d.date_off));
    }
  };

  const loadEmployees = async () => {
    const { data, error } = await supabase
      .from("employees")
      .select("id, user_id, bio, display_name, avatar_url")
      .eq("is_active", true);

    if (error) {
      console.error("Error loading employees:", error);
      toast.error("Помилка завантаження працівників");
      return;
    }

    setEmployees(
      (data || []).map((e) => ({
        id: e.id,
        user_id: e.user_id,
        bio: e.bio,
        display_name: e.display_name ?? "Майстер",
        avatar_url: e.avatar_url ?? null,
      }))
    );
  };

  const loadEmployeeServices = async (employeeId: string) => {
    const { data, error } = await supabase
      .from("employee_services")
      .select("id, employee_id, service_id, price, duration_minutes, services(id, name, description)")
      .eq("employee_id", employeeId)
      .eq("is_active", true);

    if (error) {
      toast.error("Помилка завантаження послуг");
      return;
    }

    setEmployeeServices(data || []);
  };

  const generateTimeSlots = () => {
    const slots: string[] = [];
    for (let hour = 9; hour <= 19; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        slots.push(time);
      }
    }
    return slots;
  };

  const overlaps = (startA: Date, endA: Date, startB: Date, endB: Date) => {
    return !(endA <= startB || startA >= endB);
  };

  const computeAvailableTimes = (dayStr: string, durationMinutes: number, busy: { start_at: string; end_at: string }[]) => {
    const all = generateTimeSlots();
    const available: string[] = [];
    for (const t of all) {
      const start = new Date(`${dayStr}T${t}:00`);
      const end = new Date(start.getTime() + durationMinutes * 60000);
      let conflict = false;
      for (const b of busy) {
        const bStart = new Date(b.start_at);
        const bEnd = new Date(b.end_at);
        if (overlaps(start, end, bStart, bEnd)) {
          conflict = true;
          break;
        }
      }
      if (!conflict) available.push(t);
    }
    return available;
  };

  useEffect(() => {
    const load = async () => {
      if (!selectedEmployee || !selectedDate || !selectedService) {
        setAvailableTimes([]);
        setBusySlots([]);
        return;
      }
      try {
        const { data: busy, error } = await supabase.rpc("get_employee_busy_slots", {
          emp_id: selectedEmployee,
          day: selectedDate,
        });
        if (error) throw error;
        setBusySlots(busy || []);
        const svc = employeeServices.find((es) => es.id === selectedService);
        const duration = svc?.duration_minutes ?? 30;
        setAvailableTimes(computeAvailableTimes(selectedDate, duration, busy || []));
      } catch (e) {
        console.error("Error loading busy slots", e);
        setAvailableTimes(generateTimeSlots());
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployee, selectedDate, selectedService, employeeServices]);

  const openTelegramBot = async () => {
    const botUsername = 'demchenko_tr43_bot';
    const normalized = normalizePhone(clientPhone);
    if (!normalized) {
      toast.error("Введіть коректний номер телефону");
      return;
    }

    // Гарантуємо, що клієнт існує в БД до відкриття Telegram (щоб вебхук міг його знайти)
    try {
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('phone', normalized)
        .maybeSingle();

      if (!existing) {
        const { error: insertErr } = await supabase
          .from('clients')
          .insert({
            full_name: clientName || 'Клієнт',
            phone: normalized,
            email: clientEmail || null,
          });
        if (insertErr) {
          console.error('Error creating client before Telegram:', insertErr);
          toast.error('Не вдалося підготувати дані клієнта');
          return;
        }
      }
    } catch (e) {
      console.error('Pre-create client error:', e);
      toast.error('Сталася помилка при підготовці даних');
      return;
    }

    const payload = `phone_${normalized.replace(/^\+/, '')}`;
    const deepLink = `https://t.me/${botUsername}?start=${payload}`;
    
    window.open(deepLink, '_blank');
    setTelegramConnecting(true);
    
    // Починаємо перевірку telegram_chat_id кожні 3 секунди
    const interval = window.setInterval(async () => {
      const { data } = await supabase
        .from('clients')
        .select('telegram_chat_id')
        .eq('phone', normalized)
        .maybeSingle();
      
      if (data?.telegram_chat_id) {
        clearInterval(interval);
        setTelegramCheckInterval(null);
        toast.success('✅ Telegram успішно підключено!');
        setTelegramConnecting(false);
        // Автоматично переходимо до підтвердження
        setTimeout(() => handleSubmit(), 500);
      }
    }, 3000);
    
    setTelegramCheckInterval(interval);
    
    // Автоматично зупиняємо після 30 секунд
    setTimeout(() => {
      if (interval) {
        clearInterval(interval);
        setTelegramCheckInterval(null);
        setTelegramConnecting(false);
      }
    }, 30000);
  };

  const skipTelegramAndComplete = async () => {
    // Перевірка наявності email
    if (!clientEmail || !clientEmail.includes('@')) {
      toast.error("Для відправки на Email потрібно вказати коректну адресу електронної пошти");
      return;
    }

    if (telegramCheckInterval) {
      clearInterval(telegramCheckInterval);
      setTelegramCheckInterval(null);
    }
    setTelegramConnecting(false);
    
    // Відразу створюємо запис і надсилаємо на email
    await handleSubmit();
  };

  const handleSubmit = async () => {
    const normalizedPhone = normalizePhone(clientPhone);
    if (!selectedEmployee || !selectedService || !selectedDate || !selectedTime || !clientName || !normalizedPhone) {
      toast.error("Заповніть всі обов'язкові поля");
      return;
    }

    setLoading(true);

    try {
      // Create or find client
      let clientId;
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("phone", normalizedPhone)
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert({
            full_name: clientName,
            phone: normalizedPhone,
            email: clientEmail || null,
          })
          .select()
          .single();

        if (clientError) throw clientError;
        clientId = newClient.id;
      }

      // Get service details
      const selectedServiceData = employeeServices.find(es => es.id === selectedService);
      if (!selectedServiceData) throw new Error("Послуга не знайдена");

      // Create appointment
      const scheduledAt = new Date(`${selectedDate}T${selectedTime}:00`);
      
      const { error: appointmentError } = await supabase
        .from("appointments")
        .insert({
          client_id: clientId,
          employee_id: selectedEmployee,
          service_id: selectedServiceData.service_id,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: selectedServiceData.duration_minutes,
          price: selectedServiceData.price,
          status: "pending",
        });

      if (appointmentError) throw appointmentError;

      // Повідомлення надсилаються автоматично через тригер БД
      toast.success("Запис успішно створено!");
      navigate("/");
    } catch (error: any) {
      const msg = (error?.message || "").toString();
      if (msg.includes("APPOINTMENT_TIME_CONFLICT")) {
        toast.error("Цей час уже зайнятий. Оберіть інший слот.");
      } else {
        toast.error(error.message || "Помилка створення запису");
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedServiceData = employeeServices.find(es => es.id === selectedService);
  const selectedEmployeeData = employees.find(e => e.id === selectedEmployee);

  return (
    <div className="min-h-screen gradient-subtle py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => step === 1 ? navigate("/") : setStep(step - 1)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {step === 1 ? "На головну" : "Назад"}
        </Button>

        <Card className="shadow-strong animate-scale-in">
          <CardHeader>
            <CardTitle className="text-3xl text-center">Онлайн запис</CardTitle>
            <CardDescription className="text-center">
              Крок {step} з 5
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <Label className="text-lg">Оберіть майстра</Label>
                <div className="grid gap-4">
                  {employees.map((employee) => (
                    <Card
                      key={employee.id}
                      className={`cursor-pointer transition-all hover:shadow-medium ${
                        selectedEmployee === employee.id ? "ring-2 ring-primary shadow-glow" : ""
                      }`}
                      onClick={() => {
                        setSelectedEmployee(employee.id);
                        setSelectedService("");
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center text-white font-bold text-xl">
                            {employee.display_name?.charAt(0) || "M"}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-lg mb-1">{employee.display_name}</h4>
                            {employee.bio && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                                {employee.bio}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-primary">
                              <User className="h-3 w-3" />
                              Професійний майстер
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Button
                  className="w-full gradient-primary shadow-medium"
                  disabled={!selectedEmployee}
                  onClick={() => setStep(2)}
                >
                  Далі
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <Label className="text-lg">Оберіть послугу</Label>
                <div className="grid gap-4">
                  {employeeServices.map((es) => (
                    <Card
                      key={es.id}
                      className={`cursor-pointer transition-all hover:shadow-medium ${
                        selectedService === es.id ? "ring-2 ring-primary shadow-glow" : ""
                      }`}
                      onClick={() => setSelectedService(es.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">{es.services.name}</h4>
                            {es.services.description && (
                              <p className="text-sm text-muted-foreground mt-1">{es.services.description}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">{es.price} ₴</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              {es.duration_minutes} хв
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Button
                  className="w-full gradient-primary shadow-medium"
                  disabled={!selectedService}
                  onClick={() => setStep(3)}
                >
                  Далі
                </Button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-lg">Оберіть дату</Label>
                  <Input
                    id="date"
                    type="date"
                    min={format(new Date(), "yyyy-MM-dd")}
                    value={selectedDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (daysOff.includes(val)) {
                        toast.error("Майстер не працює в цей день");
                        return;
                      }
                      setSelectedDate(val);
                    }}
                  />
                  {daysOff.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Недоступні дати: {daysOff.slice(0, 5).map(d => format(new Date(d), "d.MM")).join(", ")}
                      {daysOff.length > 5 && ` та ще ${daysOff.length - 5}`}
                    </p>
                  )}
                </div>

                {selectedDate && (
                  <div className="space-y-2">
                    <Label className="text-lg">Оберіть час</Label>
                    {availableTimes.length > 0 ? (
                      <div className="grid grid-cols-4 gap-2">
                        {availableTimes.map((time) => (
                          <Button
                            key={time}
                            variant={selectedTime === time ? "default" : "outline"}
                            className={selectedTime === time ? "shadow-glow" : ""}
                            onClick={() => setSelectedTime(time)}
                          >
                            {time}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Немає доступних часових слотів для цієї дати.</p>
                    )}
                  </div>
                )}

                <Button
                  className="w-full gradient-primary shadow-medium"
                  disabled={!selectedDate || !selectedTime}
                  onClick={() => setStep(4)}
                >
                  Далі
                </Button>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
                  <h4 className="font-semibold">Ваш запис:</h4>
                  <p className="text-sm">Майстер: {selectedEmployeeData?.display_name}</p>
                  <p className="text-sm">Послуга: {selectedServiceData?.services.name}</p>
                  <p className="text-sm">
                    Дата: {format(new Date(selectedDate), "d MMMM yyyy", { locale: uk })}
                  </p>
                  <p className="text-sm">Час: {selectedTime}</p>
                  <p className="text-sm font-bold">Вартість: {selectedServiceData?.price} ₴</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Ваше ім'я *</Label>
                    <Input
                      id="name"
                      placeholder="Іван Петренко"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Телефон *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+380123456789"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email (опціонально)</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  className="w-full gradient-primary shadow-medium"
                  onClick={() => setStep(5)}
                >
                  Далі
                </Button>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <div className="text-center space-y-4">
                  <MessageSquare className="w-16 h-16 mx-auto text-primary" />
                  <h3 className="text-xl font-semibold">Отримуйте повідомлення в Telegram</h3>
                  <p className="text-muted-foreground">
                    Натисніть кнопку нижче щоб активувати швидкі повідомлення в Telegram.
                    Це дозволить вам отримувати миттєві нагадування про записи!
                  </p>
                  
                  {telegramConnecting ? (
                    <div className="space-y-4">
                      <div className="animate-pulse">
                        <div className="h-2 bg-primary/20 rounded-full w-full mb-2"></div>
                        <p className="text-sm text-muted-foreground">
                          Очікуємо підключення... Натисніть "Start" у боті Telegram
                        </p>
                      </div>
                      <Button 
                        variant="ghost"
                        onClick={skipTelegramAndComplete}
                      >
                        Пропустити
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button 
                        className="gradient-primary"
                        onClick={openTelegramBot}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Підключити Telegram
                      </Button>
                      
                      <Button 
                        variant="ghost"
                        onClick={skipTelegramAndComplete}
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        Пропустити (отримувати Email)
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Booking;