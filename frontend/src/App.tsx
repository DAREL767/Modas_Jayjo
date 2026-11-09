import { useState } from "react";
import { useAuth } from "./auth/AuthProvider";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage, type DashboardSection, type PageKey } from "./pages/DashboardPage";
import { InventoryPage } from "./pages/InventoryPage";
import { SalesPage } from "./pages/SalesPage";
import { CashRegisterPage } from "./pages/CashRegisterPage";
import { UsersPage } from "./pages/UsersPage";
import { ChangeReportsPage } from "./pages/ChangesPage";
import { Button } from "./components/Panel";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import type { User } from "./api/types";

const googleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim());

export default function App() {
  const { user, signOut } = useAuth();
  if (!user) return <LoginPage googleConfigured={googleConfigured} />;
  return <Workspace key={user.id} user={user} signOut={signOut} />;
}

function Workspace({ user, signOut }: { user: User; signOut: () => void }) {
  const [page, setPage] = useState<PageKey>("dashboard");
  const [section, setSection] = useState<DashboardSection>("operation");
  const navigate = (next: PageKey) => {
    if (user.role !== "admin" && (next === "cash" || next === "users" || next === "reports")) return;
    setPage(next);
  };

  const pageTitle: Record<PageKey, string> = {
    dashboard: "Inicio",
    sales: "Punto de venta",
    inventory: "Inventario",
    cash: "Cierre de caja",
    users: "Personal",
    reports: "Reportes de novedades",
  };
  const content = {
    dashboard: <DashboardPage user={user} section={section} onNavigate={navigate} />,
    sales: <SalesPage onReturnToDashboard={() => setPage("dashboard")} />,
    inventory: <InventoryPage />,
    cash: <CashRegisterPage />,
    users: <UsersPage />,
    reports: <ChangeReportsPage />,
  }[page];

  return (
    <div className="min-h-screen bg-slate-50">
      <WorkspaceHeader user={user} section={section} onHome={() => setPage("dashboard")} onSignOut={signOut} onSectionChange={(next) => {
        if (next === "administration" && user.role !== "admin") return;
        setSection(next); setPage("dashboard");
      }} />
      <main className="workspace-main">
        {page !== "dashboard" && page !== "sales" && <div className="workspace-return"><Button variant="secondary" onClick={() => setPage("dashboard")}>← Volver al inicio</Button><h1>{pageTitle[page]}</h1></div>}
        {content}
      </main>
    </div>
  );
}
