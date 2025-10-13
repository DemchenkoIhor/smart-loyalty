import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Send, Mail, MessageSquare } from "lucide-react";

interface Client {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
}

const Communications = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);

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
    } catch (error) {
      console.error("Error loading clients:", error);
      toast.error("Помилка завантаження клієнтів");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (formData: FormData) => {
    setSendingMessage(true);
    try {
      const clientId = formData.get("client") as string;
      const channel = formData.get("channel") as string;
      const message = formData.get("message") as string;

      if (clientId === "all") {
        // Send to all clients
        for (const client of clients) {
          await supabase
            .from("sent_messages")
            .insert({
              client_id: client.id,
              channel: channel as "email" | "sms",
              template_id: null,
              appointment_id: null
            });
        }
        toast.success(`Повідомлення надіслано всім клієнтам через ${channel}`);
      } else {
        // Send to specific client
        await supabase
          .from("sent_messages")
          .insert({
            client_id: clientId,
            channel: channel as "email" | "sms",
            template_id: null,
            appointment_id: null
          });
        toast.success(`Повідомлення надіслано через ${channel}`);
      }

      // Reset form
      (document.querySelector('form') as HTMLFormElement)?.reset();
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Помилка відправки повідомлення");
    } finally {
      setSendingMessage(false);
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
              <h1 className="text-2xl font-bold">Комунікації</h1>
              <p className="text-sm text-muted-foreground">
                Надсилайте повідомлення клієнтам
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Завантаження...</p>
          </div>
        ) : (
          <div className="grid gap-6">
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Надіслати повідомлення</CardTitle>
                <CardDescription>
                  Виберіть клієнта та канал для відправки повідомлення
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(new FormData(e.currentTarget));
                }} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="client">Отримувач</Label>
                      <Select name="client" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Оберіть клієнта" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Всі клієнти</SelectItem>
                          {clients.map(client => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.full_name} ({client.phone})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="channel">Канал</Label>
                      <Select name="channel" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Оберіть канал" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sms">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              SMS
                            </div>
                          </SelectItem>
                          <SelectItem value="email">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Email
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="message">Повідомлення</Label>
                    <Textarea
                      id="message"
                      name="message"
                      rows={6}
                      placeholder="Введіть текст повідомлення..."
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full gradient-primary"
                    disabled={sendingMessage}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendingMessage ? "Відправка..." : "Надіслати"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Шаблони повідомлень</CardTitle>
                <CardDescription>
                  Автоматичні повідомлення (в розробці)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Функція автоматичних повідомлень для нагадувань про записи, подяк після візиту та інших сценаріїв буде додана найближчим часом.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Communications;
