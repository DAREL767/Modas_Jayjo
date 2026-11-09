import type { User } from "../api/types";
import saleIcon from "../assets/icons/icon-nueva-venta.png";
import inventoryIcon from "../assets/icons/icon-inventario.png";
import financeIcon from "../assets/icons/icon-finanzas.png";
import cashIcon from "../assets/icons/icon-cierre-caja.png";
import reportsIcon from "../assets/icons/icon-reportes.png";
import profileIcon from "../assets/icons/icon-perfil.png";
import "./dashboard.css";

export type PageKey = "dashboard" | "sales" | "inventory" | "cash" | "users" | "reports";
export type DashboardSection = "operation" | "administration";
type Module = { key: string; page?: PageKey; icon: string; title: string; description: string; button: string };
const operation: Module[] = [
  { key: "sales", page: "sales", icon: saleIcon, title: "Nueva Venta (POS)", description: "Escanea prendas y procesa cobros.", button: "Iniciar venta" },
  { key: "inventory", page: "inventory", icon: inventoryIcon, title: "Inventario de Prendas", description: "Consulta existencias y registra prendas.", button: "Ver inventario" },
];
const administration: Module[] = [
  { key: "finance", page: "inventory", icon: financeIcon, title: "Gestión y Finanzas", description: "Administra precios, costos y prendas del inventario.", button: "Administrar inventario" },
  { key: "cash", page: "cash", icon: cashIcon, title: "Cierre de Caja Diario", description: "Realiza el arqueo de efectivo y consulta los cierres del día.", button: "Realizar arqueo" },
  { key: "reports", page: "reports", icon: reportsIcon, title: "Reportes de Novedades", description: "Aprueba solicitudes y consulta el historial de cambios.", button: "Ver reportes" },
  { key: "users", page: "users", icon: profileIcon, title: "Personal Autorizado", description: "Gestiona las cuentas, los roles y el acceso del equipo.", button: "Gestionar personal" },
];

export function DashboardPage({ user, section = "operation", onNavigate }: {
  user: User; section?: DashboardSection; onNavigate: (page: PageKey) => void;
}) {
  const isAdministration = user.role === "admin" && section === "administration";
  const modules = isAdministration ? administration : operation;
  return <div className="dashboard">
    {isAdministration ? <>
      <section className="dashboard-metrics" aria-labelledby="metrics-title">
        <div className="dashboard-section-heading"><h2 id="metrics-title">Métricas del día</h2><span className="dashboard-coming-soon">Próximamente</span></div>
        <dl className="dashboard-metric-grid">
          {["Ventas totales", "Prendas vendidas", "Alertas de stock"].map((label) => <div key={label}><dt>{label}</dt><dd>—<span>Sin datos disponibles</span></dd></div>)}
        </dl>
      </section>
      <header className="dashboard-intro"><p className="dashboard-eyebrow">Administración</p><h2>Gestión del negocio</h2><p>Todo lo que necesitas para administrar tu tienda.</p></header>
    </> : <header className="dashboard-intro"><p className="dashboard-eyebrow">Tu tienda, en marcha</p><h2>¿Qué deseas hacer hoy?</h2><p>Selecciona un módulo para comenzar</p></header>}
    <div className={`dashboard-modules ${isAdministration ? "dashboard-modules-admin" : "dashboard-modules-operation"}`}>
      {modules.map((module) => <article className={`dashboard-module ${!module.page ? "dashboard-module-upcoming" : ""}`} key={module.key}>
        <img src={module.icon} alt="" className="dashboard-module-icon" />
        <h3>{module.title}</h3><p>{module.description}</p>
        <button type="button" className="dashboard-action" disabled={!module.page} onClick={() => { if (module.page) onNavigate(module.page); }}>{module.button}</button>
      </article>)}
    </div>
  </div>;
}
