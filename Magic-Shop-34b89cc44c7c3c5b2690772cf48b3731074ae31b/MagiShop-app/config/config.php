<?php
return [
	'db' => [
		'host' => getenv('DB_HOST') ?: '127.0.0.1',
		'name' => getenv('DB_NAME') ?: 'magishop',
		'user' => getenv('DB_USER') ?: 'root',
		'pass' => getenv('DB_PASS') ?: '',
		'charset' => 'utf8mb4',
	],
	'app' => [
		'base_url' => rtrim(getenv('APP_BASE_URL') ?: '/MagiShop/public', '/'),
		'jwt_secret' => getenv('JWT_SECRET') ?: 'change-me-in-prod',
	],
];
