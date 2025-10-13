import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, User, DollarSign, Clock } from "lucide-react";

interface EmployeeService {
  id: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  services: { name: string; description: string | null };
}

interface Employee {
  id: string;
  bio: string | null;
  is_active: boolean;
  profiles: { full_name: string; email: string | null };
  employee_services: EmployeeService[];
}

const Employees = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthAndLoadEmployees();
  }, []);

  const checkAuthAndLoadEmployees = async () => {
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

      loadEmployees();
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
            services(name, description)
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
              <h1 className="text-2xl font-bold">Працівники</h1>
              <p className="text-sm text-muted-foreground">
                Всього працівників: {employees.length}
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
                        <CardTitle>{employee.profiles?.full_name}</CardTitle>
                        <CardDescription>{employee.profiles?.email}</CardDescription>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      employee.is_active 
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                    }`}>
                      {employee.is_active ? "Активний" : "Неактивний"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {employee.bio && (
                    <p className="text-sm text-muted-foreground">{employee.bio}</p>
                  )}

                  <div>
                    <h4 className="font-semibold mb-2 text-sm">Послуги</h4>
                    {employee.employee_services && employee.employee_services.length > 0 ? (
                      <div className="space-y-2">
                        {employee.employee_services
                          .filter(es => es.is_active)
                          .map((empService) => (
                          <div key={empService.id} className="p-3 bg-muted rounded">
                            <div className="flex items-start justify-between mb-1">
                              <p className="font-medium text-sm">{empService.services.name}</p>
                              <span className="text-sm font-semibold">{empService.price} грн</span>
                            </div>
                            {empService.services.description && (
                              <p className="text-xs text-muted-foreground mb-2">
                                {empService.services.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {empService.duration_minutes} хв
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Немає послуг</p>
                    )}
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

export default Employees;
