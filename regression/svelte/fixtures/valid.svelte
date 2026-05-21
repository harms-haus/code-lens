<script lang="ts">
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

  const result = greet("World");
</script>

<h1>{result}</h1>
