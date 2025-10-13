import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Calendar, Clock, User, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

interface Employee {
  id: string;
  user_id: string;
  bio: string | null;
  profiles: {
    full_name: string;
  };
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

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      loadEmployeeServices(selectedEmployee);
    }
  }, [selectedEmployee]);

  const loadEmployees = async () => {
    const { data, error } = await supabase
      .from("employees")
      .select("id, user_id, bio, profiles(full_name)")
      .eq("is_active", true);

    if (error) {
      toast.error("Помилка завантаження працівників");
      return;
    }

    setEmployees(data || []);
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
    const slots = [];
    for (let hour = 9; hour <= 19; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        slots.push(time);
      }
    }
    return slots;
  };

  const handleSubmit = async () => {
    if (!selectedEmployee || !selectedService || !selectedDate || !selectedTime || !clientName || !clientPhone) {
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
        .eq("phone", clientPhone)
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert({
            full_name: clientName,
            phone: clientPhone,
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

      toast.success("Запис успішно створено!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Помилка створення запису");
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
              Крок {step} з 4
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
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold">{employee.profiles.full_name}</h4>
                          {employee.bio && <p className="text-sm text-muted-foreground">{employee.bio}</p>}
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
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>

                {selectedDate && (
                  <div className="space-y-2">
                    <Label className="text-lg">Оберіть час</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {generateTimeSlots().map((time) => (
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
                  <p className="text-sm">Майстер: {selectedEmployeeData?.profiles.full_name}</p>
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
                  disabled={loading}
                  onClick={handleSubmit}
                >
                  {loading ? "Створення запису..." : "Підтвердити запис"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Booking;