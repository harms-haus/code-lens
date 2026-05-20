import { greet, Calculator, type User } from "./valid.js";

const message = greet("world");

const calc = new Calculator();
const sum = calc.add(3, 4);

const user: User = {
  name: "Alice",
  age: 30,
  email: "alice@example.com",
};
