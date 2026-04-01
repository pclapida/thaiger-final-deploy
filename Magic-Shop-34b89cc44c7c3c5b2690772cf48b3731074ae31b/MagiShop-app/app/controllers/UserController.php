<?php
class UserController extends Controller {
	public function me(): void {
		$userId = AuthController::requireUserId();
		if (!$userId) { $this->json(['error' => 'Unauthorized'], 401); return; }
		$db = Database::getConnection();
		$stmt = $db->prepare('SELECT id, email, username, first_name, last_name, birth_date, gender FROM users WHERE id = ?');
		$stmt->execute([$userId]);
		$this->json(['user' => $stmt->fetch()]);
	}

	public function updateProfile(): void {
		$userId = AuthController::requireUserId();
		if (!$userId) { $this->json(['error' => 'Unauthorized'], 401); return; }
		$input = $this->requestBody();
		$db = Database::getConnection();
		$stmt = $db->prepare('UPDATE users SET first_name = ?, last_name = ?, birth_date = ?, gender = ? WHERE id = ?');
		$stmt->execute([
			$input['first_name'] ?? null,
			$input['last_name'] ?? null,
			$input['birth_date'] ?? null,
			$input['gender'] ?? null,
			$userId
		]);
		$this->json(['ok' => true]);
	}
}
