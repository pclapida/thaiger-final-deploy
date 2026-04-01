# MagiShop

Stack: PHP (MVC), MySQL, React.

## Backend (XAMPP / Windows)
1. Create DB and tables:
   - Open phpMyAdmin and run `database/schema.sql` then `database/seed.sql`.
2. Configure environment:
   - Optionally set env vars (APP_BASE_URL, DB_*, JWT_SECRET) in Apache or system.
   - Defaults expect XAMPP: user `root`, no password.
3. Serve:
   - Place this repo under `C:\xampp\htdocs\MagiShop`.
   - Visit `http://localhost/MagiShop/public/` (API under `/public/api/...`).

## API endpoints (samples)
- POST `/public/api/auth/register` { email, username, password }
- POST `/public/api/auth/login` { identity, password }
- GET `/public/api/products`
- GET `/public/api/products/{id}`
- GET `/public/api/cart` (Bearer token)
- POST `/public/api/cart` { product_id, quantity } (Bearer)
- DELETE `/public/api/cart/{productId}` (Bearer)
- POST `/public/api/orders/checkout` (Bearer)
- POST `/public/api/ratings` { product_id, rating, comment? } (Bearer)

## Frontend (Vite)
```
cd frontend
npm i
npm run dev
```
Then open the shown URL. Update `AuthContext` base if your backend path differs.
