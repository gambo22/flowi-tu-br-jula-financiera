import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [income, setIncome] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Demo: skip to dashboard
    navigate("/");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-primary">Flowi</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tu compañero de libertad financiera 🇬🇹</p>
      </div>

      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Nombre</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Ingreso mensual (Q)</label>
                <Input type="number" value={income} onChange={(e) => setIncome(e.target.value)} placeholder="Ej: 12000" />
              </div>
            </>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Contraseña</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          <Button type="submit" className="w-full" size="lg">
            {isLogin ? "Iniciar sesión" : "Crear cuenta"}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-muted-foreground hover:text-primary"
          >
            {isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
          </button>
        </div>
      </div>
    </div>
  );
}
