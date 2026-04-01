USE magishop;

INSERT IGNORE INTO categories (id, name) VALUES (1,'Electrónica'), (2,'Moda');
INSERT IGNORE INTO brands (id, name) VALUES (1,'Acme'), (2,'Contoso');

INSERT INTO products (name, description, price, category_id, brand_id, image_url)
VALUES
 ('Auriculares Bluetooth', 'Sonido HD', 39.99, 1, 1, 'https://via.placeholder.com/300'),
 ('Camiseta Unisex', '100% algodón', 14.90, 2, 2, 'https://via.placeholder.com/300');
