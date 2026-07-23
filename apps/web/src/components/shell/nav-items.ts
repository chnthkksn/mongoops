export interface NavItem {
  label: string;
  href: string;
  letter: string;
  enabled: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", letter: "D", enabled: true },
  { label: "Clusters", href: "/clusters", letter: "C", enabled: true },
  { label: "Database Explorer", href: "/database-explorer", letter: "E", enabled: true },
  { label: "Database Access", href: "/database-access", letter: "V", enabled: true },
  { label: "Monitoring", href: "/monitoring", letter: "M", enabled: true },
  { label: "Backup", href: "/backup", letter: "B", enabled: true },
  { label: "Alerts", href: "/alerts", letter: "A", enabled: false },
  { label: "Users & Security", href: "/users-security", letter: "U", enabled: true },
];
