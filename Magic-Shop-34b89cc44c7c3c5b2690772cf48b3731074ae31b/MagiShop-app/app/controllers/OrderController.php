<?php
class OrderController extends Controller {
	public function checkout(): void {
		$userId = AuthController::requireUserId();
		if (!$userId) { $this->json(['error' => 'Unauthorized'], 401); return; }
		$input = $this->requestBody();
		$db = Database::getConnection();
		$db->beginTransaction();
		try {
			// Compute total
			$itemsStmt = $db->prepare('SELECT ci.product_id, ci.quantity, p.price FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.user_id = ?');
			$itemsStmt->execute([$userId]);
			$items = $itemsStmt->fetchAll();
			if (!$items) { throw new Exception('Cart empty'); }
			$total = 0.0;
			foreach ($items as $i) { $total += (float)$i['price'] * (int)$i['quantity']; }

			// Create order
			$orderStmt = $db->prepare('INSERT INTO orders (user_id, status, total_amount, payment_method_id, shipping_address_id) VALUES (?, "PENDING", ?, ?, ?)');
			$orderStmt->execute([$userId, $total, $input['payment_method_id'] ?? null, $input['shipping_address_id'] ?? null]);
			$orderId = (int)$db->lastInsertId();

			// Items
			$itemIns = $db->prepare('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)');
			foreach ($items as $i) {
				$itemIns->execute([$orderId, (int)$i['product_id'], (int)$i['quantity'], (float)$i['price']]);
			}

			// Clear cart
			$clear = $db->prepare('DELETE FROM cart_items WHERE user_id = ?');
			$clear->execute([$userId]);

			$db->commit();
			$this->json(['order_id' => $orderId, 'status' => 'PENDING', 'total' => $total]);
		} catch (Throwable $e) {
			$db->rollBack();
			$this->json(['error' => 'Checkout failed', 'message' => $e->getMessage()], 400);
		}
	}

	public function myOrders(): void {
		$userId = AuthController::requireUserId();
		if (!$userId) { $this->json(['error' => 'Unauthorized'], 401); return; }
		$db = Database::getConnection();
		$stmt = $db->prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC');
		$stmt->execute([$userId]);
		$this->json(['orders' => $stmt->fetchAll()]);
	}
}
