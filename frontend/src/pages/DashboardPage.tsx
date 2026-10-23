import type { User } from "../api/types";

export type PageKey = "dashboard" | "sales" | "inventory" | "cash" | "users";

const modules: Array<{
  key: PageKey;
  icon: string;
  title: string;
  description: string;
  button: string;
  roles: User["role"][];
}> = [
  {
    key: "sales",
    icon: "🧾",
    title: "Nueva Venta (POS)",
    description: "Escanea prendas y procesa cobros.",
    button: "Iniciar Venta",
    roles: ["admin", "vendor"],
  },
  {
    key: "inventory",
    icon: "🗄️",
    title: "Inventario de Prendas",
    description: "Consultar stock y actualizar precios.",
    button: "Ver Inventario",
    roles: ["admin", "vendor"],
  },
  {
    key: "cash",
    icon: "💰",
    title: "Cierre de Caja Diario",
    description: "Consulta y registra el arqueo de efectivo.",
    button: "Realizar Arqueo",
    roles: ["admin"],
  },
  {
    key: "users",
    icon: "👥",
    title: "Personal Autorizado",
    description: "Administra cuentas y roles de acceso.",
    button: "Gestionar Personal",
    roles: ["admin"],
  },
];

export function DashboardPage({ user, onNavigate }: { user: User; onNavigate: (page: PageKey) => void }) {
  const visibleModules = modules.filter((module) => module.roles.includes(user.role));
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-7 text-center sm:mb-9">
        <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">¿Qué deseas hacer hoy?</h2>
        <p className="mt-2 text-base text-slate-700 sm:text-lg">Selecciona un módulo para comenzar</p>
      </header>
      <div className={`grid gap-5 ${visibleModules.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
        {visibleModules.map((module) => (
          <article key={module.key} className="flex min-h-56 flex-col items-center rounded-[2rem] border border-slate-300 bg-white px-5 py-5 text-center transition hover:shadow-lg">
            <span className="text-4xl" aria-hidden="true">{module.icon}</span>
            <h3 className="mt-2 text-lg font-medium text-slate-950">{module.title}</h3>
            <p className="mt-1 min-h-12 max-w-xs text-base leading-6 text-slate-700">{module.description}</p>
            <button
              type="button"
              onClick={() => onNavigate(module.key)}
              className="mt-auto min-h-10 w-full max-w-56 rounded-full border border-slate-900 bg-sky-200 px-5 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
            >
              {module.button}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
