import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
  useLocation,
} from "react-router-dom";
import Layout from "./components/Layout";
import { AuthProvider, useAuth } from "./lib/auth";
import { cardCls } from "./components/Layout";
import Config from "./pages/Config";
import History from "./pages/History";
import Login from "./pages/Login";
import Preview from "./pages/Preview";
import QuoteForm from "./pages/QuoteForm";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { cloudEnabled, user, ready } = useAuth();
  if (!cloudEnabled) return <>{children}</>; // modo 100% local
  if (!ready) {
    return (
      <div className={cardCls + " mt-8 text-center"}>
        <p className="font-bold">Cargando...</p>
        <p className="mt-1 text-sm text-slate-500">Conectando con tu nube ☁️</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Redirige a /nuevo conservando el hash/search (tokens del magic link). */
function RootRedirect() {
  const loc = useLocation();
  return (
    <Navigate
      to={{ pathname: "/nuevo", hash: loc.hash, search: loc.search }}
      replace
    />
  );
}

function Shell() {
  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
        <Route
          path="/config"
          element={
            <RequireAuth>
              <Config />
            </RequireAuth>
          }
        />
        <Route
          path="/nuevo"
          element={
            <RequireAuth>
              <QuoteForm />
            </RequireAuth>
          }
        />
        <Route
          path="/preview"
          element={
            <RequireAuth>
              <Preview />
            </RequireAuth>
          }
        />
        <Route
          path="/historial"
          element={
            <RequireAuth>
              <History />
            </RequireAuth>
          }
        />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </Router>
  );
}
