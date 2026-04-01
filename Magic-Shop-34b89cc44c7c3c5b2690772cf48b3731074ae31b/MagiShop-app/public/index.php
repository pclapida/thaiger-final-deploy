<?php
// Autoload lightweight (classmap)
spl_autoload_register(function ($class) {
	$paths = [__DIR__ . '/../app/core/' . $class . '.php', __DIR__ . '/../app/controllers/' . $class . '.php', __DIR__ . '/../app/models/' . $class . '.php'];
	foreach ($paths as $path) {
		if (file_exists($path)) { require_once $path; return; }
	}
});

$router = new Router();

// Controllers
$auth = new AuthController();
$product = new ProductController();
$cart = new CartController();
$order = new OrderController();
$rating = new RatingController();
$user = new UserController();

// Auth
$router->add('POST', '/MagiShop/public/api/auth/register', fn() => $auth->register());
$router->add('POST', '/MagiShop/public/api/auth/login', fn() => $auth->login());

// Users
$router->add('GET', '/MagiShop/public/api/users/me', fn() => $user->me());
$router->add('PUT', '/MagiShop/public/api/users/profile', fn() => $user->updateProfile());

// Products
$router->add('GET', '/MagiShop/public/api/products', fn() => $product->index());
$router->add('GET', '/MagiShop/public/api/products/{id}', fn($id) => $product->show((int)$id));

// Cart
$router->add('GET', '/MagiShop/public/api/cart', fn() => $cart->getCart());
$router->add('POST', '/MagiShop/public/api/cart', fn() => $cart->add());
$router->add('DELETE', '/MagiShop/public/api/cart/{productId}', fn($pid) => $cart->remove((int)$pid));

// Orders
$router->add('POST', '/MagiShop/public/api/orders/checkout', fn() => $order->checkout());
$router->add('GET', '/MagiShop/public/api/orders', fn() => $order->myOrders());

// Ratings
$router->add('POST', '/MagiShop/public/api/ratings', fn() => $rating->create());

// Dispatch
$router->dispatch($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI']);
