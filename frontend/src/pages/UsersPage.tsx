import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api/endpoints";
import type { User, UserCreate, UserRole } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { Button, ErrorNotice, Field, Notice, Panel } from "../components/Panel";

const emptyUser: UserCreate = { username: "", email: "", full_name: "", password: "", role: "vendor" };

export function UsersPage() {
  const { accessToken, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [draft, setDraft] = useState<UserCreate>(emptyUser);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true); setError(null);
    try { setUsers(await api.users(accessToken)); }
    catch (caught) { setError(caught); }
    finally { setLoading(false); }
  }, [accessToken]);
  useEffect(() => { void reload(); }, [reload]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) return;
    setWorking(true); setError(null); setNotice("");
    try {
      await api.createUser(accessToken, draft);
      setDraft(emptyUser); setNotice("La cuenta fue creada. El usuario podrá vincular su cuenta de Google al iniciar sesión.");
      await reload();
    } catch (caught) { setError(caught); }
    finally { setWorking(false); }
  };

  const setRole = async (member: User, role: UserRole) => {
    if (!accessToken || member.id === currentUser?.id) return;
    setWorking(true); setError(null); setNotice("");
    try { await api.updateUser(accessToken, member.id, { role }); setNotice(`Rol actualizado para ${member.full_name}.`); await reload(); }
    catch (caught) { setError(caught); }
    finally { setWorking(false); }
  };

  const deactivate = async (member: User) => {
    if (!accessToken || member.id === currentUser?.id || !window.confirm(`¿Desactivar la cuenta de ${member.full_name}?`)) return;
    setWorking(true); setError(null); setNotice("");
    try { await api.deactivateUser(accessToken, member.id); setNotice(`La cuenta de ${member.full_name} fue desactivada.`); await reload(); }
    catch (caught) { setError(caught); }
    finally { setWorking(false); }
  };

  return <div className="space-y-6">
    <Panel title="Personal autorizado" description="Administra las cuentas locales que pueden vincularse con Google.">
      <div className="space-y-4">
        {error !== null && <ErrorNotice error={error} />}{notice && <Notice tone="success">{notice}</Notice>}
        {loading ? <p className="py-8 text-center text-sm text-slate-500">Cargando personal…</p> : users.length === 0 ? <p className="rounded-2xl bg-slate-50 py-8 text-center text-sm text-slate-500">No hay cuentas registradas.</p> : <div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Persona</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Rol</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Acciones</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{users.map((member) => {
            const isSelf = member.id === currentUser?.id;
            return <tr key={member.id} className={!member.is_active ? "bg-slate-50 text-slate-400" : ""}>
              <td className="px-4 py-3"><p className="font-semibold text-slate-900">{member.full_name}{isSelf && <span className="ml-2 text-xs text-blue-600">Tú</span>}</p><p className="text-xs text-slate-500">{member.email}</p></td>
              <td className="px-4 py-3 font-mono text-xs">{member.username}</td>
              <td className="px-4 py-3"><select aria-label={`Rol de ${member.full_name}`} disabled={working || isSelf || !member.is_active} value={member.role} onChange={(event) => void setRole(member, event.target.value as UserRole)} className="min-h-9 rounded-lg border border-slate-200 bg-white px-2"><option value="admin">Administrador</option><option value="vendor">Vendedor</option></select></td>
              <td className="px-4 py-3">{member.is_active ? "Activa" : "Inactiva"}</td>
              <td className="px-4 py-3">{member.is_active && <Button variant="danger" className="min-h-9 px-3 text-xs" disabled={working || isSelf} onClick={() => void deactivate(member)}>{isSelf ? "Cuenta actual" : "Desactivar"}</Button>}</td>
            </tr>;
          })}</tbody>
        </table></div>}
        <Button variant="secondary" onClick={() => void reload()}>Actualizar lista</Button>
      </div>
    </Panel>
    <Panel title="Crear cuenta" description="La contraseña inicial se almacena únicamente en el backend como hash. Compártela por un canal seguro.">
      <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={create}>
        <Field label="Nombre completo" value={draft.full_name} maxLength={120} onChange={(event) => setDraft({ ...draft, full_name: event.target.value })} required />
        <Field label="Usuario" value={draft.username} minLength={3} maxLength={64} autoComplete="off" onChange={(event) => setDraft({ ...draft, username: event.target.value })} required />
        <Field label="Correo autorizado" type="email" value={draft.email} maxLength={254} onChange={(event) => setDraft({ ...draft, email: event.target.value })} required />
        <Field label="Contraseña inicial" type="password" value={draft.password} minLength={8} autoComplete="new-password" onChange={(event) => setDraft({ ...draft, password: event.target.value })} required />
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">Rol<select className="min-h-11 rounded-xl border border-slate-200 bg-white px-3.5" value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as UserRole })}><option value="vendor">Vendedor</option><option value="admin">Administrador</option></select></label>
        <div className="flex items-end"><Button type="submit" disabled={working}>{working ? "Creando…" : "Crear cuenta"}</Button></div>
      </form>
    </Panel>
  </div>;
}
