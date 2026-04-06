import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import BottomNav from "@/components/BottomNav";
import Dashboard from "./pages/Dashboard";
import Gastos from "./pages/Gastos";
import Presupuesto from "./pages/Presupuesto";
import Suenos from "./pages/Suenos";
import Deudas from "./pages/Deudas";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppLayout() {
  const location = useLocation();
  const isAuth = location.pathname === "/auth";

  return (
    <>
      <main className="mx-auto min-h-screen max-w-lg">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/gastos" element={<Gastos />} />
          <Route path="/presupuesto" element={<Presupuesto />} />
          <Route path="/suenos" element={<Suenos />} />
          <Route path="/deudas" element={<Deudas />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!isAuth && <BottomNav />}
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
