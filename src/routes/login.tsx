import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, User, UserCog, Hammer, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { karigarsAPI } from "@/lib/api";
import { Link } from "react-router-dom";

export default function LoginPage({ onLogin }: { onLogin: (user: any) => void }) {
  const [loginType, setLoginType] = useState<"admin" | "karigar">("admin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    console.log("[Login] Attempting login. Type:", loginType, "Username:", username);

    try {
      if (loginType === "admin") {
        try {
          // Call to backend to authenticate the SaaS tenant
          let API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
          API_BASE_URL = API_BASE_URL.replace("localhost", "127.0.0.1"); // Force IPv4 resolution
          const API_URL = API_BASE_URL.endsWith('/api')
            ? `${API_BASE_URL}/tenants`
            : `${API_BASE_URL}/api/tenants`;
          
          console.log("[Login] Fetching from:", `${API_URL}/login`);

          const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
          });

          let data;
          try { data = await response.json(); } catch (e) { data = {}; }

          if (response.ok) {
            console.log("[Login] Shop login successful. Payload:", data);

            toast.success(`Welcome back, ${data.shopName}!`);
            onLogin({ 
              role: data.role, 
              tenantId: data._id, 
              shopName: data.shopName
            });
          } else {
            // Explicitly handle 403 (Forbidden) access restrictions
            if (response.status === 403) {
              if (data.status === "Pending" || (data.error && data.error.includes("pending"))) {
                toast.error("Your account is pending approval by the Super Admin.", { duration: 5000 });
              } else {
                toast.error(data.error || "Your subscription is inactive. Please contact support.", { duration: 5000 });
              }
            } else if (response.status === 401) {
              toast.error(data.error || "Invalid credentials", { duration: 5000 });
            } else {
              toast.error(data.error || `Login failed with status ${response.status}`, { duration: 5000 });
            }
            return;
          }
        } catch (fetchError) {
          // Fallback during transition if backend isn't connected yet
          console.error("[Login] Fetch error or fallback triggered:", fetchError);
          if (fetchError instanceof TypeError && fetchError.message.includes("Failed to fetch")) {
            if (username === "admin" && password === "admin123") {
              toast.success("Welcome back Admin!");
              onLogin({ role: "admin" });
            } else if (username === "admin2" && password === "admin123") {
              toast.success("Welcome GST Operator!");
              onLogin({ role: "operator" });
            } else {
              toast.error("Network Error: Could not connect to backend server. Is it running?");
            }
          } else {
            toast.error((fetchError as Error).message || "Invalid credentials");
          }
        }
      } else {
        const karigars = await karigarsAPI.getAll();
        const match = karigars.find((k: any) => k.username === username && k.password === password);
        if (match) {
          console.log("[Login] Karigar login successful. Match:", match);
          toast.success(`Welcome ${match.name}!`);
          onLogin({ role: "karigar", id: match._id || match.id, name: match.name });
        } else {
          toast.error("Invalid karigar credentials");
        }
      }
    } catch (err) {
      console.error("Login check failed", err);
      toast.error("Failed to connect to server");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background via-muted/50 to-muted p-4 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      
      <Card className="w-full max-w-md shadow-2xl border-border/50 relative z-10 backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-24 h-24 flex items-center justify-center mb-4 transform hover:scale-105 transition-all duration-300">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-md" />
          </div>
          <CardTitle className="text-3xl font-display tracking-tight">Coudiefy </CardTitle>
          <CardDescription className="text-base mt-2">SaaS Cloud Management</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex p-1.5 bg-muted/60 rounded-xl mb-8 border border-border/50">
            <button
              type="button"
              onClick={() => { setLoginType("admin"); setUsername(""); setPassword(""); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${loginType === "admin" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <UserCog className="w-4 h-4" />
              Shop Login
            </button>
            <button
              type="button"
              onClick={() => { setLoginType("karigar"); setUsername(""); setPassword(""); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${loginType === "karigar" ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Hammer className="w-4 h-4" />
              Karigar
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">{loginType === "admin" ? "Shop Username" : "Karigar Username"}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="username" type="text" placeholder={loginType === "admin" ? "Enter shop username" : "Enter your username"} value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus className="h-12 pl-10 bg-background/50 focus:bg-background transition-colors" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 pl-10 pr-10 bg-background/50 focus:bg-background transition-colors" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Toggle password visibility">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold shadow-md hover:shadow-lg transition-all duration-200 mt-4" disabled={isLoading}>
              {isLoading ? "Authenticating..." : `Sign In as ${loginType.charAt(0).toUpperCase() + loginType.slice(1)}`}
            </Button>
          </form>
          
          <div className="text-center mt-6 text-sm text-muted-foreground">
            Don't have an account? <Link to="/signup" className="text-primary font-medium hover:underline">Register your shop</Link>
          </div>
        </CardContent>
        <div className="text-center pb-6 text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Coudiefy . All rights reserved.
        </div>
      </Card>
    </div>
  );
}