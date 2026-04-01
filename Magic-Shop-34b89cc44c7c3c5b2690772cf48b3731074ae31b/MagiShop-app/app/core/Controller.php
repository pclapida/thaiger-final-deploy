<?php
abstract class Controller {
	protected function json($data, int $status = 200): void {
		http_response_code($status);
		header('Content-Type: application/json');
		echo json_encode($data);
	}

	protected function requestBody(): array {
		$raw = file_get_contents('php://input') ?: '';
		$decoded = json_decode($raw, true);
		return is_array($decoded) ? $decoded : [];
	}
}
