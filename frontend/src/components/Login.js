import React, { useState, useEffect } from 'react';
import api from '../services/api';

const Login = ({ onLogin }) => {
    const [credentials, setCredentials] = useState({ email: '', password: '' });
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setMounted(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const handleChange = (e) => {
        setCredentials({ ...credentials, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await api.login(credentials);
            const user = response.user || response.usuario;
            const token = response.token || response.access_token;
            if (user && token) {
                onLogin(user, token, rememberMe);
            } else {
                throw new Error('Respuesta de sesion incompleta');
            }
        } catch (err) {
            setError(err.message || 'Error de conexion');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background-dark relative overflow-hidden font-body">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/8 rounded-full blur-[150px] animate-float"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-accent-teal/8 rounded-full blur-[150px] animate-float" style={{ animationDelay: '3s' }}></div>
                <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] bg-blue-600/5 rounded-full blur-[100px] animate-float" style={{ animationDelay: '1.5s' }}></div>

                {/* Grid pattern */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                    backgroundImage: 'linear-gradient(rgba(0,229,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.3) 1px, transparent 1px)',
                    backgroundSize: '60px 60px'
                }}></div>

                {/* Floating particles */}
                {[...Array(6)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-1 h-1 bg-primary/30 rounded-full animate-float"
                        style={{
                            left: `${15 + i * 15}%`,
                            top: `${20 + (i % 3) * 25}%`,
                            animationDelay: `${i * 0.8}s`,
                            animationDuration: `${4 + i}s`
                        }}
                    />
                ))}
            </div>

            <div className={`relative z-10 w-full max-w-md p-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <div className="bg-surface-dark/60 backdrop-blur-2xl border border-white/10 rounded-[32px] p-8 shadow-2xl relative overflow-hidden">
                    {/* Glow effect on card */}
                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-accent-teal/10 rounded-full blur-3xl pointer-events-none"></div>

                    <div className={`flex flex-col items-center mb-8 transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center shadow-neon mb-6 animate-glow">
                            <span className="material-icons-round text-background-dark text-3xl">science</span>
                        </div>
                        <h1 className="text-3xl font-display font-bold text-white tracking-tight">MedicCore AI</h1>
                        <p className="text-gray-400 text-sm mt-2 font-medium uppercase tracking-widest">Diagnostico Inteligente</p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl mb-6 text-sm flex items-center gap-3 animate-slide-up">
                            <span className="material-icons-round text-lg">error_outline</span>
                            {error}
                        </div>
                    )}

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <div className={`space-y-2 transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Credenciales</label>
                            <div className="relative group">
                                <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors text-xl">person</span>
                                <input
                                    type="text"
                                    name="email"
                                    value={credentials.email}
                                    onChange={handleChange}
                                    placeholder="Usuario o Correo"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all font-medium"
                                    required
                                />
                            </div>
                        </div>

                        <div className={`space-y-2 transition-all duration-700 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Clave de Seguridad</label>
                            <div className="relative group">
                                <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors text-xl">lock</span>
                                <input
                                    type="password"
                                    name="password"
                                    value={credentials.password}
                                    onChange={handleChange}
                                    placeholder="------------"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all font-medium"
                                    required
                                />
                            </div>
                        </div>

                        <div className={`flex items-center justify-between px-1 transition-all duration-700 delay-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-5 h-5 rounded-lg bg-white/5 border-white/10 text-primary focus:ring-0 focus:ring-offset-0 transition-all"
                                />
                                <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Recordarme</span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full bg-primary hover:bg-primary-dark text-background-dark font-bold py-4 rounded-2xl shadow-neon transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 duration-700 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-2 border-background-dark/30 border-t-background-dark rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    ACCEDER AL PORTAL
                                    <span className="material-icons-round text-lg">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </form>

                    <p className={`mt-8 text-center text-xs text-gray-600 font-medium transition-all duration-700 delay-700 ${mounted ? 'opacity-100' : 'opacity-0'}`}>
                        &copy; 2026 MedicCore AI Systems. <br />
                        Secure Transit SSL/TLS 1.3
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
