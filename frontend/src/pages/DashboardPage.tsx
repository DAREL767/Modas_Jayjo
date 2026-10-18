import type { User } from "../api/types";

export type PageKey = "dashboard" | "sales" | "inventory" | "cash" | "users";

const modules: Array<{
  key: PageKey;
  icon: string;
  title: string;
  description: string;
  button: string;
  roles: User["role"][];
  accent: string;
}> = [
  {
    key: "sales",
    icon: "▣",
    title: "Nueva venta (POS)",
    description: "Busca prendas, arma el carrito y procesa el cobro.",
    button: "Iniciar venta",
    roles: ["admin", "vendor"],
    accent: "from-blue-50 to-white",
  },
  {
    key: "inventory",
    icon: "▤",
    title: "Inventario de prendas",
    description: "Consulta existencias, variantes y precios.",
    button: "Ver inventario",
    roles: ["admin", "vendor"],
    accent: "from-emerald-50 to-white",
  },
  {
    key: "cash",
    icon: "◷",
    title: "Cierre de caja",
    description: "Revisa la caja abierta y registra el conteo del turno.",
    button: "Abrir caja",
    roles: ["admin"],
    accent: "from-amber-50 to-white",
  },
  {
    key: "users",
    icon: "♙",
    title: "Personal autorizado",
    description: "Administra las cuentas y sus roles.",
    button: "Gestionar usuarios",
    roles: ["admin"],
    accent: "from-violet-50 to-white",
  },
];

export function DashboardPage({ user, onNavigate }: { user: User; onNavigate: (page: PageKey) => void }) {
  const visibleModules = modules.filter((module) => module.roles.includes(user.role));
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 text-center sm:mb-10">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Panel {user.role === "admin" ? "administrador" : "vendedor"}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">¿Qué deseas hacer hoy?</h1>
        <p className="mt-2 text-slate-500">Elige un módulo para comenzar.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:gap-6">
        {visibleModules.map((module) => (
          <article key={module.key} className={`rounded-3xl border border-slate-200 bg-gradient-to-br ${module.accent} p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-8`}>
            <div className="flex items-start justify-between gap-5">
              <div>
                <span className="text-3xl text-slate-700" aria-hidden="true">{module.icon}</span>
                <h2 className="mt-4 text-xl font-bold text-slate-900">{module.title}</h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">{module.description}</p>
              </div>
              <span className="hidden size-12 shrink-0 rounded-2xl border border-white/80 bg-white/80 sm:block" />
            </div>
            <button
              type="button"
              onClick={() => onNavigate(module.key)}
              className="mt-7 min-h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {module.button}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
