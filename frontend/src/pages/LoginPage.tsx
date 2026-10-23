import { useState, type FormEvent } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../auth/AuthProvider";
import { Button, ErrorNotice, Field, Notice } from "../components/Panel";

export function LoginPage({ googleConfigured }: { googleConfigured: boolean }) {
  const {
    linkRequired,
    isWorking,
    error,
    signInWithGoogle,
    completeAccountLink,
    cancelAccountLink,
    clearError,
  } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submitLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();
    await completeAccountLink(username, password);
  };

  return (
    <main className="login-background grid min-h-screen place-items-center px-4 py-8">
      <div className="w-full max-w-6xl">
        <section className="login-card mx-auto flex min-h-[380px] w-full max-w-5xl flex-col items-center justify-center rounded-[2rem] border border-white bg-white/95 px-6 py-10 text-center sm:min-h-[430px] sm:px-12">
          <div className="brand-splash grid size-24 place-items-center rounded-full text-white">
            <span className="text-center text-sm font-black leading-tight">MODAS<br />JAYJO</span>
          </div>
          <h1 className="mt-6 text-4xl font-medium tracking-tight text-slate-900 sm:text-5xl">Bienvenido</h1>
          <p className="mt-1 text-base text-slate-600 sm:text-lg">Sistema de Inventario y Punto de Venta</p>
          <div className="mt-12 w-full max-w-md space-y-4">
            {error && <ErrorNotice error={error} />}
            {linkRequired ? (
              <form className="space-y-4" onSubmit={submitLink}>
                <Notice tone="info">Tu cuenta de Google todavía debe vincularse con la cuenta que el administrador creó para ti.</Notice>
                <Field label="Usuario de la tienda" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
                <Field label="Contraseña entregada por el administrador" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                <Button className="w-full rounded-full bg-sky-200 text-slate-900 hover:bg-sky-300" type="submit" disabled={isWorking}>{isWorking ? "Vinculando cuenta…" : "Vincular y continuar"}</Button>
                <Button className="w-full rounded-full" type="button" variant="secondary" onClick={cancelAccountLink}>Volver a Google</Button>
              </form>
            ) : googleConfigured ? (
              <div className="flex min-h-14 justify-center">
                {isWorking ? <p className="self-center text-sm text-slate-500">Validando tu cuenta…</p> : (
                  <GoogleLogin
                    text="continue_with"
                    shape="pill"
                    size="large"
                    width="420"
                    onSuccess={(credentialResponse) => {
                      if (credentialResponse.credential) void signInWithGoogle(credentialResponse.credential);
                    }}
                    onError={() => clearError()}
                  />
                )}
              </div>
            ) : (
              <Notice tone="info">Google Sign-In está pendiente de configuración. Define el client ID público en <code>frontend/.env</code>.</Notice>
            )}
          </div>
        </section>
        <p className="mt-5 px-2 text-xs italic text-slate-500">Acceso restringido a personal autorizado.</p>
      </div>
    </main>
  );
}
