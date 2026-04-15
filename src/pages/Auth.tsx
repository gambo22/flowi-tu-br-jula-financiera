import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────

type Mode = "login" | "register";

// ─── Helpers ──────────────────────────────────────────────────────────

function getErrorMessage(code: string | undefined): string {
  switch (code) {
    case "invalid_credentials":
      return "El email o la contraseña no son correctos. ¿Lo intentamos de nuevo? 🙂";
    case "email_not_confirmed":
      return "Tu email aún no está confirmado. Revisa tu bandeja de entrada.";
    case "user_already_exists":
    case "23505":
      return "Ya existe una cuenta con ese email. ¿Quieres iniciar sesión?";
    case "weak_password":
      return "La contraseña debe tener al menos 6 caracteres.";
    case "over_email_send_rate_limit":
      return "Demasiados intentos. Espera un momento antes de volver a intentarlo.";
    default:
      return "Algo salió mal. Intenta de nuevo en un momento.";
  }
}

// ─── Component ────────────────────────────────────────────────────────

export default function Auth() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setError(getErrorMessage(error.code));
        } else {
          await refreshProfile();
          navigate(from, { replace: true });
        }
      } else {
        // Register
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
          setError(getErrorMessage(signUpError.code));
        } else if (data.user) {
          // Create profile row in users table
          await supabase.from("users").upsert({
            id: data.user.id,
            email: email,
            onboarding_complete: false,
          });

          if (data.session) {
            // Email confirmation disabled — user is logged in right away
            await refreshProfile();
            navigate("/onboarding", { replace: true });
          } else {
            // Email confirmation enabled — show message
            setSuccessMsg(
              "¡Cuenta creada! 🎉 Revisa tu email para confirmar tu cuenta y volver a ingresar."
            );
          }
        }
      }
    } catch {
      setError("Algo salió mal. Intenta de nuevo en un momento.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setError(null);
    setSuccessMsg(null);
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) return;
    setForgotLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setForgotLoading(false);
    if (error) {
      setError("No pudimos enviar el correo. Verificá el email ingresado.");
    } else {
      setForgotSent(true);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">

      {/* Background gradient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, #10B981 0%, transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full opacity-15"
        style={{ background: "radial-gradient(circle, #7C3AED 0%, transparent 70%)" }}
      />

      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
          <span className="text-3xl font-black text-white">F</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Flowi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu compañero de libertad financiera 🇬🇹
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-xl">

        {/* Mode tabs */}
        <div className="mb-6 flex rounded-xl bg-muted p-1">
          <button
            id="tab-login"
            type="button"
            onClick={() => mode !== "login" && switchMode()}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === "login"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Iniciar sesión
          </button>
          <button
            id="tab-register"
            type="button"
            onClick={() => mode !== "register" && switchMode()}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === "register"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label
              htmlFor="auth-email"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
              required
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="auth-password"
              className="mb-1.5 block text-sm font-medium text-foreground"
            >
              Contraseña
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {mode === "register" && (
              <p className="mt-1 text-xs text-muted-foreground">Mínimo 6 caracteres</p>
            )}
            {mode === "login" && (
              <div className="text-right mt-1">
                <button type="button" onClick={() => { setShowForgotPassword(true); setForgotEmail(email); setForgotSent(false); }}
                  className="text-xs text-primary hover:underline font-medium">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="animate-fade-in rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Success message */}
          {successMsg && (
            <div className="animate-fade-in rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
              <p className="text-sm text-primary">{successMsg}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            id="auth-submit"
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {mode === "login" ? "Entrando..." : "Creando cuenta..."}
              </span>
            ) : mode === "login" ? (
              "Entrar a Flowi"
            ) : (
              "Crear mi cuenta"
            )}
          </button>
        </form>

        {/* Footer link */}
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
          <button
            id="auth-switch-mode"
            type="button"
            onClick={switchMode}
            className="font-medium text-primary hover:underline"
          >
            {mode === "login" ? "Regístrate gratis" : "Inicia sesión"}
          </button>
        </p>
      </div>

      {/* Tagline footer */}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Flowi no te juzga. Te acompaña. 💚
      </p>

      {showForgotPassword && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
          <div className="animate-fade-in w-full max-w-sm rounded-2xl bg-card p-6 border border-border shadow-2xl">
            <h2 className="text-lg font-bold text-foreground mb-1">Recuperar contraseña</h2>
            <p className="text-sm text-muted-foreground mb-4">Te enviamos un link a tu correo para resetearla.</p>

            {!forgotSent ? (
              <>
                <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="tu@email.com" autoFocus
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground mb-4 focus:border-primary outline-none" />
                <div className="flex gap-3">
                  <button onClick={() => setShowForgotPassword(false)}
                    className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors">
                    Cancelar
                  </button>
                  <button onClick={handleForgotPassword} disabled={forgotLoading || !forgotEmail}
                    className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2">
                    {forgotLoading
                      ? <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      : "Enviar link"}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="text-4xl mb-3">📬</div>
                <p className="text-sm font-semibold text-foreground mb-1">¡Correo enviado!</p>
                <p className="text-xs text-muted-foreground mb-4">Revisá tu bandeja de entrada (y el spam por si acaso).</p>
                <button onClick={() => setShowForgotPassword(false)}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white">
                  Entendido
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
