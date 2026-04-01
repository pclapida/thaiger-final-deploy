<?php
class ProductController extends Controller {
	public function index(): void {
		$db = Database::getConnection();
		$rows = $db->query('SELECT id, name, price, category_id, brand_id, image_url, is_available, avg_rating FROM products_view ORDER BY id DESC LIMIT 100')->fetchAll();
		$this->json(['products' => $rows]);
	}

	public function show(int $id): void {
		$db = Database::getConnection();
		$stmt = $db->prepare('SELECT * FROM products_view WHERE id = ?');
		$stmt->execute([$id]);
		$product = $stmt->fetch();
		if (!$product) { $this->json(['error' => 'Not found'], 404); return; }
		$ratings = $db->prepare('SELECT r.id, r.user_id, r.rating, r.comment, r.created_at, u.username FROM ratings r JOIN users u ON u.id = r.user_id WHERE r.product_id = ? ORDER BY r.created_at DESC');
		$ratings->execute([$id]);
		$this->json(['product' => $product, 'ratings' => $ratings->fetchAll()]);
	}
}
