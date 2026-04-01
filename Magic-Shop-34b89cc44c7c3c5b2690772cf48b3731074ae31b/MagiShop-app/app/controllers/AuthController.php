<?php
class AuthController extends Controller {
	public function register(): void {
		$input = $this->requestBody();
		$db = Database::getConnection();
		if (!isset($input['email'], $input['password'], $input['username'])) {
			$this->json(['error' => 'Missing fields'], 422); return;
		}
		$hash = password_hash($input['password'], PASSWORD_BCRYPT);
		$stmt = $db->prepare('INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)');
		try {
			$stmt->execute([$input['email'], $input['username'], $hash]);
			$userId = (int)$db->lastInsertId();
			$this->json(['token' => $this->tokenFor($userId)]);
		} catch (PDOException $e) {
			$this->json(['error' => 'Email or username already exists'], 409);
		}
	}

	public function login(): void {
		$input = $this->requestBody();
		$db = Database::getConnection();
		$stmt = $db->prepare('SELECT id, password_hash FROM users WHERE email = ? OR username = ? LIMIT 1');
		$stmt->execute([$input['identity'] ?? '', $input['identity'] ?? '']);
		$user = $stmt->fetch();
		if (!$user || !password_verify($input['password'] ?? '', $user['password_hash'])) {
			$this->json(['error' => 'Invalid credentials'], 401); return;
		}
		$this->json(['token' => $this->tokenFor((int)$user['id'])]);
	}

	private function tokenFor(int $userId): string {
		$payload = ['uid' => $userId, 'iat' => time()];
		return base64_encode(json_encode($payload));
	}

	public static function requireUserId(): ?int {
		$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
		if (str_starts_with($auth, 'Bearer ')) {
			$raw = base64_decode(substr($auth, 7));
			$data = json_decode($raw, true);
			return isset($data['uid']) ? (int)$data['uid'] : null;
		}
		return null;
	}
}
