import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ProductCard from '../components/ProductCard';
import { SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '../supabase';

const formatPrice = (price) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price);
};

export default function Shop() {
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [products, setProducts] = useState([]);
    const [filterCategories, setFilterCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedFilters, setSelectedFilters] = useState({
        category: [],
        brand: [],
        price: [],
        search: ''
    });
    const [sortBy, setSortBy] = useState('relevance');

    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            const { data, error } = await supabase.from('products').select('*');
            if (data) {
                setProducts(data);
                
                const uniqueCategories = [...new Set(data.filter(p => p.category).map(p => p.category))].sort();
                const uniqueBrands = [...new Set(data.filter(p => p.brand).map(p => p.brand))].sort();
                
                setFilterCategories([
                    { id: 'category', title: "Categorías", items: uniqueCategories },
                    { id: 'brand', title: "Marcas", items: uniqueBrands },
                    { id: 'price', title: "Precio", items: ["Hasta $500", "$500 - $1000", "+$1000"] },
                ]);
            }
            setLoading(false);
        };
        fetchProducts();
    }, []);

    useEffect(() => {
        if (location.state?.brand && products.length > 0) {
            // Find the actual casing in the data
            const actualBrand = [...new Set(products.map(p => p.brand))].find(
                b => b?.toLowerCase() === location.state.brand.toLowerCase()
            );

            setSelectedFilters(prev => ({
                ...prev,
                brand: actualBrand ? [actualBrand] : [location.state.brand]
            }));
            window.history.replaceState({}, document.title);
        }

        if (location.state?.search) {
            setSelectedFilters(prev => ({
                ...prev,
                search: location.state.search
            }));
            window.history.replaceState({}, document.title);
        }
    }, [location.state, products]);

    const handleFilterChange = (filterType, item) => {
        setSelectedFilters(prev => {
            const currentSelected = prev[filterType];
            if (currentSelected.includes(item)) {
                return { ...prev, [filterType]: currentSelected.filter(i => i !== item) };
            } else {
                return { ...prev, [filterType]: [...currentSelected, item] };
            }
        });
    };

    const filteredProducts = useMemo(() => {
        const result = products.filter(product => {
            const categoryMatch = selectedFilters.category.length === 0 || selectedFilters.category.includes(product.category);
            const brandMatch = selectedFilters.brand.length === 0 || 
                               selectedFilters.brand.some(b => b.toLowerCase() === (product.brand || "").toLowerCase());

            let priceMatch = selectedFilters.price.length === 0;
            if (selectedFilters.price.length > 0) {
                const p = product.price1;
                priceMatch = selectedFilters.price.some(range => {
                    if (range === "Hasta $500") return p <= 500;
                    if (range === "$500 - $1000") return p > 500 && p <= 1000;
                    if (range === "+$1000") return p > 1000;
                    return false;
                });
            }

            const searchTerms = selectedFilters.search.toLowerCase().split(' ').filter(t => t.trim() !== '');
            const searchMatch = searchTerms.length === 0 || searchTerms.every(term => 
                (product.name && product.name.toLowerCase().includes(term)) ||
                (product.brand && product.brand.toLowerCase().includes(term)) ||
                (product.category && product.category.toLowerCase().includes(term))
            );

            return categoryMatch && brandMatch && priceMatch && searchMatch;
        });

        switch (sortBy) {
            case 'price_asc':
                result.sort((a, b) => a.price1 - b.price1);
                break;
            case 'price_desc':
                result.sort((a, b) => b.price1 - a.price1);
                break;
            case 'name_asc':
                result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                break;
            case 'name_desc':
                result.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
                break;
            default:
                break;
        }

        return result;
    }, [selectedFilters, sortBy, products]);

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

                    {/* Overlay backdrop for mobile */}
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
                            {filterCategories.map((category) => (
                                <div key={category.id} className="border-b border-gray-800 pb-4">
                                    <h3 className="font-bold uppercase text-lg mb-3 tracking-wide">{category.title}</h3>
                                    <ul className="space-y-2">
                                        {category.items.map((item, i) => (
                                            <li key={i} className="flex items-center text-sm text-gray-400 hover:text-orange-500 cursor-pointer transition-colors">
                                                <input
                                                    type="checkbox"
                                                    id={`${category.id}-${item}`}
                                                    checked={selectedFilters[category.id].includes(item)}
                                                    onChange={() => handleFilterChange(category.id, item)}
                                                    className="h-4 w-4 text-orange-600 bg-gray-900 border-gray-700 rounded focus:ring-orange-500 mr-2"
                                                />
                                                <label htmlFor={`${category.id}-${item}`} className="cursor-pointer flex-1">{item}</label>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </aside>

                    <main className="flex-1">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                            <p className="text-gray-500 text-sm">Mostrando {filteredProducts.length} resultados.</p>

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

                                {(selectedFilters.category.length > 0 || selectedFilters.brand.length > 0 || selectedFilters.price.length > 0 || selectedFilters.search) && (
                                    <button
                                        onClick={() => setSelectedFilters({ category: [], brand: [], price: [], search: '' })}
                                        className="text-orange-500 text-sm hover:text-orange-400 underline"
                                    >
                                        Limpiar todos los filtros
                                    </button>
                                )}
                            </div>
                        </div>

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
                                    <ProductCard
                                        key={product.id}
                                        id={product.id}
                                        delay={index % 4}
                                        brand={product.brand}
                                        details={product.name}
                                        price={formatPrice(product.price1)}
                                        category={product.category}
                                        image={product.image_url}
                                        stock={product.stock}
                                    />
                                ))}
                            </div>
                        )}
                    </main>
                </div>
            </div>

        </div>
    );
}