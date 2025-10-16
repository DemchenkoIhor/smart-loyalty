import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Search, Mail, Phone, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Client {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  notes: string | null;
  created_at: string;
}

interface ClientAppointment {
  id: string;
  scheduled_at: string;
  status: string;
  services: { name: string };
  price: number;
}

const Clients = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientHistory, setClientHistory] = useState<ClientAppointment[]>([]);

  useEffect(() => {
    checkAuthAndLoadClients();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = clients.filter(client =>
        client.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.phone.includes(searchQuery) ||
        (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients(clients);
    }
  }, [searchQuery, clients]);

  const checkAuthAndLoadClients = async () => {
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

      loadClients();
    } catch (error) {
      console.error("Auth error:", error);
      toast.error("Помилка автентифікації");
    }
  };

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClients(data || []);
      setFilteredClients(data || []);
    } catch (error) {
      console.error("Error loading clients:", error);
      toast.error("Помилка завантаження клієнтів");
    } finally {
      setLoading(false);
    }
  };

  const loadClientHistory = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          scheduled_at,
          status,
          price,
          services(name)
        `)
        .eq("client_id", clientId)
        .order("scheduled_at", { ascending: false });

      if (error) throw error;
      setClientHistory(data || []);
    } catch (error) {
      console.error("Error loading client history:", error);
      toast.error("Помилка завантаження історії");
    }
  };

  const handleClientClick = (client: Client) => {
    setSelectedClient(client);
    loadClientHistory(client.id);
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed": return "Завершено";
      case "confirmed": return "Підтверджено";
      case "cancelled": return "Скасовано";
      default: return "Очікує";
    }
  };

  const getTotalSpent = () => {
    return clientHistory
      .filter(apt => apt.status === "completed")
      .reduce((sum, apt) => sum + Number(apt.price), 0);
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
              <h1 className="text-2xl font-bold">База клієнтів</h1>
              <p className="text-sm text-muted-foreground">
                Всього клієнтів: {clients.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Card className="shadow-medium mb-6">
          <CardHeader>
            <CardTitle>Пошук клієнтів</CardTitle>
            <CardDescription>Пошук за ім'ям, телефоном або email</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Введіть ім'я, телефон або email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Завантаження...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <Dialog key={client.id}>
                <DialogTrigger asChild>
                  <Card 
                    className="shadow-soft hover:shadow-medium transition-all cursor-pointer"
                    onClick={() => handleClientClick(client)}
                  >
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-lg mb-2">{client.full_name}</h3>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          {client.phone}
                        </div>
                        {client.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            {client.email}
                          </div>
                        )}
                      </div>
                      {client.notes && (
                        <p className="mt-3 text-sm text-blue-600 dark:text-blue-400">
                          📝 {client.notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{selectedClient?.full_name}</DialogTitle>
                    <DialogDescription>
                      Історія візитів та інформація про клієнта
                    </DialogDescription>
                  </DialogHeader>
                  
                  {selectedClient && (
                    <div className="space-y-6">
                      <div>
                        <h4 className="font-semibold mb-2">Контактна інформація</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            {selectedClient.phone}
                          </div>
                          {selectedClient.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              {selectedClient.email}
                            </div>
                          )}
                        </div>
                        <div className="mt-3">
                          <h5 className="text-sm font-medium mb-2">Коментар про клієнта</h5>
                          <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded">
                            <p className="text-sm whitespace-pre-wrap">{selectedClient.notes || "Немає коментарів"}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">Цей коментар доступний для перегляду та редагування всім майстрам та адміністраторам в календарі</p>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Статистика</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-muted rounded">
                            <p className="text-sm text-muted-foreground">Всього візитів</p>
                            <p className="text-2xl font-bold">{clientHistory.length}</p>
                          </div>
                          <div className="p-3 bg-muted rounded">
                            <p className="text-sm text-muted-foreground">Витрачено</p>
                            <p className="text-2xl font-bold">{getTotalSpent()} грн</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Історія візитів</h4>
                        {clientHistory.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Немає історії візитів</p>
                        ) : (
                          <div className="space-y-2">
                            {clientHistory.map((apt) => (
                              <div key={apt.id} className="p-3 border rounded">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-medium">{apt.services.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {new Date(apt.scheduled_at).toLocaleDateString("uk-UA")}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-medium">{apt.price} грн</p>
                                    <p className="text-xs text-muted-foreground">
                                      {getStatusText(apt.status)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Clients;
