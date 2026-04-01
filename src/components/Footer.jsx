import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Twitter, Mail, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-black border-t border-gray-900 pt-16 pb-8 text-center md:text-left font-sans text-gray-400">
      <div className="container mx-auto px-4">
        
        {/* GRID PRINCIPAL */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
           
           {/* COLUMNA 1: MARCA */}
           <div className="flex flex-col items-center md:items-start space-y-4">
              <Link to="/" className="group">
                  {/* Si tienes imagen usa <img>, si no texto estilizado */}
                  <div className="flex items-center gap-2">
                     <img src="/logo.png" alt="TH" className="h-12 object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
                     <span className="text-2xl font-black italic tracking-tighter text-white group-hover:text-orange-500 transition-colors md:hidden">THAIGER</span>
                  </div>
              </Link>
              <p className="text-xs max-w-xs leading-relaxed">
                Suplementación deportiva de alto rendimiento para atletas que rompen límites. #BeThaiger
              </p>
              <p className="text-xs text-gray-600">© 2025 Thaiger Supplements</p>
           </div>

           {/* COLUMNA 2: ATENCIÓN AL CLIENTE (Links Funcionales) */}
           <div>
              <h4 className="font-bold text-white mb-6 uppercase text-sm tracking-widest border-b border-orange-600/30 pb-2 inline-block">
                  Atención
              </h4>
              <ul className="text-sm space-y-3 font-medium">
                 <li>
                    <Link to="/shop" className="hover:text-orange-500 hover:pl-2 transition-all duration-300 block">
                       Realizar Pedido
                    </Link>
                 </li>
                 <li>
                    <Link to="/profile" className="hover:text-orange-500 hover:pl-2 transition-all duration-300 block">
                       Rastrear Envío
                    </Link>
                 </li>
                 <li>
                    <Link to="/cart" className="hover:text-orange-500 hover:pl-2 transition-all duration-300 block">
                       Métodos de Pago
                    </Link>
                 </li>
                 <li>
                    <Link to="/profile" className="hover:text-orange-500 hover:pl-2 transition-all duration-300 block">
                       Mi Cuenta
                    </Link>
                 </li>
              </ul>
           </div>

           {/* COLUMNA 3: SOCIAL */}
           <div className="flex flex-col items-center md:items-start">
                <h4 className="font-bold text-white mb-6 uppercase text-sm tracking-widest border-b border-orange-600/30 pb-2 inline-block">
                    Comunidad
                </h4>
                <div className="flex gap-6 mb-6">
                   <a href="#" className="p-2 bg-gray-900 rounded-sm hover:bg-orange-600 hover:text-white transition-all transform hover:-translate-y-1">
                      <Facebook size={20} />
                   </a>
                   <a href="#" className="p-2 bg-gray-900 rounded-sm hover:bg-orange-600 hover:text-white transition-all transform hover:-translate-y-1">
                      <Instagram size={20} />
                   </a>
                   <a href="#" className="p-2 bg-gray-900 rounded-sm hover:bg-orange-600 hover:text-white transition-all transform hover:-translate-y-1">
                      <Twitter size={20} />
                   </a>
                </div>
                <a 
                   href="mailto:soporte@thaigersupplements.com" 
                   className="text-xs uppercase font-bold border border-gray-700 px-6 py-3 hover:border-orange-500 hover:text-orange-500 transition-colors tracking-wider inline-block mt-2"
                >
                    Contactar Soporte
                </a>
           </div>

            {/* COLUMNA 4: NOSOTROS / INFO */}
             <div>
              <h4 className="font-bold text-white mb-6 uppercase text-sm tracking-widest border-b border-orange-600/30 pb-2 inline-block">
                  Thaiger
              </h4>
              <ul className="text-sm space-y-3 font-medium">
                 <li>
                    <Link to="/about" className="hover:text-orange-500 hover:pl-2 transition-all duration-300 block">
                       Quiénes somos
                    </Link>
                 </li>
                 <li>
                    <Link to="/wholesale" className="hover:text-orange-500 hover:pl-2 transition-all duration-300 block">
                       Venta de Mayoreo
                    </Link>
                 </li>
                 <li>
                    <Link to="/refunds" className="hover:text-orange-500 hover:pl-2 transition-all duration-300 block">
                       Política de Reembolsos
                    </Link>
                 </li>
                 <li>
                    <Link to="/terms" className="hover:text-orange-500 hover:pl-2 transition-all duration-300 block">Términos y Condiciones</Link>
                 </li>
                 <li className="flex items-start gap-2 text-xs text-gray-500 mt-4">
                    <MapPin size={14} className="shrink-0 mt-1 text-orange-900" />
                    <span>Envíos a toda la República Mexicana</span>
                 </li>
              </ul>
           </div>
        </div>
      </div>
      
      {/* BARRA INFERIOR */}
      <div className="border-t border-gray-900 mt-8 pt-8 text-center text-[10px] text-gray-700 uppercase tracking-widest">
         Designed by Thaiger Devs • 2025
      </div>
    </footer>
  );
}