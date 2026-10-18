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
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,_#e6f0ff,_#f5f7fb_55%)] px-4 py-10">
      <section className="w-full max-w-xl rounded-[2rem] border border-white bg-white/95 p-7 shadow-[0_28px_90px_-42px_rgba(26,43,65,0.45)] sm:p-12">
        <div className="flex flex-col items-center text-center">
          <div className="grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-fuchsia-500 via-rose-400 to-amber-300 text-2xl font-black text-white shadow-lg shadow-rose-100">
            MJ
          </div>
          <p className="mt-3 text-sm font-bold tracking-[0.2em] text-slate-500">MODAS JAYJO</p>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">Bienvenido</h1>
          <p className="mt-2 text-base text-slate-500">Sistema de Inventario y Punto de Venta</p>
        </div>

        <div className="mx-auto mt-10 max-w-sm space-y-5">
          {error && <ErrorNotice error={error} />}

          {linkRequired ? (
            <form className="space-y-4" onSubmit={submitLink}>
              <Notice tone="info">
                Tu cuenta de Google todavía debe vincularse con la cuenta que el administrador creó para ti.
              </Notice>
              <Field
                label="Usuario de la tienda"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
              <Field
                label="Contraseña entregada por el administrador"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <Button className="w-full" type="submit" disabled={isWorking}>
                {isWorking ? "Vinculando cuenta…" : "Vincular y continuar"}
              </Button>
              <Button className="w-full" type="button" variant="secondary" onClick={cancelAccountLink}>
                Volver a Google
              </Button>
            </form>
          ) : googleConfigured ? (
            <div className="flex min-h-12 justify-center">
              {isWorking ? (
                <p className="self-center text-sm text-slate-500">Validando tu cuenta…</p>
              ) : (
                <GoogleLogin
                  text="continue_with"
                  shape="pill"
                  size="large"
                  width="340"
                  onSuccess={(credentialResponse) => {
                    if (credentialResponse.credential) {
                      void signInWithGoogle(credentialResponse.credential);
                    }
                  }}
                  onError={() => clearError()}
                />
              )}
            </div>
          ) : (
            <Notice tone="info">
              Google Sign-In está pendiente de configuración. Define el client ID público en <code>frontend/.env</code>.
            </Notice>
          )}
          <p className="text-center text-xs text-slate-400">Acceso restringido a personal autorizado.</p>
        </div>
      </section>
    </main>
  );
}
