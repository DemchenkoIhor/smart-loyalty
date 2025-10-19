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
import { ArrowLeft, Send, Mail, MessageSquare, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Client {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  telegram_chat_id: number | null;
  telegram_username: string | null;
  preferred_channel: string | null;
}

interface SentMessage {
  id: string;
  sent_at: string;
  channel: string;
  delivery_status: string;
  message_text: string;
  clients: {
    full_name: string;
  };
}

const Communications = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);

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
      loadSentMessages();
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

  const loadSentMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("sent_messages")
        .select("id, sent_at, channel, delivery_status, message_text, clients(full_name)")
        .order("sent_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setSentMessages(data || []);
    } catch (error) {
      console.error("Error loading sent messages:", error);
    }
  };

  const sendMessage = async (formData: FormData) => {
    setSendingMessage(true);
    try {
      const clientId = formData.get("client") as string;
      const message = formData.get("message") as string;
      const forceChannel = formData.get("force_channel") as string | null;

      if (clientId === "all") {
        // Send to all clients
        for (const client of clients) {
          await supabase.functions.invoke('send-notification', {
            body: {
              client_id: client.id,
              message_type: 'custom',
              custom_message: message,
              force_channel: forceChannel === 'auto' ? undefined : forceChannel
            }
          });
        }
        toast.success('Повідомлення надіслано всім клієнтам');
      } else {
        // Send to specific client
        await supabase.functions.invoke('send-notification', {
          body: {
            client_id: clientId,
            message_type: 'custom',
            custom_message: message,
            force_channel: forceChannel === 'auto' ? undefined : forceChannel
          }
        });
        toast.success('Повідомлення надіслано');
      }

      // Reset form and reload messages
      (document.querySelector('form') as HTMLFormElement)?.reset();
      loadSentMessages();
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
                            <div className="flex items-center justify-between gap-2 w-full">
                              <span>{client.full_name} ({client.phone})</span>
                              <div className="flex gap-1">
                                {client.telegram_chat_id && (
                                  <Badge variant="secondary" className="text-xs">
                                    <MessageSquare className="h-3 w-3" />
                                  </Badge>
                                )}
                                {client.email && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Mail className="h-3 w-3" />
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Автоматично використовується пріоритетний канал клієнта
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="force_channel">Канал відправки (тестування)</Label>
                    <Select name="force_channel" defaultValue="auto">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Автоматично (за налаштуваннями клієнта)</SelectItem>
                        <SelectItem value="email">Примусово Email (для тестування)</SelectItem>
                        <SelectItem value="telegram">Примусово Telegram (для тестування)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Для тестування email виберіть "Примусово Email"
                    </p>
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
                <CardTitle>Історія повідомлень</CardTitle>
                <CardDescription>
                  Останні надіслані повідомлення
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sentMessages.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Клієнт</TableHead>
                        <TableHead>Канал</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Повідомлення</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sentMessages.map((msg) => (
                        <TableRow key={msg.id}>
                          <TableCell className="text-sm">
                            {new Date(msg.sent_at).toLocaleDateString('uk-UA', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </TableCell>
                          <TableCell>{msg.clients.full_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {msg.channel === 'telegram' ? (
                                <MessageSquare className="h-3 w-3 mr-1" />
                              ) : (
                                <Mail className="h-3 w-3 mr-1" />
                              )}
                              {msg.channel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {msg.delivery_status === 'sent' ? (
                              <Badge variant="default" className="bg-green-500">
                                <Check className="h-3 w-3 mr-1" />
                                Надіслано
                              </Badge>
                            ) : msg.delivery_status === 'failed' ? (
                              <Badge variant="destructive">
                                <X className="h-3 w-3 mr-1" />
                                Помилка
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Очікує</Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-sm">
                            {msg.message_text}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Поки що немає надісланих повідомлень
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Communications;
