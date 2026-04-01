<?php
class Database {
	private static ?PDO $instance = null;

	public static function getConnection(): PDO {
		if (self::$instance === null) {
			$config = require __DIR__ . '/../../config/config.php';
			$dsn = 'mysql:host=' . $config['db']['host'] . ';dbname=' . $config['db']['name'] . ';charset=' . $config['db']['charset'];
			$options = [
				PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
				PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
			];
			self::$instance = new PDO($dsn, $config['db']['user'], $config['db']['pass'], $options);
		}
		return self::$instance;
	}
}
