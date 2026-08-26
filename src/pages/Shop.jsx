import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ProductCard from '../components/ProductCard';
import { SlidersHorizontal, X } from 'lucide-react';
import { products as productsApi } from '../services/api';
import {
    EMPTY_FILTERS,
    applyCatalogFilters,
    buildFilterGroups,
    filtersFromLocation,
    hasActiveFilters,
    includesLoose,
    toggleFilter,
} from '../lib/catalog';

export default function Shop() {
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('relevance');

    const [selectedFilters, setSelectedFilters] = useState(() => filtersFromLocation(location.state));

    // Si se llega a /shop otra vez con otra marca (desde Marcas o el buscador),
    // se re-sincronizan los filtros durante el render, sin efectos en cascada.
    const [lastNavigationKey, setLastNavigationKey] = useState(location.key);
    if (location.key !== lastNavigationKey) {
        setLastNavigationKey(location.key);
        setSelectedFilters(filtersFromLocation(location.state));
    }

    useEffect(() => {
        let active = true;

        productsApi
            .list()
            .then((list) => {
                if (active) setProducts(list);
            })
            .catch((error) => {
                console.error('No se pudo cargar el catálogo:', error);
                if (active) setProducts([]);
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const filterGroups = useMemo(() => buildFilterGroups(products), [products]);

    const handleFilterChange = (filterType, item) => {
        setSelectedFilters((prev) => toggleFilter(prev, filterType, item));
    };

    const filteredProducts = useMemo(
        () => applyCatalogFilters(products, selectedFilters, sortBy),
        [products, selectedFilters, sortBy]
    );

    const filtersActive = hasActiveFilters(selectedFilters);

    return (
        <div className="bg-[#0A0A0A] min-h-screen text-white">
            <Navbar />

            <div className="container mx-auto pt-32 px-4 pb-12">
                <h1 className="text-4xl font-extrabold mb-8 uppercase text-center text-orange-500 tracking-wider">
                    Catálogo Completo
                </h1>

                <div className="flex flex-col lg:flex-row gap-8">
                    <button
                        className="lg:hidden bg-gray-800 text-white p-3 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-700 transition-colors"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <SlidersHorizontal className="h-5 w-5" /> Filtrar Productos
                    </button>

                    {/* Fondo oscuro que cierra el panel de filtros en móvil */}
                    {isSidebarOpen && (
                        <div
                            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
                            onClick={() => setIsSidebarOpen(false)}
                        />
                    )}

                    <aside
                        className={`fixed lg:static top-0 left-0 h-full w-72 lg:w-72 bg-[#111] lg:bg-transparent shadow-2xl lg:shadow-none z-50 p-6 lg:p-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 overflow-y-auto`}
                    >
                        <div className="flex justify-between items-center mb-6 lg:hidden pt-2">
                            <h2 className="text-xl font-bold text-orange-500">Filtros</h2>
                            <button onClick={() => setIsSidebarOpen(false)} className="text-white hover:text-orange-500 p-2">
                                <X className="h-7 w-7" />
                            </button>
                        </div>

                        <div className="space-y-8">
                            {filterGroups.map((group) => (
                                <div key={group.id} className="border-b border-gray-800 pb-4">
                                    <h3 className="font-bold uppercase text-lg mb-3 tracking-wide">{group.title}</h3>
                                    <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                        {group.items.map((item) => (
                                            <li
                                                key={item}
                                                className="flex items-center text-sm text-gray-400 hover:text-orange-500 cursor-pointer transition-colors"
                                            >
                                                <input
                                                    type="checkbox"
                                                    id={`${group.id}-${item}`}
                                                    checked={includesLoose(selectedFilters[group.id], item)}
                                                    onChange={() => handleFilterChange(group.id, item)}
                                                    className="h-4 w-4 text-orange-600 bg-gray-900 border-gray-700 rounded focus:ring-orange-500 mr-2"
                                                />
                                                <label htmlFor={`${group.id}-${item}`} className="cursor-pointer flex-1">
                                                    {item}
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </aside>

                    <main className="flex-1">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                            <p className="text-gray-500 text-sm">
                                Mostrando {filteredProducts.length} de {products.length} productos.
                            </p>

                            <div className="flex items-center gap-4">
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="bg-gray-900 border border-gray-700 text-sm text-gray-300 rounded px-3 py-1.5 focus:outline-none focus:border-orange-500"
                                >
                                    <option value="relevance">Relevancia</option>
                                    <option value="price_asc">Precio: Menor a Mayor</option>
                                    <option value="price_desc">Precio: Mayor a Menor</option>
                                    <option value="name_asc">A - Z</option>
                                    <option value="name_desc">Z - A</option>
                                </select>

                                {filtersActive && (
                                    <button
                                        onClick={() => setSelectedFilters(EMPTY_FILTERS)}
                                        className="text-orange-500 text-sm hover:text-orange-400 underline"
                                    >
                                        Limpiar todos los filtros
                                    </button>
                                )}
                            </div>
                        </div>

                        {selectedFilters.search && (
                            <p className="text-sm text-gray-400 mb-6">
                                Resultados para <span className="text-orange-500 font-bold">“{selectedFilters.search}”</span>
                            </p>
                        )}

                        {loading ? (
                            <div className="text-center py-20 bg-[#111] rounded-xl border border-gray-800">
                                <h3 className="text-2xl font-bold text-orange-500 mb-2">Cargando catálogo...</h3>
                                <p className="text-gray-500">Estamos ordenando los suplementos para ti.</p>
                            </div>
                        ) : filteredProducts.length === 0 ? (
                            <div className="text-center py-20 bg-[#111] rounded-xl border border-gray-800">
                                <h3 className="text-2xl font-bold text-gray-400 mb-2">No se encontraron productos</h3>
                                <p className="text-gray-500">Intenta cambiar los filtros o la búsqueda.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                                {filteredProducts.map((product, index) => (
                                    <ProductCard key={product.id} product={product} delay={index % 4} />
                                ))}
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}
