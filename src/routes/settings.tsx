import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocalState } from "@/lib/storage";
import { toast } from "sonner";
import { Store, Image as ImageIcon, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [authUser, setAuthUser] = useLocalState<any>("ajms.auth", null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [form, setForm] = useState({
    shopName: "",
    phone: "",
    phone2: "",
    email: "",
    address: "",
    gstNo: "",
    logo: "",
    termsAndConditions: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!authUser?.tenantId) {
        setIsLoading(false);
        return;
      }
      try {
        const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace('localhost', '127.0.0.1');
        const url = `${API_BASE_URL}/tenants/${authUser.tenantId}`;
        
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setForm({
            shopName: data.shopName || "",
            phone: data.phone || "",
            phone2: data.phone2 || "",
            email: data.email || "",
            address: data.address || "",
            gstNo: data.gstNo || "",
            logo: data.logo || "",
            termsAndConditions: data.termsAndConditions || "",
          });
        }
      } catch (err) {
        console.error("Failed to fetch tenant profile", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [authUser?.tenantId]);

  const handleImageChange = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 300; // Limit logo size
        let { width, height } = img;
        if (width > height && width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        } else if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL("image/webp", 0.8);
        setForm({ ...form, logo: compressedBase64 });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    if (!authUser?.tenantId) {
      console.warn("[Settings] No tenantId found in authUser object:", authUser);
      toast.error("Cannot save profile. You are logged in with the local offline fallback account. Please log out and log in with actual shop credentials.");
      return;
    }
    setIsSaving(true);
    
    console.log("[Settings] Attempting to save profile. Payload:", form);
    try {
      const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace('localhost', '127.0.0.1');
      const url = `${API_BASE_URL}/tenants/${authUser.tenantId}`;
      console.log("[Settings] Sending PUT request to:", url);

      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      console.log("[Settings] Response status:", res.status);

      if (res.ok) {
        const updatedTenant = await res.json();
        console.log("[Settings] Successfully updated tenant. Server responded with:", updatedTenant);

        // Update local session
        setAuthUser({
          ...authUser,
          shopName: updatedTenant.shopName,
        });
        toast.success("Shop profile updated successfully!");
      } else {
        const errText = await res.text();
        console.error("[Settings] Server returned an error:", errText);
        throw new Error("Failed to update profile");
      }
    } catch (error) {
      console.error("[Settings] Exception caught while saving profile:", error);
      toast.error("Network error while saving profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Layout>
      <header className="mb-6">
        <h1 className="text-4xl font-display text-primary">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your shop profile, logo, and billing information.</p>
      </header>

      <div className="max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl"><Store className="w-5 h-5 text-primary"/> Shop Profile</CardTitle>
            <CardDescription>This information will appear on all your invoices and receipts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="py-10 text-center text-muted-foreground flex flex-col items-center">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
                Loading profile from database...
              </div>
            ) : (
              <>
            <div>
              <Label className="mb-2 block">Shop Logo</Label>
              <div className="flex items-center gap-6">
                {form.logo ? (
                  <img src={form.logo} alt="Shop Logo" className="w-24 h-24 object-contain rounded-md border border-border shadow-sm bg-white" />
                ) : (
                  <div className="w-24 h-24 bg-muted border border-dashed border-border rounded-md flex flex-col items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-6 h-6 mb-1" />
                    <span className="text-[10px] uppercase">No Logo</span>
                  </div>
                )}
                <Input type="file" accept="image/*" onChange={(e) => handleImageChange(e.target.files?.[0])} className="max-w-xs" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Shop Name</Label><Input value={form.shopName} onChange={e => setForm({...form, shopName: e.target.value})} placeholder="Your Shop Name" /></div>
              <div className="space-y-1.5"><Label>GST Number</Label><Input value={form.gstNo} onChange={e => setForm({...form, gstNo: e.target.value})} placeholder="GSTIN" /></div>
              <div className="space-y-1.5"><Label>Phone Number</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+91 9999999999" /></div>
              <div className="space-y-1.5"><Label>Alternate Phone (Optional)</Label><Input value={form.phone2} onChange={e => setForm({...form, phone2: e.target.value})} placeholder="+91 8888888888" /></div>
              <div className="space-y-1.5"><Label>Email Address</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="shop@example.com" /></div>
              <div className="sm:col-span-2 space-y-1.5"><Label>Full Address</Label><Textarea rows={3} value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="123 Jewelry Market, City, State..." /></div>
              <div className="sm:col-span-2 space-y-1.5"><Label>Terms & Conditions</Label><Textarea rows={4} value={form.termsAndConditions} onChange={e => setForm({...form, termsAndConditions: e.target.value})} placeholder="E.g. 1. Goods once sold will not be taken back..." /></div>
            </div>

            <div className="border-t pt-4 flex justify-end">
              <Button size="lg" onClick={saveProfile} disabled={isSaving}>{isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Saving...</> : "Save Profile"}</Button>
            </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}