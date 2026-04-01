-- ==========================================
-- SCRIPT DE CREACION: TABLA DE PEDIDOS Y RLS
-- ==========================================

DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;

-- TABLA DE PEDIDOS (ORDERS)
CREATE TABLE public.orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendiente', -- Ej: Pendiente, Pagado, Enviado, Entregado
    total NUMERIC NOT NULL,
    shipping_info JSONB,
    payment_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLA DE PRODUCTOS COMPRADOS (ORDER_ITEMS)
CREATE TABLE public.order_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
    product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price_at_purchase NUMERIC NOT NULL
);

-- HABILITAR SEGURIDAD (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- POLITICAS DE LECTURA Y ESCRITURA PARA CLIENTES REGULARES
CREATE POLICY "Usuarios ven sus propios pedidos" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuarios insertan sus pedidos" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuarios ven sus items" ON public.order_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Usuarios insertan items" ON public.order_items FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);

-- POLITICAS PARA EL ADMINISTRADOR (Para poder despachar los pedidos en Dashboard)
CREATE POLICY "Admins leen pedidos" ON public.orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);
CREATE POLICY "Admins actualizan pedidos" ON public.orders FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);
CREATE POLICY "Admins leen items" ON public.order_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
);
