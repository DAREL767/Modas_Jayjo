import type { User } from "../api/types";
import type { DashboardSection } from "../pages/DashboardPage";
import logo from "../assets/logos/logo-empresa.png";
import profileIcon from "../assets/icons/icon-perfil.png";

export function WorkspaceHeader({ user, section, onSectionChange, onHome, onSignOut }: {
  user: User;
  section: DashboardSection;
  onSectionChange: (section: DashboardSection) => void;
  onHome: () => void;
  onSignOut: () => void;
}) {
  return <header className="workspace-header"><div className="workspace-header-inner">
    <button type="button" className="workspace-home" onClick={onHome} aria-label="Modas Jayjo POS · Ir al inicio">
      <img src={logo} alt="" /><div><strong>Modas Jayjo POS</strong><span>Inventario y punto de venta</span></div>
    </button>
    {user.role === "admin" && <nav className="workspace-nav" aria-label="Áreas de trabajo">
      <button type="button" aria-current={section === "operation" ? "page" : undefined} onClick={() => onSectionChange("operation")}>Operación</button>
      <button type="button" aria-current={section === "administration" ? "page" : undefined} onClick={() => onSectionChange("administration")}>Administración</button>
    </nav>}
    <div className="workspace-account">
      <div className="workspace-greeting"><div><strong>Hola, {user.full_name.trim().split(/\s+/)[0]}</strong><small>{user.role === "admin" ? "Administrador" : "Vendedor"}</small></div><img src={profileIcon} alt="" /></div>
      <button type="button" className="workspace-signout" onClick={onSignOut}>Salir</button>
    </div>
  </div></header>;
}
