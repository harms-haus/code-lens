<?php

function greet(string $name): string {
    return "Hello, " . $name . "!";
}

function farewell(string $name): string {
    return "Goodbye, " . $name . "!";
}

class Calculator {
    private int $result = 0;

    public function add(int $a, int $b): int {
        $this->result = $a + $b;
        return $this->result;
    }

    public function subtract(int $a, int $b): int {
        $this->result = $a - $b;
        return $this->result;
    }
}
