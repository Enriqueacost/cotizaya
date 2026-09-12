import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { getCompany } from "../lib/storage";

export default function Layout({ children }: { children: React.ReactNode }) {
  const company = getCompany();
  const { cloudEnabled, user } = useAuth();
  const showNav = !cloudEnabled || !!user;
  // Targets táctiles ≥44px (guía touch-psychology): el header mide 56px
  const navLink = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-[44px] items-center rounded-full px-2 py-1 text-[13px] font-medium sm:px-3 sm:text-sm ${isActive ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100 active:bg-slate-200"}`;
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between gap-1 px-3 sm:px-4 md:max-w-3xl">
          <Link to="/nuevo" className="flex shrink-0 items-center gap-2">
            {company.logo ? (
              <img
                src={company.logo}
                alt="logo"
                className="h-8 w-8 rounded-lg object-cover ring-1 ring-slate-200"
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 font-black text-white">
                C
              </span>
            )}
            <span className="hidden text-lg font-extrabold tracking-tight min-[420px]:block">
              Cotiza<span className="text-emerald-600">Ya</span>
            </span>
          </Link>
          {showNav && (
            <nav className="flex shrink-0 items-center gap-0.5">
              <NavLink to="/nuevo" className={navLink}>
                Nuevo
              </NavLink>
              <NavLink to="/preview" className={navLink}>
                Vista
              </NavLink>
              <NavLink to="/historial" className={navLink}>
                Historial
              </NavLink>
              <NavLink
                to="/config"
                aria-label="Configuración"
                className={({ isActive }) =>
                  `inline-flex min-h-[44px] items-center rounded-full px-2 py-1 text-[13px] font-medium sm:px-3 sm:text-sm ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 active:bg-slate-200"}`
                }
              >
                ⚙️
              </NavLink>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-md px-4 pb-28 pt-4 md:max-w-3xl">
        {children}
      </main>
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[16px] outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export const labelCls =
  "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500";

export const cardCls = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
