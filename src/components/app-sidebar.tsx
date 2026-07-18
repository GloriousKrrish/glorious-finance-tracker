import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Wallet, ArrowLeftRight, PiggyBank, TrendingUp,
  Landmark, Receipt, Target, Settings, Sparkles,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";

const primary = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
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

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
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
      </SidebarContent>
      <SidebarFooter className="border-t border-border/60">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/settings")} tooltip="Settings">
              <Link to="/settings" className="flex items-center gap-3">
                <Settings className="h-4 w-4" />
                <span className="font-medium">Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
