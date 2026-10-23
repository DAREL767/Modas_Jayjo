import { useState } from "react";
import { useAuth } from "./auth/AuthProvider";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage, type PageKey } from "./pages/DashboardPage";
import { InventoryPage } from "./pages/InventoryPage";
import { SalesPage } from "./pages/SalesPage";
import { CashRegisterPage } from "./pages/CashRegisterPage";
import { UsersPage } from "./pages/UsersPage";
import { Button } from "./components/Panel";

const googleConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim());

export default function App() {
  const { user, signOut } = useAuth();
  const [page, setPage] = useState<PageKey>("dashboard");
  if (!user) return <LoginPage googleConfigured={googleConfigured} />;

  const pageTitle: Record<PageKey, string> = {
    dashboard: user.role === "admin" ? "Dashboard Admin" : "Dashboard Vendedor",
    sales: "Nueva Venta",
    inventory: "Inventario de Prendas",
    cash: "Cierre de Caja Diario",
    users: "Personal autorizado",
  };
  const content = {
    dashboard: <DashboardPage user={user} onNavigate={setPage} />,
    sales: <SalesPage onBack={() => setPage("dashboard")} />,
    inventory: <InventoryPage />,
    cash: <CashRegisterPage />,
    users: <UsersPage />,
  }[page];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="app-header sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto grid min-h-[76px] max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:px-6">
          <button type="button" onClick={() => setPage("dashboard")} className="flex items-center gap-2 justify-self-start text-left">
            <span className="brand-splash grid size-12 shrink-0 place-items-center rounded-full text-[9px] font-black leading-tight text-white">MODAS<br />JAYJO</span>
            <span className="hidden text-sm font-bold text-slate-950 sm:block">Modas Jayjo POS</span>
          </button>
          <h1 className="text-center text-base font-bold text-slate-950 sm:text-lg">{pageTitle[page]}</h1>
          <div className="flex items-center justify-self-end gap-2 rounded-full border border-amber-100 bg-orange-50 px-2 py-1.5 sm:gap-3 sm:pl-4">
            <div className="text-right">
              <p className="max-w-28 truncate text-xs font-medium text-slate-900 sm:max-w-40 sm:text-sm">Hola, {user.full_name.split(" ")[0]}</p>
              <p className="hidden text-[10px] capitalize text-slate-500 sm:block">{user.role === "admin" ? "Administrador" : "Vendedor"}</p>
            </div>
            <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-sky-100 text-sm font-bold text-slate-700 sm:size-11">{user.full_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
            <Button className="min-h-8 rounded-full px-3 py-1 text-xs" variant="secondary" onClick={signOut}>Salir</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{content}</main>
    </div>
  );
}
