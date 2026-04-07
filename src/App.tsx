import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import BottomNav from "@/components/BottomNav";
import Dashboard from "./pages/Dashboard";
import Gastos from "./pages/Gastos";
import Presupuesto from "./pages/Presupuesto";
import Suenos from "./pages/Suenos";
import Deudas from "./pages/Deudas";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";

const queryClient = new QueryClient();

function AppLayout() {
  const location = useLocation();
  const isAuthOrOnboarding = ["/auth", "/onboarding"].includes(location.pathname);

  return (
    <>
      <main className="mx-auto min-h-screen max-w-lg">
        <Routes>
          {/* Public routes */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/gastos" element={<Gastos />} />
            <Route path="/presupuesto" element={<Presupuesto />} />
            <Route path="/suenos" element={<Suenos />} />
            <Route path="/deudas" element={<Deudas />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!isAuthOrOnboarding && <BottomNav />}
    </>
  );
}

const App = () => (
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

export default App;
