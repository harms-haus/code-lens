<?php
require_once __DIR__ . '/valid.php';

$message = greet("world");
echo $message;

$calc = new Calculator();
$sum = $calc->add(3, 4);
echo $sum;
