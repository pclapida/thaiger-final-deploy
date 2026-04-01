<?php
class RatingController extends Controller {
	public function create(): void {
		$userId = AuthController::requireUserId();
		if (!$userId) { $this->json(['error' => 'Unauthorized'], 401); return; }
		$input = $this->requestBody();
		if (!isset($input['product_id'], $input['rating'])) { $this->json(['error' => 'Missing fields'], 422); return; }
		$db = Database::getConnection();
		$stmt = $db->prepare('INSERT INTO ratings (user_id, product_id, rating, comment) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment)');
		$stmt->execute([$userId, (int)$input['product_id'], (int)$input['rating'], $input['comment'] ?? null]);
		$this->json(['ok' => true]);
	}
}
