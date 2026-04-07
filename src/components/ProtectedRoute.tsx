import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // Show nothing while session is being resolved
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Cargando Flowi...</p>
        </div>
      </div>
    );
  }

  // Not authenticated → go to login
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Authenticated but onboarding not done → go to onboarding
  // (profile null = row not created yet = also needs onboarding)
  if (profile !== null && profile.onboarding_complete === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
