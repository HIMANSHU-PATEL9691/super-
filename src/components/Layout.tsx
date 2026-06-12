import { NavLink, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Users,
  Receipt,
  Wallet,
  Landmark,
  Truck,
  Hammer,
  Wrench,
  ShoppingBag,
  TrendingUp,
  ShoppingCart,
  BarChart3,
  Menu,
  ClipboardList,
  BookOpen,
  AlertCircle,
  BellRing,
  Store,
  X,
  LogOut,
  Calculator,
  Briefcase,
  FileText,
  LayoutGrid,
  Settings,
} from "lucide-react";
import { useEffect, useState, type ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useApi } from "@/hooks/useApi";
import { inventoryAPI, invoicesAPI, repairsAPI, ordersAPI } from "@/lib/api";
import { type Order, type Repair, type Invoice, type Product } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

const adminGroups: { title: string; items: NavItem[] }[] = [
  { title: "Overview", items: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/notifications", label: "Notifications", icon: BellRing },
    { to: "/calculator", label: "Calculator", icon: Calculator },
    { to: "/settings", label: "Settings", icon: Settings },
  ] },
  { title: "Sales", items: [
    { to: "/billing", label: "POS / Billing", icon: ShoppingCart },
    { to: "/sales", label: "Sales", icon: Receipt },
    { to: "/orders", label: "Orders", icon: ShoppingBag },
  ]},
  { title: "Inventory", items: [
    { to: "/catalog", label: "Catalog", icon: LayoutGrid },
    { to: "/inventory", label: "Products", icon: Package },
    { to: "/gold-rates", label: "Gold Rates", icon: TrendingUp },
  ]},
  { title: "People", items: [
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/employees", label: "Employees", icon: Briefcase },
    { to: "/suppliers", label: "Suppliers", icon: Truck },
    { to: "/karigars", label: "Karigars", icon: Hammer },
  ]},
  { title: "Operations", items: [
    { to: "/repairs", label: "Repairs", icon: Wrench },
    { to: "/karigar-tasks", label: "Karigar Tasks", icon: ClipboardList },
  ]},
  { title: "Finance", items: [
    { to: "/purchases", label: "Purchases", icon: ShoppingBag },
    { to: "/expenses", label: "Expenses", icon: Wallet },
    { to: "/dues", label: "Customer Dues", icon: AlertCircle },
    { to: "/girvi", label: "Girvi (Loans)", icon: Landmark },
    { to: "/forwarded-shops", label: "Forwarded Shops", icon: Store },
    { to: "/reports", label: "Reports", icon: BarChart3 },
    { to: "/ledger", label: "Daily Ledger", icon: BookOpen },
  ]},
];

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const authRaw = localStorage.getItem("ajms.auth");
  const authUser = authRaw ? JSON.parse(authRaw) : null;
  const isKarigar = authUser?.role === "karigar";
  const isOperator = authUser?.role === "operator";

  const groups = isKarigar ? [
    { title: "My Workspace", items: [
      { to: "/karigar-tasks", label: "My Tasks", icon: ClipboardList }
    ]}
  ] : adminGroups.map(group => {
    if (group.title === "Finance" && isOperator) {
      return {
        ...group,
        items: [
          ...group.items,
          { to: "/gst-report", label: "GST Report", icon: FileText as any }
        ]
      };
    }
    return group;
  });

  return (
    <>
      <div className="px-6 py-6 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Coudiefy Logo" className="w-10 h-10 object-contain" />
          <div>
            <div className="font-display text-lg leading-none">Coudiefy </div>
            <div className="text-xs text-muted-foreground mt-0.5">Jewellery software</div>
          </div>
        </div>
        {onNavigate && (
          <button onClick={onNavigate} className="lg:hidden p-1 rounded hover:bg-sidebar-accent" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <ScrollArea className="flex-1">
        <nav className="p-3">
          {groups.map((g) => (
            <div key={g.title} className="mb-3">
              <div className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">{g.title}</div>
              {g.items.map((n) => {
                const Icon = n.icon;
                return (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.to === "/"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )
                    }
                  >
                    <Icon className="w-4 h-4" />
                    {n.label}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>
      <div className="p-4 text-xs text-muted-foreground border-t border-sidebar-border">
        <Button
          variant="ghost" 
          onClick={() => {
            localStorage.removeItem("ajms.auth");
            window.location.reload();
          }}
          className="w-full justify-start text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 font-medium"
        >
          <LogOut className="w-4 h-4 mr-2" /> Log out securely
        </Button>
      </div>
    </>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const { data: products = [] } = useApi<Product[]>(["inventory"], () => inventoryAPI.getAll());
  const { data: invoices = [] } = useApi<Invoice[]>(["invoices"], () => invoicesAPI.getAll());
  const { data: repairs = [] } = useApi<Repair[]>(["repairs"], () => repairsAPI.getAll());
  const { data: orders = [] } = useApi<Order[]>(["orders"], () => ordersAPI.getAll());

  const totalNotifications = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const readyOrders = orders.filter(o => o.status === "Ready").length;
    const readyRepairs = repairs.filter(r => r.status === "Ready").length;
    const dueOrders = orders.filter(o => o.dueDate && o.dueDate <= todayIso && !["Delivered", "Cancelled"].includes(o.status)).length;
    const dueRepairs = repairs.filter(r => r.deliveryDate && r.deliveryDate <= todayIso && r.status !== "Delivered").length;
    const unpaidInvoices = invoices.filter(i => (i.balanceDue || 0) > 0).length;
    const lowStock = products.filter(p => p.stock <= 2).length;
    return readyOrders + readyRepairs + dueOrders + dueRepairs + unpaidInvoices + lowStock;
  }, [orders, repairs, invoices, products]);

  // Close drawer on route change and scroll to top
  useEffect(() => {
    setOpen(false);
    
    // Scroll main content to top on navigation
    const mainViewport = document.querySelector('main [data-radix-scroll-area-viewport]');
    if (mainViewport) {
      mainViewport.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="h-dvh flex overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex-col h-full">
        <SidebarBody />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setOpen(false);
            }}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col shadow-xl h-full">
            <SidebarBody
              onNavigate={() => {
                setOpen(false);
              }}
            />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col h-full">
        {/* Top Navbar */}
        <header className="shrink-0 sticky top-0 z-30 flex items-center justify-between px-4 h-16 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden -ml-2" onClick={() => setOpen(true)}>
              <Menu className="w-5 h-5" />
              <span className="sr-only">Open Menu</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/notifications">
              <Button variant="ghost" size="icon" className="relative rounded-full">
                <BellRing className="w-5 h-5" />
                {totalNotifications > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                    {totalNotifications > 9 ? '9+' : totalNotifications}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-6">{children}</div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
