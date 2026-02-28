import React, { useState, useEffect } from 'react';
import api from '../services/api';

const StatCard = ({ title, value, subtext, icon, colorClass, trend, delay }) => (
    <div
        className="bg-white dark:bg-surface-dark rounded-3xl p-6 glow-border shadow-lg dark:shadow-none flex flex-col justify-between h-44 group hover:-translate-y-1 transition-all duration-300 animate-slide-up"
        style={{ animationDelay: `${delay || 0}s` }}
    >
        <div className="flex justify-between items-start">
            <div className={`h-10 w-10 rounded-xl ${colorClass} flex items-center justify-center transition-transform group-hover:scale-110`}>
                <span className="material-icons-round text-lg">{icon}</span>
            </div>
            {trend && (
                <span className={`${trend.startsWith('+') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'} text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1`}>
                    <span className="material-icons-round text-[10px]">{trend.startsWith('+') ? 'arrow_upward' : 'arrow_downward'}</span> {trend}
                </span>
            )}
        </div>
        <div>
            <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{title}</p>
            <h3 className="text-3xl font-display font-bold text-gray-900 dark:text-white">{value}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtext}</p>
        </div>
    </div>
);

const SystemStatusItem = ({ label, status, icon, delay }) => {
    const statusConfig = {
        online: { color: 'bg-green-500', text: 'Activo', textColor: 'text-green-400' },
        offline: { color: 'bg-red-500', text: 'Inactivo', textColor: 'text-red-400' },
        warning: { color: 'bg-yellow-500', text: 'Alerta', textColor: 'text-yellow-400' },
        loading: { color: 'bg-gray-400 animate-pulse', text: 'Verificando...', textColor: 'text-gray-400' },
    };
    const cfg = statusConfig[status] || statusConfig.loading;

    return (
        <div className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all animate-slide-in-left" style={{ animationDelay: `${delay}s` }}>
            <div className="flex items-center gap-3">
                <span className="material-icons-round text-gray-400 dark:text-gray-500 text-lg">{icon}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
            </div>
            <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${cfg.color}`}></div>
                <span className={`text-xs font-semibold ${cfg.textColor}`}>{cfg.text}</span>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const [stats, setStats] = useState({ citasHoy: 0, estudiosRealizados: 0, ingresosHoy: 0, pacientesNuevos: 0 });
    const [citasHoy, setCitasHoy] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [user] = useState(JSON.parse(localStorage.getItem('user')) || {});
    const [systemStatus, setSystemStatus] = useState({
        api: 'loading', database: 'loading', orthanc: 'loading', whatsapp: 'loading'
    });

    const fetchDashboardData = async () => {
        setLoading(true);
        setError(null);
        try {
            const d = await api.getDashboardStats();
            if (d) setStats(prev => ({ ...prev, ...d }));
            const c = await api.getCitas({ fecha: new Date().toISOString().split('T')[0] });
            setCitasHoy(Array.isArray(c) ? c.slice(0, 6) : (c.data?.slice(0, 6) || []));
        } catch (err) {
            console.error('Dashboard error:', err);
            setError(err.isGatewayError || err.isNetworkError
                ? err.message
                : 'No se pudieron cargar los datos del dashboard.');
        } finally {
            setLoading(false);
        }
    };

    const checkSystemStatus = async () => {
        // Check API
        try {
            await api.getDashboardStats();
            setSystemStatus(prev => ({ ...prev, api: 'online', database: 'online' }));
        } catch {
            setSystemStatus(prev => ({ ...prev, api: 'offline', database: 'offline' }));
        }

        // Check Orthanc/DICOM
        try {
            const token = localStorage.getItem('token');
            const resp = await fetch('/api/imagenologia/estudios?estado=pendiente', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSystemStatus(prev => ({ ...prev, orthanc: resp.ok ? 'online' : 'warning' }));
        } catch {
            setSystemStatus(prev => ({ ...prev, orthanc: 'offline' }));
        }

        // Check WhatsApp
        try {
            const token = localStorage.getItem('token');
            const resp = await fetch('/api/whatsapp/status', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSystemStatus(prev => ({ ...prev, whatsapp: resp.ok ? 'online' : 'offline' }));
        } catch {
            setSystemStatus(prev => ({ ...prev, whatsapp: 'offline' }));
        }
    };

    useEffect(() => {
        fetchDashboardData();
        checkSystemStatus();
        const interval = setInterval(fetchDashboardData, 60000);
        const statusInterval = setInterval(checkSystemStatus, 120000);
        return () => { clearInterval(interval); clearInterval(statusInterval); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const hora = new Date().getHours();
    const saludo = hora < 12 ? 'Buenos dias' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
    const onlineCount = Object.values(systemStatus).filter(s => s === 'online').length;
    const totalSystems = Object.keys(systemStatus).length;

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-slide-up">
                <div>
                    <h2 className="text-3xl md:text-4xl font-display font-bold text-gray-900 dark:text-white mb-2">
                        {saludo}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent-teal">{user?.nombre?.split(' ')[0] || 'Doctor'}</span>
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 text-base flex items-center gap-2">
                        Panel de diagnostico inteligente
                        <span className="h-1 w-1 rounded-full bg-gray-400"></span>
                        <span className="text-primary font-mono text-sm uppercase">
                            {new Date().toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                    </p>
                </div>
                <button
                    onClick={() => { fetchDashboardData(); checkSystemStatus(); }}
                    className={`flex items-center justify-center h-12 w-12 rounded-full bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/10 shadow-lg text-gray-600 dark:text-primary transition-all duration-500 hover:scale-110 active:scale-95 hover:shadow-neon ${loading ? 'animate-spin' : ''}`}
                >
                    <span className="material-icons-round">refresh</span>
                </button>
            </div>

            {/* Connection Error Banner */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-4 flex items-start gap-3 animate-slide-up">
                    <span className="material-icons-round text-red-500 mt-0.5">cloud_off</span>
                    <div className="flex-1">
                        <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">Problema de conexion con el servidor</h4>
                        <p className="text-xs text-red-600 dark:text-red-300 mt-1">{error}</p>
                        <button
                            onClick={() => { fetchDashboardData(); checkSystemStatus(); }}
                            className="mt-2 text-xs font-medium text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100 underline underline-offset-2 flex items-center gap-1"
                        >
                            <span className="material-icons-round text-sm">refresh</span> Reintentar conexion
                        </button>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard
                    title="Citas Hoy"
                    value={loading ? '-' : stats.citasHoy}
                    subtext={`${citasHoy.length} en espera`}
                    icon="calendar_today"
                    colorClass="bg-blue-500/10 text-blue-500"
                    delay={0.1}
                />
                <StatCard
                    title="Resultados"
                    value={loading ? '-' : stats.estudiosRealizados}
                    subtext="Listos para revisar"
                    icon="science"
                    colorClass="bg-primary/10 text-primary"
                    delay={0.2}
                />
                <StatCard
                    title="Ingresos Hoy"
                    value={loading ? '-' : `$${(stats.ingresosHoy || 0).toLocaleString()}`}
                    subtext="Generados hoy"
                    icon="payments"
                    colorClass="bg-green-500/10 text-green-500"
                    delay={0.3}
                />
                <StatCard
                    title="Pacientes Nuevos"
                    value={loading ? '-' : stats.pacientesNuevos}
                    subtext="Registrados hoy"
                    icon="person_add"
                    colorClass="bg-purple-500/10 text-purple-500"
                    delay={0.4}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* System Status Card */}
                <div className="bg-white dark:bg-surface-dark rounded-3xl p-6 glow-border shadow-lg dark:shadow-none animate-slide-up" style={{ animationDelay: '0.3s' }}>
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                                <span className="material-icons-round text-indigo-400">dns</span>
                            </div>
                            <div>
                                <h3 className="text-base font-display font-bold text-gray-900 dark:text-white">Estado del Sistema</h3>
                                <p className="text-xs text-gray-400">{onlineCount}/{totalSystems} servicios activos</p>
                            </div>
                        </div>
                        <div className="relative flex items-center justify-center h-12 w-12">
                            <div className="absolute h-full w-full rounded-full border border-primary/20 pulse-circle" style={{ animationDelay: '0s' }}></div>
                            <div className="absolute h-3/4 w-3/4 rounded-full border border-primary/40 pulse-circle" style={{ animationDelay: '1s' }}></div>
                            <div className={`h-3 w-3 rounded-full ${onlineCount === totalSystems ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.8)]' : onlineCount > 0 ? 'bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.8)]' : 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)]'} z-10`}></div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <SystemStatusItem label="API Backend" status={systemStatus.api} icon="api" delay={0.4} />
                        <SystemStatusItem label="Base de Datos" status={systemStatus.database} icon="storage" delay={0.5} />
                        <SystemStatusItem label="DICOM / Imagenes" status={systemStatus.orthanc} icon="image" delay={0.6} />
                        <SystemStatusItem label="WhatsApp" status={systemStatus.whatsapp} icon="chat" delay={0.7} />
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">Ultima verificacion</span>
                            <span className="text-xs text-primary font-mono">{new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>
                </div>

                {/* Latest Patient Card */}
                <div className="lg:col-span-2 bg-white dark:bg-surface-dark rounded-3xl p-6 glow-border shadow-lg dark:shadow-none relative overflow-hidden animate-slide-up" style={{ animationDelay: '0.4s' }}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/5 to-transparent rounded-bl-full pointer-events-none"></div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-5">
                            <span className="px-3 py-1 bg-primary/20 text-primary text-xs font-bold rounded-full uppercase tracking-wider">Ultimo Ingreso</span>
                        </div>
                        {citasHoy.length > 0 ? (
                            <>
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary overflow-hidden">
                                        <span className="material-icons-round text-3xl">person</span>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-display font-bold text-gray-900 dark:text-white">
                                            {citasHoy[0].paciente?.nombre} {citasHoy[0].paciente?.apellido}
                                        </h3>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm">ID: #{citasHoy[0].paciente_id}</p>
                                        <div className="mt-2 flex gap-2 flex-wrap">
                                            <span className="text-xs font-mono bg-gray-100 dark:bg-white/5 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                                                {citasHoy[0].estudios?.[0]?.estudio?.nombre || 'Consulta'}
                                            </span>
                                            <span className="text-xs font-mono bg-primary/10 px-2 py-1 rounded text-primary uppercase">
                                                {citasHoy[0].estado}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl">
                                        <div className="text-gray-400 dark:text-gray-500 text-xs uppercase mb-1">Estado</div>
                                        <div className="text-lg font-bold text-gray-900 dark:text-white">Estable</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl">
                                        <div className="text-gray-400 dark:text-gray-500 text-xs uppercase mb-1">Prioridad</div>
                                        <div className="text-lg font-bold text-primary">Normal</div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="py-16 text-center">
                                <span className="material-icons-round text-5xl text-gray-300 dark:text-gray-600 mb-3 block">hourglass_empty</span>
                                <p className="text-gray-400 dark:text-gray-500">Esperando pacientes...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Patients Table */}
            <div className="bg-white dark:bg-surface-dark rounded-3xl shadow-lg dark:shadow-none overflow-hidden glow-border animate-slide-up" style={{ animationDelay: '0.5s' }}>
                <div className="px-6 py-5 flex items-center justify-between border-b border-gray-100 dark:border-white/5">
                    <h3 className="text-lg font-display font-bold text-gray-900 dark:text-white">Pacientes de Hoy</h3>
                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold">{citasHoy.length} activos</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-white/5">
                                <th className="px-6 py-4 font-medium bg-transparent">Paciente</th>
                                <th className="px-6 py-4 font-medium bg-transparent">Estudio</th>
                                <th className="px-6 py-4 font-medium bg-transparent">Estado</th>
                                <th className="px-6 py-4 font-medium text-right bg-transparent">Hora</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-100 dark:divide-white/5">
                            {citasHoy.map((cita, i) => (
                                <tr key={i} className="group hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors animate-slide-in-left" style={{ animationDelay: `${0.6 + i * 0.05}s` }}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                                                {(cita.paciente?.nombre || 'P')[0]}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-white">{cita.paciente?.nombre} {cita.paciente?.apellido}</p>
                                                <p className="text-xs text-gray-400 dark:text-gray-500">ID: {cita.paciente_id}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded text-xs bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">
                                            {cita.estudios?.[0]?.estudio?.nombre || 'General'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`h-2 w-2 rounded-full ${cita.estado === 'Completada' ? 'bg-green-500' : 'bg-primary animate-pulse'}`}></span>
                                            <span className={`${cita.estado === 'Completada' ? 'text-green-500' : 'text-primary'} text-xs font-semibold`}>
                                                {cita.estado}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-700 dark:text-gray-300 font-mono text-sm">{cita.horaInicio || '--:--'}</td>
                                </tr>
                            ))}
                            {citasHoy.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">
                                        <span className="material-icons-round text-3xl mb-2 block opacity-50">event_busy</span>
                                        No hay citas para hoy
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 flex justify-center">
                    <button
                        onClick={() => { window.location.href = '/consulta'; }}
                        className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary transition-colors flex items-center gap-1 group"
                    >
                        Ver todos los pacientes <span className="material-icons-round text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
