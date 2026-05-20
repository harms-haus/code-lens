#!/bin/bash

greet() {
    local name="$1"
    echo "Hello, ${name}!"
}

farewell() {
    local name="$1"
    echo "Goodbye, ${name}!"
}

main() {
    greet "world"
    farewell "world"
}

main
