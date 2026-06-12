import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, User, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminLoginPage({ onLogin }: { onLogin: (user: any) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate network delay for security effect
    setTimeout(() => {
      if (username === "superadmin" && password === "superadmin123") {
        toast.success("Welcome Super Admin!");
        onLogin({ role: "superadmin" });
      } else {
        toast.error("Invalid Super Admin credentials");
      }
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background via-muted/50 to-muted p-4 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      
      <Card className="w-full max-w-md shadow-2xl border-border/50 relative z-10 backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center pb-6 pt-8">
          <div className="mx-auto w-24 h-24 mb-4 flex items-center justify-center transform hover:scale-105 transition-all duration-300">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-md" />
          </div>
          <CardTitle className="text-3xl font-display tracking-tight">Super Admin Access</CardTitle>
          <CardDescription className="mt-2">Enter your credentials to manage SaaS tenants.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="username" type="text" placeholder="superadmin" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus className="h-12 pl-10 bg-background/50 focus:bg-background transition-colors" />
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
            <Button type="submit" className="w-full h-12 text-base font-semibold shadow-md mt-6" disabled={isLoading}>
              {isLoading ? "Authenticating..." : "Secure Login"}
            </Button>
          </form>
        </CardContent>
        <div className="text-center pb-6 text-sm text-muted-foreground">
          Secured environment. Unauthorized access is prohibited.
        </div>
      </Card>
    </div>
  );
}