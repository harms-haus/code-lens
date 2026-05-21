<script>
function greet(name) {
  return `Hello, ${name}!`;
}

function farewell(name) {
  return `Goodbye, ${name}!`;
}

class Calculator {
  add(a, b) {
    return a + b;
  }
  subtract(a, b) {
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
