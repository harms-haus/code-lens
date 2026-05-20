// This file has intentional type errors for diagnostics testing
const x: string = 42;

function add(a: number, b: string): number {
  return a + b;
}

const user: { name: string } = { age: 30 };
