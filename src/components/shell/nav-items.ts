import type { Route } from "next";
import { BarChart3, Bell, LayoutDashboard, Rocket, Workflow, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: Route;
  label: string;
  icon: LucideIcon;
  description: string;
};

// The shape of the product surface, mirroring the domains in docs/architecture.md.
export const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Portfolio, activity, and the state of every running workflow."
  },
  {
    href: "/launches",
    label: "Launches",
    icon: Rocket,
    description: "Bags launches, fee sharing, and claim history."
  },
  {
    href: "/signals",
    label: "Signals",
    icon: BarChart3,
    description: "Market, social, and developer signals in one feed."
  },
  {
    href: "/alerts",
    label: "Alerts",
    icon: Bell,
    description: "Thresholds, notifications, and delivery history."
  },
  {
    href: "/workflows",
    label: "Workflows",
    icon: Workflow,
    description: "Agent runs, scheduled jobs, and their retry state."
  }
];
