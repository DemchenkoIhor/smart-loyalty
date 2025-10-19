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
import { ArrowLeft, Plus, Edit2, Trash2, Power, Mail, MessageSquare } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface MessageTemplate {
  id: string;
  name: string;
  body: string;
  trigger_condition: string;
  channel: string;
  subject: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const AutoMessages = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

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

      loadTemplates();
    } catch (error) {
      console.error("Auth error:", error);
      toast.error("Помилка автентифікації");
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error loading templates:", error);
      toast.error("Помилка завантаження темплейтів");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: FormData) => {
    try {
      const templateData = {
        name: formData.get("name") as string,
        body: formData.get("body") as string,
        trigger_condition: formData.get("trigger_condition") as string,
        channel: formData.get("channel") as "telegram" | "email",
        subject: formData.get("subject") as string || null,
        is_active: true,
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from("message_templates")
          .update(templateData)
          .eq("id", editingTemplate.id);

        if (error) throw error;
        toast.success("Темплейт оновлено");
      } else {
        const { error } = await supabase
          .from("message_templates")
          .insert([templateData]);

        if (error) throw error;
        toast.success("Темплейт створено");
      }

      setDialogOpen(false);
      setEditingTemplate(null);
      loadTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Помилка збереження темплейту");
    }
  };

  const toggleTemplate = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("message_templates")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
      toast.success(isActive ? "Темплейт деактивовано" : "Темплейт активовано");
      loadTemplates();
    } catch (error) {
      console.error("Error toggling template:", error);
      toast.error("Помилка зміни статусу");
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Ви впевнені, що хочете видалити цей темплейт?")) return;

    try {
      const { error } = await supabase
        .from("message_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Темплейт видалено");
      loadTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Помилка видалення");
    }
  };

  const openEditDialog = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
  };

  const getTriggerLabel = (trigger: string) => {
    const triggers: Record<string, string> = {
      booking_confirmation: "Підтвердження запису",
      booking_reminder: "Нагадування про запис",
      post_visit_thanks: "Подяка після візиту",
      custom: "Власне",
    };
    return triggers[trigger] || trigger;
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
              <h1 className="text-2xl font-bold">Автоматичні повідомлення</h1>
              <p className="text-sm text-muted-foreground">
                Налаштування темплейтів та умов надсилання
              </p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary" onClick={() => setEditingTemplate(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Новий темплейт
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? "Редагувати темплейт" : "Новий темплейт"}
                </DialogTitle>
                <DialogDescription>
                  Створіть темплейт повідомлення, що буде автоматично надсилатися за певних умов
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(new FormData(e.currentTarget));
              }} className="space-y-4">
                <div>
                  <Label htmlFor="name">Назва темплейту</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Наприклад: Підтвердження запису"
                    defaultValue={editingTemplate?.name}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="trigger_condition">Умова надсилання</Label>
                  <Select name="trigger_condition" defaultValue={editingTemplate?.trigger_condition || "booking_confirmation"} required>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="booking_confirmation">Підтвердження запису</SelectItem>
                      <SelectItem value="booking_reminder">Нагадування про запис (за 1 день)</SelectItem>
                      <SelectItem value="post_visit_thanks">Подяка після візиту</SelectItem>
                      <SelectItem value="custom">Власна умова</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Коли буде надіслано це повідомлення
                  </p>
                </div>

                <div>
                  <Label htmlFor="channel">Канал відправки</Label>
                  <Select name="channel" defaultValue={editingTemplate?.channel || "telegram"} required>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="telegram">Telegram</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="subject">Тема (для Email)</Label>
                  <Input
                    id="subject"
                    name="subject"
                    placeholder="Тема листа (якщо канал - Email)"
                    defaultValue={editingTemplate?.subject || ""}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Використовується тільки для Email
                  </p>
                </div>

                <div>
                  <Label htmlFor="body">Текст повідомлення</Label>
                  <Textarea
                    id="body"
                    name="body"
                    rows={10}
                    placeholder="Введіть текст повідомлення. Використовуйте змінні: {client_name}, {service}, {employee}, {date}, {time}, {price}"
                    defaultValue={editingTemplate?.body}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Доступні змінні: {"{client_name}"}, {"{service}"}, {"{employee}"}, {"{date}"}, {"{time}"}, {"{price}"}
                  </p>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    Скасувати
                  </Button>
                  <Button type="submit" className="gradient-primary">
                    {editingTemplate ? "Оновити" : "Створити"}
                  </Button>
                </div>
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
          <Card className="shadow-medium">
            <CardHeader>
              <CardTitle>Темплейти повідомлень</CardTitle>
              <CardDescription>
                Налаштовані автоматичні повідомлення
              </CardDescription>
            </CardHeader>
            <CardContent>
              {templates.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Назва</TableHead>
                      <TableHead>Умова</TableHead>
                      <TableHead>Канал</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead className="text-right">Дії</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getTriggerLabel(template.trigger_condition)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {template.channel === 'telegram' ? (
                              <MessageSquare className="h-3 w-3 mr-1" />
                            ) : (
                              <Mail className="h-3 w-3 mr-1" />
                            )}
                            {template.channel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={template.is_active}
                              onCheckedChange={() => toggleTemplate(template.id, template.is_active)}
                            />
                            <span className="text-sm text-muted-foreground">
                              {template.is_active ? "Активний" : "Неактивний"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(template)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteTemplate(template.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    Поки що немає налаштованих темплейтів
                  </p>
                  <Button onClick={() => setDialogOpen(true)} className="gradient-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Створити перший темплейт
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AutoMessages;
