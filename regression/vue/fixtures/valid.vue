<script setup lang="ts">
function greet(name: string): string {
  return `Hello, ${name}!`;
}

function farewell(name: string): string {
  return `Goodbye, ${name}!`;
}

class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
  subtract(a: number, b: number): number {
    return a - b;
  }
}

greet("World");
</script>

<template>
  <div class="container">
    <h1>{{ greet('World') }}</h1>
  </div>
</template>

<style scoped>
.container { padding: 1rem; }
</style>
