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
    dashboard: "Inicio",
    sales: "Punto de venta",
    inventory: "Inventario",
    cash: "Cierre de caja",
    users: "Personal",
  };
  const content = {
    dashboard: <DashboardPage user={user} onNavigate={setPage} />,
    sales: <SalesPage onReturnToDashboard={() => setPage("dashboard")} />,
    inventory: <InventoryPage />,
    cash: <CashRegisterPage />,
    users: <UsersPage />,
  }[page];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <button type="button" onClick={() => setPage("dashboard")} className="flex items-center gap-3 text-left">
            <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-rose-400 to-amber-300 text-sm font-black text-white">MJ</span>
            <span>
              <span className="block text-sm font-bold text-slate-900">Modas Jayjo</span>
              <span className="block text-xs text-slate-500">Inventario y POS</span>
            </span>
          </button>
          <h1 className="hidden text-base font-semibold text-slate-800 md:block">{pageTitle[page]}</h1>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-900">{user.full_name}</p>
              <p className="text-xs capitalize text-slate-500">{user.role}</p>
            </div>
            <Button variant="secondary" onClick={signOut}>Salir</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">{content}</main>
    </div>
  );
}
