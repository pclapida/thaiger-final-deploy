import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, ArrowLeft, Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Register() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const { register } = useAuth();

    const handleRegister = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            return toast.error('Las contraseñas no coinciden.');
        }

        try {
            setIsLoading(true);
            await register(email, password, name);

            toast.success('¡Cuenta creada con éxito!');
            navigate('/'); // Redirigimos al home tras el registro
        } catch (error) {
            if (error.message.includes('already registered') || error.message.includes('already in use')) {
                toast.error('El correo electrónico ya está registrado.');
            } else if (error.message.includes('Password should be') || error.message.includes('weak')) {
                toast.error('La contraseña debe tener al menos 6 caracteres.');
            } else {
                toast.error('Error al crear la cuenta.');
                console.error(error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden p-4">
            {/* Fondo Ambientado */}
            <div className="absolute inset-0 bg-[url('/banner.jpg')] bg-cover bg-center opacity-20 filter blur-sm"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 w-full max-w-md bg-[#111] border border-gray-800 p-8 rounded-sm shadow-[0_0_50px_rgba(234,88,12,0.1)]"
            >
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter mb-2">
                        Únete a <span className="text-orange-600">Thaiger</span>
                    </h2>
                    <p className="text-gray-400 text-sm">Crea tu cuenta y empieza tu transformación.</p>
                </div>

                <form className="space-y-5" onSubmit={handleRegister}>
                    {/* Nombre Completo */}
                    <div className="space-y-1">
                        <label className="text-xs uppercase font-bold text-gray-500 ml-1">Nombre Completo</label>
                        <div className="relative">
                            <User className="absolute left-4 top-3.5 text-gray-600 h-5 w-5" />
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Tu Nombre"
                                className="w-full bg-[#0A0A0A] border border-gray-800 text-white px-12 py-3 rounded-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-gray-700"
                                required
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1">
                        <label className="text-xs uppercase font-bold text-gray-500 ml-1">Correo Electrónico</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-3.5 text-gray-600 h-5 w-5" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="usuario@ejemplo.com"
                                className="w-full bg-[#0A0A0A] border border-gray-800 text-white px-12 py-3 rounded-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-gray-700"
                                required
                            />
                        </div>
                    </div>

                    {/* Contraseña */}
                    <div className="space-y-1">
                        <label className="text-xs uppercase font-bold text-gray-500 ml-1">Contraseña</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-3.5 text-gray-600 h-5 w-5" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-[#0A0A0A] border border-gray-800 text-white px-12 py-3 rounded-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-gray-700"
                                required
                            />
                        </div>
                    </div>

                    {/* Confirmar Contraseña */}
                    <div className="space-y-1">
                        <label className="text-xs uppercase font-bold text-gray-500 ml-1">Confirmar Contraseña</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-3.5 text-gray-600 h-5 w-5" />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-[#0A0A0A] border border-gray-800 text-white px-12 py-3 rounded-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-gray-700"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" disabled={isLoading} className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-black uppercase italic tracking-wider py-4 rounded-sm transition-all transform hover:-translate-y-1 hover:shadow-lg flex items-center justify-center gap-2 mt-4">
                        <UserPlus size={20} /> {isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
                    </button>
                </form>

                <div className="mt-8 pt-6 border-t border-gray-800 text-center">
                    <p className="text-gray-500 text-sm mb-4">¿Ya tienes cuenta?</p>
                    <Link to="/login" className="text-orange-500 font-bold uppercase text-sm hover:text-white transition-colors flex items-center justify-center gap-2">
                        <ArrowLeft size={16} /> Volver al Login
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}