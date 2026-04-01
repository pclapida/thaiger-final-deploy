<?php
class CartController extends Controller {
	public function getCart(): void {
		$userId = AuthController::requireUserId();
		if (!$userId) { $this->json(['error' => 'Unauthorized'], 401); return; }
		$db = Database::getConnection();
		$stmt = $db->prepare('SELECT ci.product_id, p.name, p.price, ci.quantity, (p.price * ci.quantity) AS line_total FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.user_id = ?');
		$stmt->execute([$userId]);
		$items = $stmt->fetchAll();
		$total = array_sum(array_map(fn($i) => (float)$i['line_total'], $items));
		$this->json(['items' => $items, 'total' => $total]);
	}

	public function add(): void {
		$userId = AuthController::requireUserId();
		if (!$userId) { $this->json(['error' => 'Unauthorized'], 401); return; }
		$input = $this->requestBody();
		$db = Database::getConnection();
		$stmt = $db->prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)');
		$stmt->execute([$userId, (int)($input['product_id'] ?? 0), (int)($input['quantity'] ?? 1)]);
		$this->getCart();
	}

	public function remove(int $productId): void {
		$userId = AuthController::requireUserId();
		if (!$userId) { $this->json(['error' => 'Unauthorized'], 401); return; }
		$db = Database::getConnection();
		$stmt = $db->prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?');
		$stmt->execute([$userId, $productId]);
		$this->getCart();
	}
}
