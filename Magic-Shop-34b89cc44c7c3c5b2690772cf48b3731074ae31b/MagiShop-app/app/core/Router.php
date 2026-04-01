<?php
class Router {
	private array $routes = [];

	public function add(string $method, string $path, callable $handler): void {
		$this->routes[] = [$method, $this->compile($path), $handler];
	}

	public function dispatch(string $method, string $uri): void {
		$path = parse_url($uri, PHP_URL_PATH);
		foreach ($this->routes as [$m, $pattern, $handler]) {
			if ($m !== $method) continue;
			if (preg_match($pattern, $path, $matches)) {
				array_shift($matches);
				$handler(...$matches);
				return;
			}
		}
		http_response_code(404);
		echo json_encode(['error' => 'Not Found']);
	}

	private function compile(string $path): string {
		$regex = preg_replace('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', '([\\w-]+)', $path);
		return '#^' . rtrim($regex, '/') . '$#';
	}
}
