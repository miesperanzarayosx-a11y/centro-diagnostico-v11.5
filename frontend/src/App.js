import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import './App.css';

import { FaHeartbeat } from 'react-icons/fa';

import api from './services/api';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import RegistroInteligente from './components/RegistroInteligente';
import Facturas from './components/Facturas';
import PortalMedico from './components/PortalMedico';
import AdminPanel from './components/AdminPanel';
import AdminUsuarios from './components/AdminUsuarios';
import GestionEstudios from './components/GestionEstudios';
import Resultados from './components/Resultados';
import ConsultaRapida from './components/ConsultaRapida';
import AdminEquipos from './components/AdminEquipos';
import Contabilidad from './components/Contabilidad';
import DeployAgentes from './components/DeployAgentes';
import DescargarApp from './components/DescargarApp';
import CampanaWhatsApp from './components/CampanaWhatsApp';
import Imagenologia from './components/Imagenologia';
import OfflineScreen from './components/OfflineScreen';

function App() {
  const [user, setUser] = useState(null);
  const [, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches));
  const [adminOpen, setAdminOpen] = useState(false);
  const [sidebarHover, setSidebarHover] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem('token') || sessionStorage.getItem('token');
    const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (savedToken && savedToken !== 'undefined' && savedUser && savedUser !== 'undefined') {
      try {
        const parsedUser = JSON.parse(savedUser);
        setToken(savedToken);
        setUser(parsedUser);
      } catch (e) {
        handleLogout();
      }
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = (u, t, persist = true) => {
    api.forceLogin(u, t, persist);
    setToken(t);
    setUser(u);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setUser(null);
    setToken(null);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background-dark">
      <div className="relative animate-scale-in">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping"></div>
        <FaHeartbeat className="text-6xl text-primary relative animate-pulse" />
      </div>
    </div>
  );

  const rol = user?.role || user?.rol || 'recepcion';
  const menuItems = [
    { path: '/', icon: 'dashboard', label: 'Dashboard', roles: ['admin', 'medico', 'recepcion', 'laboratorio'] },
    { path: '/registro', icon: 'person_add', label: 'Registro', roles: ['admin', 'recepcion'] },
    { path: '/consulta', icon: 'search', label: 'Consulta', roles: ['admin', 'recepcion', 'laboratorio'] },
    { path: '/facturas', icon: 'receipt_long', label: 'Facturas', roles: ['admin', 'recepcion'] },
    { path: '/medico', icon: 'medical_services', label: 'Médico', roles: ['admin', 'medico'] },
    { path: '/resultados', icon: 'science', label: 'Resultados', roles: ['admin', 'medico', 'laboratorio'] },
    { path: '/imagenologia', icon: 'settings_overscan', label: 'Imágenes', roles: ['admin', 'medico', 'laboratorio', 'recepcion'] },
  ];

  const filteredMenu = menuItems.filter(i => i.roles.includes(rol));
  const isAdmin = rol === 'admin';

  // Determine if sidebar should show expanded (hover on desktop or open on mobile)
  const sidebarExpanded = isMobile ? sidebarOpen : (sidebarOpen || sidebarHover);

  return (
    <OfflineScreen>
      <Router>
        <div className={`min-h-screen flex flex-col transition-colors duration-300 bg-background-light dark:bg-background-dark`}>
          {!user ? (
            <Login onLogin={handleLogin} />
          ) : (
            <>
              {/* Header */}
              <header className="sticky top-0 z-50 h-16 glass-header flex items-center justify-between px-4 lg:px-8 border-b border-gray-100 dark:border-white/5">
                <div className="flex items-center gap-4">
                  <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-xl h-10 w-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300 transition-all hover:scale-105 active:scale-95">
                    <span className="material-icons-round transition-transform duration-300" style={{ transform: sidebarOpen ? 'rotate(180deg)' : 'none' }}>
                      {sidebarOpen ? 'menu_open' : 'menu'}
                    </span>
                  </button>
                  <h1 className="text-lg font-display font-semibold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
                    <PageTitle />
                  </h1>
                </div>

                <div className="flex items-center gap-4">
                  <div className="hidden md:flex flex-col items-end">
                    <span className="text-[10px] text-primary font-bold uppercase tracking-widest">{rol}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{user.nombre}</span>
                  </div>

                  {/* Theme Toggle */}
                  <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-primary transition-all group hover:scale-105 active:scale-95">
                    <span className="material-icons-round text-xl group-hover:rotate-12 transition-transform">{darkMode ? 'light_mode' : 'dark_mode'}</span>
                  </button>

                  <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-primary to-accent-teal p-[1px] shadow-neon">
                    <div className="h-full w-full rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-xs font-bold dark:text-white text-slate-800">
                      {(user.nombre || 'U')[0].toUpperCase()}
                    </div>
                  </div>
                </div>
              </header>

              <div className="flex flex-1 overflow-hidden relative">
                {/* Mobile overlay */}
                {isMobile && sidebarOpen && (
                  <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
                )}

                {/* Sidebar - Fixed */}
                <aside
                  onMouseEnter={() => !isMobile && setSidebarHover(true)}
                  onMouseLeave={() => !isMobile && setSidebarHover(false)}
                  className={`fixed top-16 bottom-0 left-0 z-40 transition-all duration-300 ease-in-out bg-white dark:bg-surface-dark border-r border-gray-200 dark:border-white/5 flex flex-col overflow-hidden
                    ${sidebarExpanded ? 'w-64' : 'w-0 lg:w-20'}
                    ${isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
                  `}
                >
                  {/* Logo */}
                  <div className="p-4 flex items-center justify-center">
                    <div className={`h-12 w-12 bg-primary rounded-2xl flex items-center justify-center shadow-neon transition-all duration-300 ${sidebarExpanded ? 'animate-glow' : 'scale-90'}`}>
                      <span className="material-icons-round text-slate-900">medical_services</span>
                    </div>
                  </div>

                  {/* Nav */}
                  <nav className="flex-1 px-3 space-y-1 py-2 overflow-y-auto custom-scrollbar">
                    {filteredMenu.map((item, idx) => (
                      <NavLink
                        key={idx}
                        to={item.path}
                        end={item.path === '/'}
                        onClick={() => isMobile && setSidebarOpen(false)}
                        className={({ isActive }) => `
                          flex items-center gap-4 p-3 rounded-2xl transition-all duration-200 group relative animate-slide-in-left
                          ${isActive
                            ? 'bg-primary/10 text-primary shadow-inner-glow'
                            : 'text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-primary'}
                        `}
                        style={{ animationDelay: `${idx * 0.05}s` }}
                      >
                        <span className="material-icons-round transition-transform group-hover:scale-110 flex-shrink-0">{item.icon}</span>
                        <span className={`font-medium whitespace-nowrap transition-all duration-300 ${!sidebarExpanded ? 'opacity-0 w-0' : 'opacity-100'}`}>
                          {item.label}
                        </span>
                        {!sidebarExpanded && !isMobile && (
                          <div className="absolute left-full ml-4 px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-all whitespace-nowrap shadow-lg">
                            {item.label}
                          </div>
                        )}
                      </NavLink>
                    ))}

                    {/* Admin Submenu Section */}
                    {isAdmin && (
                      <div className="pt-2">
                        <button
                          onClick={() => setAdminOpen(!adminOpen)}
                          className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all group relative
                            ${adminOpen ? 'text-primary bg-primary/5' : 'text-slate-500 dark:text-gray-400 hover:text-primary hover:bg-slate-50 dark:hover:bg-white/5'}
                          `}
                        >
                          <div className="flex items-center gap-4">
                            <span className="material-icons-round flex-shrink-0">settings</span>
                            <span className={`font-medium whitespace-nowrap transition-all duration-300 ${!sidebarExpanded ? 'opacity-0 w-0' : 'opacity-100'}`}>Admin</span>
                          </div>
                          {sidebarExpanded && (
                            <span className={`material-icons-round text-sm transition-transform duration-300 ${adminOpen ? 'rotate-180' : ''}`}>expand_more</span>
                          )}
                        </button>

                        <div className={`overflow-hidden transition-all duration-300 ${adminOpen && sidebarExpanded ? 'max-h-64 mt-1 opacity-100' : 'max-h-0 opacity-0'}`}>
                          <div className="ml-9 space-y-1 border-l-2 border-primary/20 pl-3">
                            {[
                              { to: '/admin/usuarios', label: 'Usuarios' },
                              { to: '/admin/equipos', label: 'Equipos' },
                              { to: '/admin/estudios', label: 'Catalogo' },
                              { to: '/admin', label: 'Config' },
                            ].map((sub, i) => (
                              <NavLink
                                key={sub.to}
                                to={sub.to}
                                end={sub.to === '/admin'}
                                onClick={() => isMobile && setSidebarOpen(false)}
                                className={({ isActive }) => `block p-2 text-sm rounded-xl transition-all animate-slide-in-left ${isActive ? 'text-primary font-bold bg-primary/5' : 'text-slate-400 dark:text-gray-500 hover:text-primary'}`}
                                style={{ animationDelay: `${i * 0.05}s` }}
                              >
                                {sub.label}
                              </NavLink>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </nav>

                  {/* Logout */}
                  <div className="p-3 border-t border-gray-100 dark:border-white/5">
                    <button onClick={handleLogout} className="w-full flex items-center gap-4 p-3 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all group">
                      <span className="material-icons-round flex-shrink-0">logout</span>
                      <span className={`font-medium transition-all duration-300 ${!sidebarExpanded ? 'opacity-0 w-0' : 'opacity-100'}`}>Salir</span>
                    </button>
                  </div>
                </aside>

                {/* Main Content - with margin for sidebar */}
                <main className={`flex-1 overflow-y-auto p-4 lg:p-8 relative transition-all duration-300 ${isMobile ? 'ml-0' : (sidebarExpanded ? 'ml-64' : 'ml-20')}`}>
                  <div className="fixed top-20 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10"></div>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/dashboard" element={<Navigate to="/" />} />
                    <Route path="/registro" element={<RegistroInteligente />} />
                    <Route path="/consulta" element={<ConsultaRapida />} />
                    <Route path="/facturas" element={<Facturas />} />
                    <Route path="/medico" element={<PortalMedico />} />
                    <Route path="/admin" element={<AdminPanel />} />
                    <Route path="/admin/usuarios" element={<AdminUsuarios />} />
                    <Route path="/admin/equipos" element={<AdminEquipos />} />
                    <Route path="/admin/estudios" element={<GestionEstudios />} />
                    <Route path="/contabilidad" element={<Contabilidad />} />
                    <Route path="/resultados" element={<Resultados />} />
                    <Route path="/imagenologia" element={<Imagenologia />} />
                    <Route path="/deploy" element={<DeployAgentes />} />
                    <Route path="/descargar-app" element={<DescargarApp />} />
                    <Route path="/campana-whatsapp" element={<CampanaWhatsApp />} />
                    <Route path="/login" element={<Navigate to="/" />} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </main>
              </div>
            </>
          )}
          <div className="fixed bottom-2 right-4 text-[10px] font-mono text-slate-400 pointer-events-none opacity-50 z-[60]">
            v1.2.0-PREMIUM
          </div>
        </div>
      </Router>
    </OfflineScreen>
  );
}

/* Page title component */
function PageTitle() {
  const loc = useLocation();
  const titles = {
    '/': 'Dashboard',
    '/registro': 'Nuevo Registro',
    '/consulta': 'Consulta Rapida',
    '/facturas': 'Facturas',
    '/medico': 'Portal Medico',
    '/resultados': 'Resultados',
    '/imagenologia': 'Imagenologia',
    '/admin': 'Configuracion',
    '/admin/usuarios': 'Usuarios',
    '/admin/equipos': 'Equipos',
    '/admin/estudios': 'Catalogo de Estudios',
    '/contabilidad': 'Contabilidad',
    '/campana-whatsapp': 'Campanas WhatsApp',
    '/descargar-app': 'Descargar App',
    '/deploy': 'Deploy Agentes',
  };
  const title = titles[loc.pathname] || 'Sistema';
  return <span className="font-semibold text-gray-900 dark:text-white text-base">{title}</span>;
}

export default App;
