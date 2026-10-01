import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import Login from './pages/Login';
import Register from './pages/Register';
import Events from './pages/Events';
import Seats from './pages/Seats';
import MyTickets from './pages/MyTickets';

function Nav() {
  const { token, logout } = useAuth();
  const nav = useNavigate();
  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          Flash<span className="text-indigo-400">Seat</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/" className="hover:text-indigo-300">
            Events
          </Link>
          {token ? (
            <>
              <Link to="/tickets" className="hover:text-indigo-300">
                My Tickets
              </Link>
              <button
                onClick={() => {
                  logout();
                  nav('/login');
                }}
                className="rounded border border-slate-700 px-3 py-1 hover:bg-slate-800"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-indigo-300">
                Login
              </Link>
              <Link
                to="/register"
                className="rounded bg-indigo-600 px-3 py-1 hover:bg-indigo-500"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Events />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/events/:id"
            element={
              <RequireAuth>
                <Seats />
              </RequireAuth>
            }
          />
          <Route
            path="/tickets"
            element={
              <RequireAuth>
                <MyTickets />
              </RequireAuth>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
