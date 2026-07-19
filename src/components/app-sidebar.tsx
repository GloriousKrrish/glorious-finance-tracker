import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Wallet, ArrowLeftRight, PiggyBank, TrendingUp,
  Landmark, Receipt, Target, Settings, Sparkles, FileText, ShieldCheck, LogOut, MessageSquareText,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";

const primary = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Assistant", url: "/assistant", icon: MessageSquareText },
  { title: "Transactions", url: "/transactions", icon: ArrowLeftRight },
  { title: "Accounts", url: "/accounts", icon: Wallet },
  { title: "Budgets", url: "/budgets", icon: PiggyBank },
];
const wealth = [
  { title: "Investments", url: "/investments", icon: TrendingUp },
  { title: "Loans", url: "/loans", icon: Landmark },
  { title: "Bills", url: "/bills", icon: Receipt },
  { title: "Goals", url: "/goals", icon: Target },
];
const workspace = [
  { title: "Reports", url: "/reports", icon: FileText },
  { title: "Sessions", url: "/sessions", icon: ShieldCheck },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isActive = (u: string) => (u === "/" ? pathname === "/" : pathname.startsWith(u));

  const item = (i: { title: string; url: string; icon: any }) => (
    <SidebarMenuItem key={i.url}>
      <SidebarMenuButton asChild isActive={isActive(i.url)} tooltip={i.title}>
        <Link to={i.url} className="flex items-center gap-3">
          <i.icon className="h-4 w-4" />
          <span className="font-medium">{i.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const handleSignOut = async () => {
    await signOut("local");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60">
      <SidebarHeader className="border-b border-border/60 py-4">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sparkles className="h-4 w-4 text-gold" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-display text-sm font-semibold tracking-tight">GloriousFinance</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Wealth OS</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Overview</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{primary.map(item)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Wealth</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{wealth.map(item)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{workspace.map(item)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border/60">
        {user && (
          <div className="px-2 py-2 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-xs text-muted-foreground">Signed in as</div>
            <div className="truncate text-sm font-medium">{user.email}</div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut} tooltip="Sign out">
              <LogOut className="h-4 w-4" />
              <span className="font-medium">Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
