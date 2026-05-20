<?php

function broken(): string {
    $x = 42;
    return $x;  // type error: returning int instead of string
}

function undefined_call() {
    return nonexistent_function();  // undefined function
}
