import React, { lazy, Suspense, useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import BottomNav from "@/components/BottomNav";
import { usePlan } from "@/hooks/usePlan";
import { PaywallModal } from "@/components/PaywallModal";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Gastos = lazy(() => import("./pages/Gastos"));
const Presupuesto = lazy(() => import("./pages/Presupuesto"));
const Suenos = lazy(() => import("./pages/Suenos"));
const Deudas = lazy(() => import("./pages/Deudas"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Analisis = lazy(() => import("./pages/Analisis"));
const Ahorro = lazy(() => import("./pages/Ahorro"));

const FlowiSplash = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#10B981',
    gap: '12px',
  }}>
    <div style={{ color: 'white', fontSize: '32px', fontWeight: '800', letterSpacing: '-0.5px' }}>
      Flowi
    </div>
    <div style={{
      width: '32px',
      height: '32px',
      border: '3px solid rgba(255,255,255,0.3)',
      borderTop: '3px solid white',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const queryClient = new QueryClient();

function PremiumRoute({ children, feature }: { children: React.ReactNode, feature: string }) {
  const { isPremium, loading } = usePlan()
  const [showPaywall, setShowPaywall] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !isPremium) {
      setShowPaywall(true)
    }
  }, [loading, isPremium])

  if (loading) return null

  if (!isPremium) return (
    <>
      {showPaywall && (
        <PaywallModal
          feature={feature}
          onClose={() => navigate('/')}
        />
      )}
    </>
  )

  return <>{children}</>
}

function AppLayout() {
  const location = useLocation();
  const isAuthOrOnboarding = ["/auth", "/onboarding"].includes(location.pathname);

  return (
    <>
      <main className="mx-auto min-h-screen max-w-lg">
        <Suspense fallback={<FlowiSplash />}>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/gastos" element={<Gastos />} />
              <Route path="/presupuesto" element={<Presupuesto />} />
              <Route path="/suenos" element={<PremiumRoute feature="Sueños"><Suenos /></PremiumRoute>} />
              <Route path="/deudas" element={<PremiumRoute feature="Deudas"><Deudas /></PremiumRoute>} />
              <Route path="/analisis" element={<PremiumRoute feature="Análisis"><Analisis /></PremiumRoute>} />
              <Route path="/ahorro" element={<PremiumRoute feature="Mi Ahorro"><Ahorro /></PremiumRoute>} />
              <Route path="/perfil" element={<Perfil />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      {!isAuthOrOnboarding && <BottomNav />}
    </>
  );
}

const App = () => {
  // Theme initializer
  React.useEffect(() => {
    const isDark = localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppLayout />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
