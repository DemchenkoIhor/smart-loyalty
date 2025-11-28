import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, User, Plus, Edit, Trash2, CalendarOff, X } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

interface Service {
  id: string;
  name: string;
  description: string | null;
}

interface EmployeeService {
  id: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  service_id: string;
  services: Service;
}

interface Employee {
  id: string;
  bio: string | null;
  is_active: boolean;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  profiles: { full_name: string; email: string | null } | null;
  employee_services: EmployeeService[];
}

interface DayOff {
  id: string;
  employee_id: string;
  date_off: string;
  reason: string | null;
}

const EmployeeManagement = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [isCreateEmployeeOpen, setIsCreateEmployeeOpen] = useState(false);
  const [isDaysOffOpen, setIsDaysOffOpen] = useState(false);
  const [daysOff, setDaysOff] = useState<DayOff[]>([]);
  const [newDayOff, setNewDayOff] = useState({ date: "", reason: "" });

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
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

      await Promise.all([loadEmployees(), loadServices()]);
    } catch (error) {
      console.error("Auth error:", error);
      toast.error("Помилка автентифікації");
    }
  };

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employees")
        .select(`
          *,
          profiles(full_name, email),
          employee_services(
            id,
            price,
            duration_minutes,
            is_active,
            service_id,
            services(id, name, description)
          )
        `)
        .order("is_active", { ascending: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error loading employees:", error);
      toast.error("Помилка завантаження працівників");
    } finally {
      setLoading(false);
    }
  };

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order("name");

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error loading services:", error);
    }
  };

  const toggleEmployeeStatus = async (employeeId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("employees")
        .update({ is_active: !currentStatus })
        .eq("id", employeeId);

      if (error) throw error;
      toast.success(currentStatus ? "Працівника деактивовано" : "Працівника активовано");
      loadEmployees();
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("Помилка зміни статусу");
    }
  };

  const updateEmployeeBio = async (employeeId: string, bio: string) => {
    try {
      const { error } = await supabase
        .from("employees")
        .update({ bio })
        .eq("id", employeeId);

      if (error) throw error;
      toast.success("Біо оновлено");
      loadEmployees();
      setEditingEmployee(null);
    } catch (error) {
      console.error("Error updating bio:", error);
      toast.error("Помилка оновлення біо");
    }
  };

  const addServiceToEmployee = async (employeeId: string, serviceId: string, price: number, duration: number) => {
    try {
      const { error } = await supabase
        .from("employee_services")
        .insert({
          employee_id: employeeId,
          service_id: serviceId,
          price,
          duration_minutes: duration,
          is_active: true
        });

      if (error) throw error;
      toast.success("Послугу додано");
      loadEmployees();
      setIsAddServiceOpen(false);
      setEditingEmployee(null);
    } catch (error) {
      console.error("Error adding service:", error);
      toast.error("Помилка додавання послуги");
    }
  };

  const removeServiceFromEmployee = async (serviceId: string) => {
    try {
      const { error } = await supabase
        .from("employee_services")
        .delete()
        .eq("id", serviceId);

      if (error) throw error;
      toast.success("Послугу видалено");
      loadEmployees();
    } catch (error) {
      console.error("Error removing service:", error);
      toast.error("Помилка видалення послуги");
    }
  };

  const loadDaysOff = async (employeeId: string) => {
    const { data, error } = await supabase
      .from("employee_days_off")
      .select("*")
      .eq("employee_id", employeeId)
      .gte("date_off", format(new Date(), "yyyy-MM-dd"))
      .order("date_off");
    
    if (error) {
      console.error("Error loading days off:", error);
      return;
    }
    setDaysOff(data || []);
  };

  const addDayOff = async (employeeId: string) => {
    if (!newDayOff.date) {
      toast.error("Оберіть дату");
      return;
    }
    try {
      const { error } = await supabase
        .from("employee_days_off")
        .insert({
          employee_id: employeeId,
          date_off: newDayOff.date,
          reason: newDayOff.reason || null,
        });

      if (error) throw error;
      toast.success("Вихідний додано");
      setNewDayOff({ date: "", reason: "" });
      loadDaysOff(employeeId);
    } catch (error: any) {
      if (error.code === "23505") {
        toast.error("Цей день вже додано");
      } else {
        toast.error("Помилка додавання");
      }
    }
  };

  const removeDayOff = async (dayOffId: string, employeeId: string) => {
    try {
      const { error } = await supabase
        .from("employee_days_off")
        .delete()
        .eq("id", dayOffId);

      if (error) throw error;
      toast.success("Вихідний видалено");
      loadDaysOff(employeeId);
    } catch (error) {
      toast.error("Помилка видалення");
    }
  };

  const createEmployee = async (formData: FormData) => {
    try {
      const email = formData.get("email") as string;
      const password = formData.get("password") as string;
      const fullName = formData.get("fullName") as string;
      const bio = formData.get("bio") as string;

      // Keep current admin session to avoid being switched to the new user after signUp
      const { data: { session: adminSession } } = await supabase.auth.getSession();
      if (!adminSession) {
        toast.error("Адмін-сесія не знайдена. Перезайдіть як адмін.");
        return;
      }

      // Create auth user (email confirmation safe). Always provide redirect.
      const redirectUrl = `${window.location.origin}/`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: redirectUrl,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Не вдалося створити користувача");

      // Restore admin session in case SDK switched to the new user
      const { error: restoreError } = await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token!,
      });
      if (restoreError) throw restoreError;

      // Create employee record (admin session)
      const { error: empError } = await supabase
        .from("employees")
        .insert({
          user_id: authData.user.id,
          bio,
          display_name: fullName,
          is_active: true,
        });
      if (empError) throw empError;

      // Assign employee role (admin session, passes RLS)
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: authData.user.id, role: "employee" });
      if (roleError) throw roleError;

      toast.success("Працівника створено. Користувач може увійти після підтвердження email (за потреби).");
      await loadEmployees();
      setIsCreateEmployeeOpen(false);
    } catch (error: any) {
      console.error("Error creating employee:", error);
      toast.error(error.message || "Помилка створення працівника");
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
              <h1 className="text-2xl font-bold">Управління працівниками</h1>
              <p className="text-sm text-muted-foreground">
                Всього працівників: {employees.length}
              </p>
            </div>
          </div>
          <Dialog open={isCreateEmployeeOpen} onOpenChange={setIsCreateEmployeeOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" />
                Додати працівника
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новий працівник</DialogTitle>
                <DialogDescription>
                  Створіть обліковий запис для нового працівника
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                createEmployee(new FormData(e.currentTarget));
              }} className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Повне ім'я</Label>
                  <Input id="fullName" name="fullName" required />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div>
                  <Label htmlFor="password">Тимчасовий пароль</Label>
                  <Input id="password" name="password" type="password" required />
                </div>
                <div>
                  <Label htmlFor="bio">Біо</Label>
                  <Textarea id="bio" name="bio" rows={3} />
                </div>
                <Button type="submit" className="w-full">Створити</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Завантаження...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {employees.map((employee) => (
              <Card key={employee.id} className="shadow-medium">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle>{employee.display_name || employee.profiles?.full_name || "Без імені"}</CardTitle>
                        <CardDescription>{employee.profiles?.email}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={employee.is_active}
                        onCheckedChange={() => toggleEmployeeStatus(employee.id, employee.is_active)}
                      />
                      <span className="text-xs">
                        {employee.is_active ? "Активний" : "Неактивний"}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editingEmployee?.id === employee.id ? (
                    <div className="space-y-2">
                      <Label>Біо</Label>
                      <Textarea
                        defaultValue={employee.bio || ""}
                        onBlur={(e) => updateEmployeeBio(employee.id, e.target.value)}
                        rows={2}
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <Label>Біо</Label>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingEmployee(employee)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {employee.bio || "Немає опису"}
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <Label>Послуги</Label>
                      <Dialog open={isAddServiceOpen && editingEmployee?.id === employee.id} onOpenChange={setIsAddServiceOpen}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingEmployee(employee)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Додати
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Додати послугу</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            addServiceToEmployee(
                              employee.id,
                              formData.get("service") as string,
                              Number(formData.get("price")),
                              Number(formData.get("duration"))
                            );
                          }} className="space-y-4">
                            <div>
                              <Label>Послуга</Label>
                              <Select name="service" required>
                                <SelectTrigger>
                                  <SelectValue placeholder="Оберіть послугу" />
                                </SelectTrigger>
                                <SelectContent>
                                  {services.map(service => (
                                    <SelectItem key={service.id} value={service.id}>
                                      {service.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Ціна (грн)</Label>
                              <Input name="price" type="number" required />
                            </div>
                            <div>
                              <Label>Тривалість (хв)</Label>
                              <Input name="duration" type="number" required />
                            </div>
                            <Button type="submit" className="w-full">Додати</Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                    {employee.employee_services && employee.employee_services.length > 0 ? (
                      <div className="space-y-2">
                        {employee.employee_services.map((empService) => (
                          <div key={empService.id} className="p-3 bg-muted rounded flex justify-between items-start">
                            <div>
                              <p className="font-medium text-sm">{empService.services.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {empService.price} грн · {empService.duration_minutes} хв
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeServiceFromEmployee(empService.id)}
                            >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">Немає послуг</p>
                          )}
                        </div>

                        {/* Days Off Section */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <Label>Вихідні дні</Label>
                            <Dialog 
                              open={isDaysOffOpen && editingEmployee?.id === employee.id} 
                              onOpenChange={(open) => {
                                setIsDaysOffOpen(open);
                                if (open) {
                                  setEditingEmployee(employee);
                                  loadDaysOff(employee.id);
                                }
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingEmployee(employee)}
                                >
                                  <CalendarOff className="h-3 w-3 mr-1" />
                                  Керувати
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader>
                                  <DialogTitle>Вихідні дні</DialogTitle>
                                  <DialogDescription>
                                    {employee.display_name || employee.profiles?.full_name}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="flex gap-2">
                                    <Input
                                      type="date"
                                      min={format(new Date(), "yyyy-MM-dd")}
                                      value={newDayOff.date}
                                      onChange={(e) => setNewDayOff({ ...newDayOff, date: e.target.value })}
                                    />
                                    <Input
                                      placeholder="Причина (опціонально)"
                                      value={newDayOff.reason}
                                      onChange={(e) => setNewDayOff({ ...newDayOff, reason: e.target.value })}
                                    />
                                    <Button onClick={() => addDayOff(employee.id)}>
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="max-h-60 overflow-y-auto space-y-2">
                                    {daysOff.length > 0 ? (
                                      daysOff.map((day) => (
                                        <div key={day.id} className="flex justify-between items-center p-2 bg-muted rounded">
                                          <div>
                                            <p className="font-medium text-sm">
                                              {format(new Date(day.date_off), "d MMMM yyyy", { locale: uk })}
                                            </p>
                                            {day.reason && (
                                              <p className="text-xs text-muted-foreground">{day.reason}</p>
                                            )}
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => removeDayOff(day.id, employee.id)}
                                          >
                                            <X className="h-3 w-3 text-destructive" />
                                          </Button>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-sm text-muted-foreground text-center py-4">
                                        Немає запланованих вихідних
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      };

export default EmployeeManagement;
