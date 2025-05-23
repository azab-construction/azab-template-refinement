
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { MaintenanceRequest, MaintenanceRequestDB, AttachmentDB } from '@/types/maintenance';
import { sendEmail } from '@/lib/emailjs';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const QuickRequestForm: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<MaintenanceRequest>({
    branch: '',
    serviceType: '',
    title: '',
    description: '',
    priority: 'medium',
    requestedDate: new Date().toISOString().split('T')[0],
    estimatedCost: '',
    attachments: []
  });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleSelectChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setFormData({
        ...formData,
        attachments: filesArray
      });
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.branch || !formData.serviceType || !formData.title || !formData.description) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsSubmitting(true);

      // إنشاء رقم طلب فريد
      const uniqueId = Date.now().toString().slice(-6);
      const reqNumber = `MR-${uniqueId}`;
      
      // بحث عن معرّف الفرع المحدد
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('id')
        .eq('name', formData.branch)
        .single();

      let storeId = null;
      if (!storeError && storeData) {
        storeId = storeData.id;
      }

      // تحويل estimatedCost من نص إلى رقم إذا كان موجوداً
      const estimatedCost = formData.estimatedCost
        ? parseFloat(formData.estimatedCost)
        : null;
      
      // حفظ المعلومات في قاعدة البيانات
      const requestData: MaintenanceRequestDB = {
        title: formData.title,
        service_type: formData.serviceType,
        description: formData.description,
        priority: formData.priority,
        scheduled_date: formData.requestedDate,
        estimated_cost: estimatedCost,
        status: 'pending',
        store_id: storeId,
        created_at: new Date().toISOString()
      };
        
      const { data: insertedRequest, error: dbError } = await supabase
        .from('maintenance_requests')
        .insert(requestData)
        .select();
        
      if (dbError) {
        console.error('خطأ في حفظ بيانات الطلب:', dbError);
        throw new Error('حدث خطأ في حفظ البيانات');
      }
      
      const requestId = insertedRequest ? insertedRequest[0]?.id : reqNumber;
      
      // رفع المرفقات إلى Supabase Storage (إذا وجدت)
      if (formData.attachments.length > 0) {
        const uploadPromises = formData.attachments.map(async (file) => {
          const fileName = `${requestId}-${file.name}`;
          const { data, error } = await supabase.storage
            .from('maintenance-attachments')
            .upload(fileName, file);
          
          if (error) {
            console.error('خطأ في رفع المرفق:', error);
            return null;
          }
          
          // إنشاء URL للملف المرفوع
          const fileUrl = supabase.storage
            .from('maintenance-attachments')
            .getPublicUrl(data?.path || '').data.publicUrl;
          
          return { path: data?.path, url: fileUrl };
        });
        
        const uploadedFiles = await Promise.all(uploadPromises);
        const fileUrls = uploadedFiles.filter(Boolean).map(file => file?.url);
        
        // إضافة المرفقات إلى جدول المرفقات إذا وجدت
        if (fileUrls.length > 0) {
          const attachmentsData: AttachmentDB[] = fileUrls.map((url) => ({
            request_id: requestId,
            file_url: url || '',
            description: `مرفق للطلب ${formData.title}`,
            uploaded_at: new Date().toISOString()
          }));
          
          const { error: attachError } = await supabase
            .from('attachments')
            .insert(attachmentsData);
            
          if (attachError) {
            console.error('خطأ في حفظ بيانات المرفقات:', attachError);
          }
        }
      }
      
      // إرسال البريد الإلكتروني
      const emailParams = {
        request_number: requestId,
        branch: formData.branch,
        service_type: formData.serviceType,
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        requested_date: new Date(formData.requestedDate).toLocaleDateString('ar-SA'),
        estimated_cost: formData.estimatedCost || 'غير محدد',
        attachments_count: formData.attachments.length
      };
      
      try {
        await sendEmail(emailParams);
      } catch (emailError) {
        console.error('خطأ في إرسال البريد الإلكتروني:', emailError);
      }
      
      toast({
        title: "تم إرسال الطلب بنجاح",
        description: `تم إنشاء طلب الصيانة برقم ${requestId}`,
        variant: "default",
      });
      
      // انتقال إلى صفحة متابعة الطلب
      navigate(`/maintenance-tracking?requestNumber=${requestId}`);
      
    } catch (error) {
      console.error('خطأ في إرسال الطلب:', error);
      toast({
        title: "حدث خطأ",
        description: "لم نتمكن من إرسال طلبك. الرجاء المحاولة مرة أخرى.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="branch">اختر الفرع *</Label>
          <Select
            value={formData.branch}
            onValueChange={(value) => handleSelectChange('branch', value)}
            required
          >
            <SelectTrigger id="branch">
              <SelectValue placeholder="اختر الفرع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="الرياض الرئيسي">الرياض الرئيسي</SelectItem>
              <SelectItem value="الرياض الشمالي">الرياض الشمالي</SelectItem>
              <SelectItem value="الرياض الجنوبي">الرياض الجنوبي</SelectItem>
              <SelectItem value="جدة">جدة</SelectItem>
              <SelectItem value="الدمام">الدمام</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="serviceType">نوع الخدمة *</Label>
          <Select
            value={formData.serviceType}
            onValueChange={(value) => handleSelectChange('serviceType', value)}
            required
          >
            <SelectTrigger id="serviceType">
              <SelectValue placeholder="اختر نوع الخدمة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="كهرباء">كهرباء</SelectItem>
              <SelectItem value="سباكة">سباكة</SelectItem>
              <SelectItem value="تكييف">تكييف</SelectItem>
              <SelectItem value="نجارة">نجارة</SelectItem>
              <SelectItem value="دهان">دهان</SelectItem>
              <SelectItem value="أخرى">أخرى</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">عنوان الطلب *</Label>
        <Input
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="أدخل عنوان الطلب"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">وصف المشكلة *</Label>
        <Textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="اشرح المشكلة بالتفصيل..."
          rows={3}
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priority">الأولوية</Label>
          <Select
            value={formData.priority}
            onValueChange={(value) => handleSelectChange('priority', value)}
          >
            <SelectTrigger id="priority">
              <SelectValue placeholder="اختر الأولوية" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">منخفضة</SelectItem>
              <SelectItem value="medium">متوسطة</SelectItem>
              <SelectItem value="high">عالية</SelectItem>
              <SelectItem value="critical">حرجة</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="attachment">إرفاق ملفات</Label>
          <Input
            id="attachment"
            type="file"
            onChange={handleFileChange}
            multiple
            className="cursor-pointer"
          />
          <p className="text-xs text-muted-foreground">يمكنك إرفاق صور أو مستندات متعلقة بالطلب</p>
        </div>
      </div>

      <div className="pt-4">
        <Button 
          type="submit" 
          className="w-full bg-construction-primary hover:bg-construction-primary/90"
          disabled={isSubmitting}
        >
          {isSubmitting ? "جاري الإرسال..." : "إرسال الطلب"}
        </Button>
      </div>
    </form>
  );
};

export default QuickRequestForm;
