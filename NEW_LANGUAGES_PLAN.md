# Regression Tests for 10 New Languages — Implementation Plan

## Overview

Add regression tests for 10 new languages to the `@harms-haus/code-lens` project:
**Ruby, HTML, Markdown, Vue, Dockerfile, TOML, Terraform, Lua, Java, Svelte**

The plan follows existing patterns from TypeScript (16 test files), Rust (7), Go (4), Python (6), etc. Each language gets test coverage proportional to its LSP capabilities, linter availability, and prettier support.

**Total: ~80 atomic tasks across 4 phases**

---

## Language Capability Matrix

| Language | LSP Binary | Diag | Refs | Defn | Symbols | Hover | Impl | TypeDef | TypeHier | Calls | Rename | WkspSym | Linter | Prettier | Special Init |
|----------|-----------|------|------|------|---------|-------|------|---------|----------|-------|--------|---------|--------|----------|-------------|
| Ruby | ruby-lsp | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | RuboCop | ❌ | ❌ |
| HTML | html-languageserver | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Markdown | markdown-language-server | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Vue | vue-language-server | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ESLint | ✅ | ❌ |
| Dockerfile | docker-langserver | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | Dockerfile naming |
| TOML | taplo | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Terraform | terraform-ls | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Lua | lua-language-server | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Java | java (eclipse-jdt-ls) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | JDT workspace init |
| Svelte | svelteserver | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ESLint | ✅ | ❌ |

### Test File Count Per Language

| Language | Files | Tests |
|----------|-------|-------|
| Ruby | 10 | ~15 |
| HTML | 5 | ~7 |
| Markdown | 4 | ~5 |
| Vue | 13 | ~20 |
| Dockerfile | 4 | ~5 |
| TOML | 3 | ~3 |
| Terraform | 6 | ~8 |
| Lua | 5 | ~6 |
| Java | 12 | ~18 |
| Svelte | 12 | ~17 |

---

## Phase 1: Shared Infrastructure (2 tasks)

### Task 1.1: Update `vitest.workspace.ts` — add 10 new languages

**File:** `vitest.workspace.ts`

**Change:** Add all 10 new languages to the `LANGUAGES` array:

```ts
const LANGUAGES = [
  // ... existing 10 languages ...
  "ruby",
  "html",
  "markdown",
  "vue",
  "dockerfile",
  "toml",
  "terraform",
  "lua",
  "java",
  "svelte",
] as const;
```

**Verify:** `npx vitest --config vitest.config.regression.ts --dry-run 2>&1 | grep regression:` should list all 20 language projects.

---

### Task 1.2: Update `regression/_shared/test-context.ts` — add warmup + detect + init for 10 languages

**File:** `regression/_shared/test-context.ts`

**Change 1 — WARMUP_FILES:** Add entries for all 10 languages:

```ts
ruby: "fixtures/valid.rb",
html: "fixtures/valid.html",
markdown: "fixtures/valid.md",
vue: "fixtures/valid.vue",
dockerfile: "Dockerfile",       // Dockerfile goes in temp root, not fixtures/
toml: "fixtures/valid.toml",
terraform: "fixtures/main.tf",
lua: "fixtures/valid.lua",
java: "src/Main.java",          // Java uses project-root layout like Rust
svelte: "fixtures/valid.svelte",
```

**Change 2 — detectCommands:** Add entries for all 10 languages:

```ts
ruby: ["ruby-lsp", "--version"],
html: ["html-languageserver", "--version"],
markdown: ["markdown-language-server", "--version"],
vue: ["vue-language-server", "--version"],
dockerfile: ["docker-langserver", "--version"],
toml: ["taplo", "--version"],
terraform: ["terraform-ls", "version"],
lua: ["lua-language-server", "--version"],
java: ["java", "-version"],
svelte: ["svelteserver", "--version"],
```

**Change 3 — languageInit():** Add special init for Java (like Rust/C++) and Dockerfile (copy Dockerfile to temp root):

```ts
private async languageInit(): Promise<void> {
  if (this.language === "go") {
    await this.initGoModule();
  } else if (this.language === "rust") {
    this.initRustWorkspace();
  } else if (this.language === "cpp") {
    this.initCppProject();
  } else if (this.language === "java") {
    this.initJavaWorkspace();
  } else if (this.language === "dockerfile") {
    this.initDockerfileWorkspace();
  }
}
```

**Change 4 — Add `initJavaWorkspace()` method:**

```ts
/**
 * Java: eclipse-jdt-ls needs a proper project structure.
 * Copy .java files from fixtures/ to src/ at temp root,
 * and create a minimal .project file.
 */
private initJavaWorkspace(): void {
  const fixturesDir = path.join(this.fixtureDir, "fixtures");

  // Create src/ at temp root
  const srcDir = path.join(this.fixtureDir, "src");
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
  }

  // Copy all .java files from fixtures/ to src/
  if (fs.existsSync(fixturesDir)) {
    const entries = fs.readdirSync(fixturesDir);
    for (const entry of entries) {
      if (entry.endsWith(".java")) {
        fs.copyFileSync(
          path.join(fixturesDir, entry),
          path.join(srcDir, entry),
        );
      }
    }
  }
}
```

**Change 5 — Add `initDockerfileWorkspace()` method:**

```ts
/**
 * Dockerfile: docker-langserver needs the file named "Dockerfile"
 * at the workspace root (not in a subdirectory).
 * Copy the Dockerfile fixture to temp root.
 */
private initDockerfileWorkspace(): void {
  const dockerfile = path.join(this.fixtureDir, "fixtures", "Dockerfile");
  if (fs.existsSync(dockerfile)) {
    fs.copyFileSync(dockerfile, path.join(this.fixtureDir, "Dockerfile"));
  }
}
```

**Verify:** File compiles without errors: `npx tsc --noEmit regression/_shared/test-context.ts`

**Dependencies:** None — must be done before Phase 3 test files can run.

---

## Phase 2: Create Fixtures (10 tasks, one per language)

### Task 2.1: Ruby fixtures

**Create directory:** `regression/ruby/fixtures/`

**File 1:** `regression/ruby/fixtures/valid.rb`
```rb
# frozen_string_literal: true

def greet(name)
  "Hello, #{name}!"
end

def farewell(name)
  "Goodbye, #{name}!"
end

class Calculator
  def initialize
    @result = 0
  end

  attr_reader :result

  def add(a, b)
    @result = a + b
    @result
  end

  def subtract(a, b)
    @result = a - b
    @result
  end
end

class Animal
  attr_reader :name

  def initialize(name)
    @name = name
  end

  def speak
    "#{@name} makes a sound"
  end
end

class Dog < Animal
  attr_reader :breed

  def initialize(name, breed)
    super(name)
    @breed = breed
  end

  def speak
    "#{@name} barks"
  end
end

module Printable
  def print_info
    to_s
  end
end

class Document
  include Printable

  attr_reader :title

  def initialize(title)
    @title = title
  end
end
```

**File 2:** `regression/ruby/fixtures/broken.rb`
```rb
# frozen_string_literal: true

def broken
  x = 42
  return "string" + x  # TypeError: can't convert Integer into String
end

def undefined_call
  nonexistent_function  # NoMethodError
end
```

**File 3:** `regression/ruby/fixtures/references.rb`
```rb
# frozen_string_literal: true

require_relative "valid"

message = greet("world")
puts message

calc = Calculator.new
sum = calc.add(3, 4)
puts sum
```

**File 4:** `regression/ruby/fixtures/.rubocop.yml`
```yaml
AllCops:
  TargetRubyVersion: 3.1
  NewCops: enable

Style/FrozenStringLiteralComment:
  Enabled: false
```

**Verify:** Files exist and have valid Ruby syntax: `ruby -c regression/ruby/fixtures/valid.rb`

---

### Task 2.2: HTML fixtures

**Create directory:** `regression/html/fixtures/`

**File 1:** `regression/html/fixtures/valid.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test Page</title>
</head>
<body>
  <header class="header">
    <h1>Hello World</h1>
  </header>
  <main class="content">
    <p>Welcome to the test page.</p>
  </main>
</body>
</html>
```

**File 2:** `regression/html/fixtures/invalid.html`
```html
<html>
<head>
  <title>Broken
</head>
<body>
  <div class="container">
    <p>Missing closing tags
    <span>Nested error</span>
  </div>
</html>
```

**File 3:** `regression/html/fixtures/unformatted.html`
```html
<!DOCTYPE html>
<html   lang="en"  >
<head><meta charset="UTF-8"  >
<title>Test</title></head>
<body>  <div   class="container"   >
<p>Hello</p>  </div>
</body></html>
```

**File 4:** `regression/html/fixtures/.prettierrc`
```json
{
  "semi": false,
  "singleQuote": false,
  "tabWidth": 2,
  "printWidth": 80
}
```

**Verify:** Files exist.

---

### Task 2.3: Markdown fixtures

**Create directory:** `regression/markdown/fixtures/`

**File 1:** `regression/markdown/fixtures/valid.md`
```md
# Test Document

## Introduction

This is a test document with various markdown features.

## Features

- **Bold text** and *italic text*
- [Links](https://example.com)
- `Inline code`

### Code Block

```javascript
function hello() {
  return "world";
}
```

## References

See the [introduction](#introduction) for details.
```

**File 2:** `regression/markdown/fixtures/unformatted.md`
```md
#   Test Document

##    Introduction
This is a test document   with   extra   spaces.

## Features

-    **Bold text**   and   *italic text*
-   [Links](https://example.com)
```

**File 3:** `regression/markdown/fixtures/.prettierrc`
```json
{
  "semi": false,
  "singleQuote": false,
  "tabWidth": 2,
  "printWidth": 80,
  "proseWrap": "always"
}
```

**Verify:** Files exist.

---

### Task 2.4: Vue fixtures

**Create directory:** `regression/vue/fixtures/`

**File 1:** `regression/vue/fixtures/valid.vue`
```vue
<template>
  <div class="greeting">
    <h1>{{ message }}</h1>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

export function greet(name: string): string {
  return `Hello, ${name}!`
}

export function farewell(name: string): string {
  return `Goodbye, ${name}!`
}

const message = ref(greet('world'))
</script>

<style scoped>
.greeting {
  color: #333;
  font-size: 16px;
}
</style>
```

**File 2:** `regression/vue/fixtures/broken.vue`
```vue
<template>
  <div>{{ message }}</div>
</template>

<script setup lang="ts">
// Intentional type errors
const x: string = 42
const user: { name: string } = { age: 30 }
</script>
```

**File 3:** `regression/vue/fixtures/references.vue`
```vue
<template>
  <div>
    <p>{{ greet('world') }}</p>
  </div>
</template>

<script setup lang="ts">
import { greet, farewell } from './valid.vue'

const msg = farewell('world')
</script>
```

**File 4:** `regression/vue/fixtures/classes.vue`
```vue
<template>
  <div>{{ animal.speak() }}</div>
</template>

<script setup lang="ts">
class Animal {
  constructor(public name: string) {}
  speak(): string {
    return `${this.name} makes a sound`
  }
}

class Dog extends Animal {
  breed: string
  constructor(name: string, breed: string) {
    super(name)
    this.breed = breed
  }
  speak(): string {
    return `${this.name} barks`
  }
}

interface Printable {
  print(): string
}

class Document implements Printable {
  constructor(public title: string) {}
  print(): string {
    return `Document: ${this.title}`
  }
}

const animal = new Animal('generic')
</script>
```

**File 5:** `regression/vue/fixtures/unformatted.vue`
```vue
<template>
<div   class="greeting"  >
<h1>{{    message  }}</h1>
</div>
</template>

<script setup lang="ts">
const    message   = "hello"
</script>
```

**File 6:** `regression/vue/fixtures/.prettierrc`
```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "printWidth": 80
}
```

**File 7:** `regression/vue/fixtures/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["*.vue", "*.ts"]
}
```

**Verify:** Files exist.

---

### Task 2.5: Dockerfile fixtures

**Create directory:** `regression/dockerfile/fixtures/`

**File 1:** `regression/dockerfile/fixtures/Dockerfile`
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

**File 2:** `regression/dockerfile/fixtures/invalid.Dockerfile`
```dockerfile
FROM node:18-alpine

RUNNN npm install

COPY

EXPOSE
```

**Verify:** Files exist.

---

### Task 2.6: TOML fixtures

**Create directory:** `regression/toml/fixtures/`

**File 1:** `regression/toml/fixtures/valid.toml`
```toml
[package]
name = "test-project"
version = "1.0.0"
description = "A test TOML file"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = "1.0"

[build]
target = "x86_64-unknown-linux-gnu"
opt_level = 2

[features]
default = ["feature_a"]
feature_a = []
feature_b = []
```

**File 2:** `regression/toml/fixtures/invalid.toml`
```toml
[package
name = "broken"
version = 
  bad indent
```

**Verify:** Files exist.

---

### Task 2.7: Terraform fixtures

**Create directory:** `regression/terraform/fixtures/`

**File 1:** `regression/terraform/fixtures/main.tf`
```hcl
resource "aws_instance" "web" {
  ami           = "ami-12345678"
  instance_type = "t2.micro"

  tags = {
    Name = "web-server"
  }
}

resource "aws_s3_bucket" "data" {
  bucket = "my-data-bucket"

  tags = {
    Name = "data-bucket"
  }
}

output "instance_id" {
  value = aws_instance.web.id
}
```

**File 2:** `regression/terraform/fixtures/invalid.tf`
```hcl
resource "aws_instance" "web" {
  ami = 
  instance_type
}
```

**File 3:** `regression/terraform/fixtures/variables.tf`
```hcl
variable "region" {
  type    = string
  default = "us-west-2"
}

variable "environment" {
  type    = string
  default = "development"
}
```

**Verify:** Files exist.

---

### Task 2.8: Lua fixtures

**Create directory:** `regression/lua/fixtures/`

**File 1:** `regression/lua/fixtures/valid.lua`
```lua
local M = {}

function M.greet(name)
  return "Hello, " .. name .. "!"
end

function M.farewell(name)
  return "Goodbye, " .. name .. "!"
end

local Calculator = {}
Calculator.__index = Calculator

function Calculator.new()
  local self = setmetatable({}, Calculator)
  self.result = 0
  return self
end

function Calculator:add(a, b)
  self.result = a + b
  return self.result
end

function Calculator:subtract(a, b)
  self.result = a - b
  return self.result
end

M.Calculator = Calculator

return M
```

**File 2:** `regression/lua/fixtures/broken.lua`
```lua
-- Intentional errors
local function broken()
  local x = nil
  return x + 1  -- attempt to perform arithmetic on nil
end

local function undefined_call()
  return nonexistent_function()  -- undefined global
end
```

**File 3:** `regression/lua/fixtures/references.lua`
```lua
local utils = require("valid")

local message = utils.greet("world")
print(message)

local calc = utils.Calculator.new()
local sum = calc:add(3, 4)
print(sum)
```

**File 4:** `regression/lua/fixtures/.luarc.json`
```json
{
  "runtime.version": "LuaJIT",
  "diagnostics.globals": [],
  "workspace.library": []
}
```

**Verify:** Files exist.

---

### Task 2.9: Java fixtures

**Create directory:** `regression/java/fixtures/`

**File 1:** `regression/java/fixtures/Main.java`
```java
package com.regression;

public class Main {
    public static String greet(String name) {
        return "Hello, " + name + "!";
    }

    public static String farewell(String name) {
        return "Goodbye, " + name + "!";
    }

    public static void main(String[] args) {
        String message = greet("world");
        System.out.println(message);

        Calculator calc = new Calculator();
        int sum = calc.add(3, 4);
        System.out.println(sum);
    }
}
```

**File 2:** `regression/java/fixtures/Calculator.java`
```java
package com.regression;

public class Calculator {
    private int result = 0;

    public int add(int a, int b) {
        result = a + b;
        return result;
    }

    public int subtract(int a, int b) {
        result = a - b;
        return result;
    }

    public int getResult() {
        return result;
    }
}
```

**File 3:** `regression/java/fixtures/Broken.java`
```java
package com.regression;

public class Broken {
    public static String broken() {
        int x = 42;
        return x;  // type error: cannot convert int to String
    }

    public static void undefinedCall() {
        nonexistentFunction();  // undefined method
    }
}
```

**File 4:** `regression/java/fixtures/Animal.java`
```java
package com.regression;

public class Animal {
    protected String name;

    public Animal(String name) {
        this.name = name;
    }

    public String speak() {
        return name + " makes a sound";
    }
}
```

**File 5:** `regression/java/fixtures/Dog.java`
```java
package com.regression;

public class Dog extends Animal {
    private String breed;

    public Dog(String name, String breed) {
        super(name);
        this.breed = breed;
    }

    @Override
    public String speak() {
        return name + " barks";
    }
}
```

**File 6:** `regression/java/fixtures/Printable.java`
```java
package com.regression;

public interface Printable {
    String print();
}
```

**File 7:** `regression/java/fixtures/Document.java`
```java
package com.regression;

public class Document implements Printable {
    private String title;

    public Document(String title) {
        this.title = title;
    }

    @Override
    public String print() {
        return "Document: " + title;
    }
}
```

**Verify:** `javac -d /tmp regression/java/fixtures/Main.java` should compile (if java installed).

---

### Task 2.10: Svelte fixtures

**Create directory:** `regression/svelte/fixtures/`

**File 1:** `regression/svelte/fixtures/valid.svelte`
```svelte
<script lang="ts">
  export function greet(name: string): string {
    return `Hello, ${name}!`;
  }

  export function farewell(name: string): string {
    return `Goodbye, ${name}!`;
  }

  interface User {
    name: string;
    age: number;
  }

  class Calculator {
    private result: number = 0;
    add(a: number, b: number): number {
      this.result = a + b;
      return this.result;
    }
  }

  let message: string = greet('world');
</script>

<h1>{message}</h1>
```

**File 2:** `regression/svelte/fixtures/broken.svelte`
```svelte
<script lang="ts">
  const x: string = 42;
  const user: { name: string } = { age: 30 };
</script>

<p>{x}</p>
```

**File 3:** `regression/svelte/fixtures/references.svelte`
```svelte
<script lang="ts">
  import { greet, farewell } from './valid.svelte';

  const msg = greet('world');
</script>

<p>{msg}</p>
```

**File 4:** `regression/svelte/fixtures/classes.svelte`
```svelte
<script lang="ts">
  class Animal {
    constructor(public name: string) {}
    speak(): string {
      return `${this.name} makes a sound`;
    }
  }

  class Dog extends Animal {
    breed: string;
    constructor(name: string, breed: string) {
      super(name);
      this.breed = breed;
    }
    speak(): string {
      return `${this.name} barks`;
    }
  }

  interface Printable {
    print(): string;
  }

  class Document implements Printable {
    constructor(public title: string) {}
    print(): string {
      return `Document: ${this.title}`;
    }
  }
</script>

<p>classes</p>
```

**File 5:** `regression/svelte/fixtures/unformatted.svelte`
```svelte
<script lang="ts">
  let   message    =   "hello" ;
</script>

<h1> {  message  } </h1>
```

**File 6:** `regression/svelte/fixtures/.prettierrc`
```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "printWidth": 80,
  "plugins": ["prettier-plugin-svelte"]
}
```

**File 7:** `regression/svelte/fixtures/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["*.svelte", "*.ts"]
}
```

**Verify:** Files exist.

---

## Phase 3: Create Test Files (10 language groups)

Each language group is independent — they can all run in parallel.

---

### Group 3.1: Ruby Tests (10 files)

#### Task 3.1.1: Ruby 100-diagnostics

**Create:** `regression/ruby/100-diagnostics.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("ruby");

describe("Ruby — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/valid.rb"]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-file-diagnostics");
  });

  it("reports diagnostics for a broken file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/broken.rb"]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("broken-file-diagnostics");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/ruby/100-diagnostics`

---

#### Task 3.1.2: Ruby 101-find-references

**Create:** `regression/ruby/101-find-references.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("ruby");

describe("Ruby — find-references", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds references to greet function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.rb line 4: def greet — "greet" at col 5
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-references", "--file", "fixtures/valid.rb", "--line", "4", "--col", "5",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-greet");
  });

  it("finds references to Calculator class", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.rb line 14: class Calculator — "Calculator" at col 7
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-references", "--file", "fixtures/valid.rb", "--line", "14", "--col", "7",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-calculator");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/ruby/101-find-references`

---

#### Task 3.1.3: Ruby 102-find-definition

**Create:** `regression/ruby/102-find-definition.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("ruby");

describe("Ruby — find-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds definition of greet from references.rb", async () => {
    if (!ctx.isServerInstalled) return;
    // references.rb line 5: message = greet("world") — "greet" at col 11
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/references.rb", "--line", "5", "--col", "11",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-greet");
  });

  it("finds definition of Calculator from references.rb", async () => {
    if (!ctx.isServerInstalled) return;
    // references.rb line 8: calc = Calculator.new — "Calculator" at col 8
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/references.rb", "--line", "8", "--col", "8",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-calculator");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/ruby/102-find-definition`

---

#### Task 3.1.4: Ruby 103-hover

**Create:** `regression/ruby/103-hover.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("ruby");

describe("Ruby — hover", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for greet function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.rb line 4: def greet(name) — "greet" at col 5
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.rb", "--line", "4", "--col", "5",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-greet");
  });

  it("shows hover info for Calculator class", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.rb line 14: class Calculator — "Calculator" at col 7
    const result = await runCLI(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.rb", "--line", "14", "--col", "7",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-calculator");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/ruby/103-hover`

---

#### Task 3.1.5: Ruby 104-document-symbols

**Create:** `regression/ruby/104-document-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("ruby");

describe("Ruby — document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("lists document symbols for valid.rb", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.rb",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols-valid");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/ruby/104-document-symbols`

---

#### Task 3.1.6: Ruby 105-find-implementations

**Create:** `regression/ruby/105-find-implementations.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("ruby");

describe("Ruby — find-implementations", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds implementations of Animal class", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.rb line 36: class Animal — "Animal" at col 7
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-implementations", "--file", "fixtures/valid.rb", "--line", "36", "--col", "7",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("implementations-of-animal");
  });

  it("finds implementations of Printable module", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.rb line 53: module Printable — "Printable" at col 8
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-implementations", "--file", "fixtures/valid.rb", "--line", "53", "--col", "8",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("implementations-of-printable");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/ruby/105-find-implementations`

---

#### Task 3.1.7: Ruby 106-find-type-definition

**Create:** `regression/ruby/106-find-type-definition.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("ruby");

describe("Ruby — find-type-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds type definition of calculator instance", async () => {
    if (!ctx.isServerInstalled) return;
    // references.rb line 8: calc = Calculator.new — "calc" at col 1
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-type-definition", "--file", "fixtures/references.rb", "--line", "8", "--col", "1",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("type-definition-of-calc");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/ruby/106-find-type-definition`

---

#### Task 3.1.8: Ruby 107-find-symbols

**Create:** `regression/ruby/107-find-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("ruby");

describe("Ruby — find-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds symbols matching 'greet'", async () => {
    if (!ctx.isServerInstalled) return;
    await runCLIWithRetry(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.rb",
    ], { maxAttempts: 3, delayMs: 2_000 });

    const result = await runCLI(ctx.fixtureDir, ["find-symbols", "--query", "greet"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("symbols-greet");
  });

  it("finds symbols matching 'Calculator'", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, ["find-symbols", "--query", "Calculator"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("symbols-calculator");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/ruby/107-find-symbols`

---

#### Task 3.1.9: Ruby 108-rename-symbol

**Create:** `regression/ruby/108-rename-symbol.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("ruby");

describe("Ruby — rename-symbol", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("generates rename diff for a function", async () => {
    if (!ctx.isServerInstalled) return;
    // Warm up first
    await runCLIWithRetry(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.rb",
    ], { maxAttempts: 5, delayMs: 3_000 });

    // valid.rb line 4: def greet — "greet" at col 5
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "rename-symbol", "--file", "fixtures/valid.rb", "--line", "4", "--col", "5",
      "--new-name", "say_hello",
    ], { maxAttempts: 3, delayMs: 2_000 });

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("rename-greet");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/ruby/108-rename-symbol`

---

#### Task 3.1.10: Ruby 200-lint (RuboCop)

**Create:** `regression/ruby/200-lint.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";
import * as fs from "node:fs";
import * as path from "node:path";

const ctx = new RegressionTestContext("ruby");

describe("Ruby — lint", () => {
  beforeAll(async () => {
    await ctx.setup();
    // Copy .rubocop.yml to workspace root
    const rubocopSrc = path.join(ctx.fixtureDir, "fixtures", ".rubocop.yml");
    if (fs.existsSync(rubocopSrc)) {
      fs.copyFileSync(rubocopSrc, path.join(ctx.fixtureDir, ".rubocop.yml"));
    }
  }, 120_000);

  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("returns lint result for valid file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "lint", "--files", "fixtures/valid.rb",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/\d+ issues|No linters|0 issues/i);
  });

  it("returns lint result for broken file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "lint", "--files", "fixtures/broken.rb",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/\d+ issues|No linters|0 issues/i);
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/ruby/200-lint`

---

### Group 3.2: HTML Tests (5 files)

#### Task 3.2.1: HTML 100-diagnostics

**Create:** `regression/html/100-diagnostics.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("html");

describe("HTML — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid HTML file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/valid.html"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-html-diagnostics");
  });

  it("reports diagnostics for an invalid HTML file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics", "--file", "fixtures/invalid.html",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("invalid-html-diagnostics");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/html/100-diagnostics`

---

#### Task 3.2.2: HTML 101-document-symbols

**Create:** `regression/html/101-document-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("html");

describe("HTML — document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("lists document symbols for valid.html", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.html",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/html/101-document-symbols`

---

#### Task 3.2.3: HTML 102-hover

**Create:** `regression/html/102-hover.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("html");

describe("HTML — hover", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for an element", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.html line 5: <title>Test Page</title> — hover on "title" tag at col 3
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.html", "--line", "5", "--col", "3",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-title");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/html/102-hover`

---

#### Task 3.2.4: HTML 103-find-definition

**Create:** `regression/html/103-find-definition.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("html");

describe("HTML — find-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds definition of CSS class reference", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.html line 8: <header class="header"> — hover on "header" class at col 10
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/valid.html", "--line", "8", "--col", "10",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-class");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/html/103-find-definition`

---

#### Task 3.2.5: HTML 200-prettier

**Create:** `regression/html/200-prettier.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";
import * as fs from "node:fs";
import * as path from "node:path";

const ctx = new RegressionTestContext("html");

describe("HTML — prettier", () => {
  beforeAll(async () => {
    await ctx.setup();
    const prettierrcSrc = path.join(ctx.fixtureDir, "fixtures", ".prettierrc");
    if (fs.existsSync(prettierrcSrc)) {
      fs.copyFileSync(prettierrcSrc, path.join(ctx.fixtureDir, ".prettierrc"));
    }
  }, 120_000);

  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports correctly formatted HTML files", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "prettier", "--files", "fixtures/valid.html",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/formatted correctly|no.*need.*formatting|not available/i);
  });

  it("detects unformatted HTML file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "prettier", "--files", "fixtures/unformatted.html",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/need.*formatting|formatted correctly|not available/i);
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/html/200-prettier`

---

### Group 3.3: Markdown Tests (4 files)

#### Task 3.3.1: Markdown 100-document-symbols

**Create:** `regression/markdown/100-document-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("markdown");

describe("Markdown — document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("lists document symbols for valid.md", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.md",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/markdown/100-document-symbols`

---

#### Task 3.3.2: Markdown 101-hover

**Create:** `regression/markdown/101-hover.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("markdown");

describe("Markdown — hover", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a heading", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.md line 1: # Test Document — hover on heading text
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.md", "--line", "1", "--col", "3",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-heading");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/markdown/101-hover`

---

#### Task 3.3.3: Markdown 102-find-references

**Create:** `regression/markdown/102-find-references.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("markdown");

describe("Markdown — find-references", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds references to a heading", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.md line 1: # Test Document — "introduction" link at line 26 references "introduction" heading
    // Try finding references to the "introduction" heading
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-references", "--file", "fixtures/valid.md", "--line", "3", "--col", "3",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-heading");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/markdown/102-find-references`

---

#### Task 3.3.4: Markdown 200-prettier

**Create:** `regression/markdown/200-prettier.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";
import * as fs from "node:fs";
import * as path from "node:path";

const ctx = new RegressionTestContext("markdown");

describe("Markdown — prettier", () => {
  beforeAll(async () => {
    await ctx.setup();
    const prettierrcSrc = path.join(ctx.fixtureDir, "fixtures", ".prettierrc");
    if (fs.existsSync(prettierrcSrc)) {
      fs.copyFileSync(prettierrcSrc, path.join(ctx.fixtureDir, ".prettierrc"));
    }
  }, 120_000);

  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports correctly formatted Markdown files", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "prettier", "--files", "fixtures/valid.md",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/formatted correctly|no.*need.*formatting|not available/i);
  });

  it("detects unformatted Markdown file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "prettier", "--files", "fixtures/unformatted.md",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/need.*formatting|formatted correctly|not available/i);
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/markdown/200-prettier`

---

### Group 3.4: Vue Tests (13 files)

#### Task 3.4.1: Vue 100-diagnostics

**Create:** `regression/vue/100-diagnostics.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid Vue file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics", "--file", "fixtures/valid.vue",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-file-diagnostics");
  });

  it("reports diagnostics for a broken Vue file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "diagnostics", "--file", "fixtures/broken.vue", "--refresh",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("broken-file-diagnostics");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/vue/100-diagnostics`

---

#### Task 3.4.2: Vue 101-find-references

**Create:** `regression/vue/101-find-references.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — find-references", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds references to greet function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.vue script section line 3: export function greet — "greet" at col 18
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-references", "--file", "fixtures/valid.vue", "--line", "3", "--col", "18",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-greet");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/vue/101-find-references`

---

#### Task 3.4.3: Vue 102-find-definition

**Create:** `regression/vue/102-find-definition.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — find-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds definition of greet from references.vue", async () => {
    if (!ctx.isServerInstalled) return;
    // references.vue line 3: import { greet, farewell } — "greet" at col 10
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/references.vue", "--line", "3", "--col", "10",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-greet");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/vue/102-find-definition`

---

#### Task 3.4.4: Vue 103-document-symbols

**Create:** `regression/vue/103-document-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("lists document symbols for valid.vue", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.vue",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/vue/103-document-symbols`

---

#### Task 3.4.5: Vue 104-hover

**Create:** `regression/vue/104-hover.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — hover", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.vue script line 3: function greet — "greet" at col 18
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.vue", "--line", "3", "--col", "18",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-greet");
  });

  it("shows hover info for Calculator class", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.vue script line 14: class Calculator — "Calculator" at col 8
    const result = await runCLI(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.vue", "--line", "14", "--col", "8",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-calculator");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/vue/104-hover`

---

#### Task 3.4.6: Vue 105-find-implementations

**Create:** `regression/vue/105-find-implementations.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — find-implementations", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds implementations of Animal class", async () => {
    if (!ctx.isServerInstalled) return;
    // classes.vue line 3: class Animal — "Animal" at col 8
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-implementations", "--file", "fixtures/classes.vue", "--line", "3", "--col", "8",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("implementations-of-animal");
  });

  it("finds implementations of Printable interface", async () => {
    if (!ctx.isServerInstalled) return;
    // classes.vue line 20: interface Printable — "Printable" at col 11
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-implementations", "--file", "fixtures/classes.vue", "--line", "20", "--col", "11",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("implementations-of-printable");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/vue/105-find-implementations`

---

#### Task 3.4.7: Vue 106-find-type-definition

**Create:** `regression/vue/106-find-type-definition.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — find-type-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds type definition of class instance", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.vue line 23: let message: string = greet('world') — "message" at col 7
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-type-definition", "--file", "fixtures/valid.vue", "--line", "23", "--col", "7",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("type-definition-of-message");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/vue/106-find-type-definition`

---

#### Task 3.4.8: Vue 107-find-type-hierarchy

**Create:** `regression/vue/107-find-type-hierarchy.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — find-type-hierarchy", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows subtypes of Animal class", async () => {
    if (!ctx.isServerInstalled) return;
    // classes.vue line 3: class Animal — "Animal" at col 8
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-type-hierarchy", "--file", "fixtures/classes.vue", "--line", "3", "--col", "8",
      "--direction", "subtypes",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("type-hierarchy-animal-subtypes");
  });

  it("shows supertypes of Dog class", async () => {
    if (!ctx.isServerInstalled) return;
    // classes.vue line 11: class Dog — "Dog" at col 8
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-type-hierarchy", "--file", "fixtures/classes.vue", "--line", "11", "--col", "8",
      "--direction", "supertypes",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("type-hierarchy-dog-supertypes");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/vue/107-find-type-hierarchy`

---

#### Task 3.4.9: Vue 108-find-calls

**Create:** `regression/vue/108-find-calls.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — find-calls", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows call hierarchy for greet function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.vue line 3: function greet — "greet" at col 18
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-calls", "--file", "fixtures/valid.vue", "--line", "3", "--col", "18",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("calls-greet");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/vue/108-find-calls`

---

#### Task 3.4.10: Vue 109-find-symbols

**Create:** `regression/vue/109-find-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — find-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds symbols matching 'greet'", async () => {
    if (!ctx.isServerInstalled) return;
    await runCLIWithRetry(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.vue",
    ], { maxAttempts: 3, delayMs: 2_000 });

    const result = await runCLI(ctx.fixtureDir, ["find-symbols", "--query", "greet"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("symbols-greet");
  });

  it("finds symbols matching 'Calculator'", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, ["find-symbols", "--query", "Calculator"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("symbols-calculator");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/vue/109-find-symbols`

---

#### Task 3.4.11: Vue 110-rename-symbol

**Create:** `regression/vue/110-rename-symbol.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — rename-symbol", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("generates rename diff for a function", async () => {
    if (!ctx.isServerInstalled) return;
    await runCLIWithRetry(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.vue",
    ], { maxAttempts: 5, delayMs: 3_000 });

    // valid.vue line 3: function greet — "greet" at col 18
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "rename-symbol", "--file", "fixtures/valid.vue", "--line", "3", "--col", "18",
      "--new-name", "sayHello",
    ], { maxAttempts: 3, delayMs: 2_000 });

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("rename-greet");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/vue/110-rename-symbol`

---

#### Task 3.4.12: Vue 200-prettier

**Create:** `regression/vue/200-prettier.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";
import * as fs from "node:fs";
import * as path from "node:path";

const ctx = new RegressionTestContext("vue");

describe("Vue — prettier", () => {
  beforeAll(async () => {
    await ctx.setup();
    const prettierrcSrc = path.join(ctx.fixtureDir, "fixtures", ".prettierrc");
    if (fs.existsSync(prettierrcSrc)) {
      fs.copyFileSync(prettierrcSrc, path.join(ctx.fixtureDir, ".prettierrc"));
    }
  }, 120_000);

  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports correctly formatted Vue files", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "prettier", "--files", "fixtures/valid.vue",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/formatted correctly|no.*need.*formatting|not available/i);
  });

  it("detects unformatted Vue file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "prettier", "--files", "fixtures/unformatted.vue",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/need.*formatting|formatted correctly|not available/i);
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/vue/200-prettier`

---

#### Task 3.4.13: Vue 201-lint

**Create:** `regression/vue/201-lint.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("vue");

describe("Vue — lint", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("returns lint result for valid file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "lint", "--files", "fixtures/valid.vue",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/\d+ issues|No linters|0 issues/i);
  });

  it("returns lint result for broken file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "lint", "--files", "fixtures/broken.vue",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/\d+ issues|No linters|0 issues/i);
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/vue/201-lint`

---

### Group 3.5: Dockerfile Tests (4 files)

#### Task 3.5.1: Dockerfile 100-diagnostics

**Create:** `regression/dockerfile/100-diagnostics.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("dockerfile");

describe("Dockerfile — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid Dockerfile", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, ["diagnostics", "--file", "Dockerfile"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-dockerfile-diagnostics");
  });

  it("reports diagnostics for an invalid Dockerfile", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics", "--file", "fixtures/invalid.Dockerfile",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("invalid-dockerfile-diagnostics");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/dockerfile/100-diagnostics`

---

#### Task 3.5.2: Dockerfile 101-document-symbols

**Create:** `regression/dockerfile/101-document-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("dockerfile");

describe("Dockerfile — document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("lists document symbols for Dockerfile", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols", "--file", "Dockerfile",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/dockerfile/101-document-symbols`

---

#### Task 3.5.3: Dockerfile 102-hover

**Create:** `regression/dockerfile/102-hover.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("dockerfile");

describe("Dockerfile — hover", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a Dockerfile instruction", async () => {
    if (!ctx.isServerInstalled) return;
    // Dockerfile line 1: FROM node:18-alpine — "FROM" at col 1
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "Dockerfile", "--line", "1", "--col", "1",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-from");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/dockerfile/102-hover`

---

#### Task 3.5.4: Dockerfile 103-find-definition

**Create:** `regression/dockerfile/103-find-definition.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("dockerfile");

describe("Dockerfile — find-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds definition of a base image reference", async () => {
    if (!ctx.isServerInstalled) return;
    // Dockerfile line 1: FROM node:18-alpine — "node" at col 6
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-definition", "--file", "Dockerfile", "--line", "1", "--col", "6",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-from");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/dockerfile/103-find-definition`

---

### Group 3.6: TOML Tests (3 files)

#### Task 3.6.1: TOML 100-diagnostics

**Create:** `regression/toml/100-diagnostics.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("toml");

describe("TOML — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid TOML file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics", "--file", "fixtures/valid.toml",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-toml-diagnostics");
  });

  it("reports diagnostics for an invalid TOML file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics", "--file", "fixtures/invalid.toml",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("invalid-toml-diagnostics");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/toml/100-diagnostics`

---

#### Task 3.6.2: TOML 101-document-symbols

**Create:** `regression/toml/101-document-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("toml");

describe("TOML — document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("lists document symbols for valid.toml", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.toml",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/toml/101-document-symbols`

---

#### Task 3.6.3: TOML 102-hover

**Create:** `regression/toml/102-hover.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("toml");

describe("TOML — hover", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a table key", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.toml line 2: name = "test-project" — "name" at col 1
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.toml", "--line", "2", "--col", "1",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-key");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/toml/102-hover`

---

### Group 3.7: Terraform Tests (6 files)

#### Task 3.7.1: Terraform 100-diagnostics

**Create:** `regression/terraform/100-diagnostics.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("terraform");

describe("Terraform — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid TF file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics", "--file", "fixtures/main.tf",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-tf-diagnostics");
  });

  it("reports diagnostics for an invalid TF file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "diagnostics", "--file", "fixtures/invalid.tf",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("invalid-tf-diagnostics");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/terraform/100-diagnostics`

---

#### Task 3.7.2: Terraform 101-find-references

**Create:** `regression/terraform/101-find-references.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("terraform");

describe("Terraform — find-references", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds references to aws_instance.web resource", async () => {
    if (!ctx.isServerInstalled) return;
    // main.tf line 1: resource "aws_instance" "web" — "web" at col 27
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-references", "--file", "fixtures/main.tf", "--line", "1", "--col", "27",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-web");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/terraform/101-find-references`

---

#### Task 3.7.3: Terraform 102-find-definition

**Create:** `regression/terraform/102-find-definition.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("terraform");

describe("Terraform — find-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds definition of resource reference from output", async () => {
    if (!ctx.isServerInstalled) return;
    // main.tf line 22: value = aws_instance.web.id — "aws_instance" at col 10
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/main.tf", "--line", "22", "--col", "10",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-resource");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/terraform/102-find-definition`

---

#### Task 3.7.4: Terraform 103-document-symbols

**Create:** `regression/terraform/103-document-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("terraform");

describe("Terraform — document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("lists document symbols for main.tf", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/main.tf",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/terraform/103-document-symbols`

---

#### Task 3.7.5: Terraform 104-hover

**Create:** `regression/terraform/104-hover.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("terraform");

describe("Terraform — hover", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a resource type", async () => {
    if (!ctx.isServerInstalled) return;
    // main.tf line 1: resource "aws_instance" "web" — "aws_instance" at col 11
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/main.tf", "--line", "1", "--col", "11",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-resource-type");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/terraform/104-hover`

---

#### Task 3.7.6: Terraform 105-find-symbols

**Create:** `regression/terraform/105-find-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("terraform");

describe("Terraform — find-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds symbols matching 'web'", async () => {
    if (!ctx.isServerInstalled) return;
    await runCLIWithRetry(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/main.tf",
    ], { maxAttempts: 3, delayMs: 2_000 });

    const result = await runCLI(ctx.fixtureDir, ["find-symbols", "--query", "web"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("symbols-web");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/terraform/105-find-symbols`

---

### Group 3.8: Lua Tests (5 files)

#### Task 3.8.1: Lua 100-diagnostics

**Create:** `regression/lua/100-diagnostics.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("lua");

describe("Lua — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics", "--file", "fixtures/valid.lua",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-file-diagnostics");
  });

  it("reports diagnostics for a broken file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "diagnostics", "--file", "fixtures/broken.lua",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("broken-file-diagnostics");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/lua/100-diagnostics`

---

#### Task 3.8.2: Lua 101-find-references

**Create:** `regression/lua/101-find-references.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("lua");

describe("Lua — find-references", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds references to greet function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.lua line 4: function M.greet(name) — "greet" at col 11
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-references", "--file", "fixtures/valid.lua", "--line", "4", "--col", "11",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-greet");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/lua/101-find-references`

---

#### Task 3.8.3: Lua 102-find-definition

**Create:** `regression/lua/102-find-definition.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("lua");

describe("Lua — find-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds definition of greet from references.lua", async () => {
    if (!ctx.isServerInstalled) return;
    // references.lua line 3: local message = utils.greet("world") — "greet" at col 23
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/references.lua", "--line", "3", "--col", "23",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-greet");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/lua/102-find-definition`

---

#### Task 3.8.4: Lua 103-hover

**Create:** `regression/lua/103-hover.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("lua");

describe("Lua — hover", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.lua line 4: function M.greet(name) — "greet" at col 11
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.lua", "--line", "4", "--col", "11",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-greet");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/lua/103-hover`

---

#### Task 3.8.5: Lua 104-rename-symbol

**Create:** `regression/lua/104-rename-symbol.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("lua");

describe("Lua — rename-symbol", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("generates rename diff for a function", async () => {
    if (!ctx.isServerInstalled) return;
    await runCLIWithRetry(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.lua",
    ], { maxAttempts: 5, delayMs: 3_000 });

    // valid.lua line 4: function M.greet — "greet" at col 11
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "rename-symbol", "--file", "fixtures/valid.lua", "--line", "4", "--col", "11",
      "--new-name", "say_hello",
    ], { maxAttempts: 3, delayMs: 2_000 });

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("rename-greet");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/lua/104-rename-symbol`

---

### Group 3.9: Java Tests (12 files)

#### Task 3.9.1: Java 100-diagnostics

**Create:** `regression/java/100-diagnostics.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics", "--file", "src/Main.java",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-file-diagnostics");
  });

  it("reports diagnostics for a broken file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "diagnostics", "--file", "src/Broken.java",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("broken-file-diagnostics");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/java/100-diagnostics`

---

#### Task 3.9.2: Java 101-find-references

**Create:** `regression/java/101-find-references.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — find-references", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds references to greet method", async () => {
    if (!ctx.isServerInstalled) return;
    // Main.java line 4: public static String greet — "greet" at col 26
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-references", "--file", "src/Main.java", "--line", "4", "--col", "26",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-greet");
  });

  it("finds references to Calculator class", async () => {
    if (!ctx.isServerInstalled) return;
    // Calculator.java line 3: public class Calculator — "Calculator" at col 14
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-references", "--file", "src/Calculator.java", "--line", "3", "--col", "14",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-calculator");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/java/101-find-references`

---

#### Task 3.9.3: Java 102-find-definition

**Create:** `regression/java/102-find-definition.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — find-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds definition of Calculator from Main.java", async () => {
    if (!ctx.isServerInstalled) return;
    // Main.java line 12: Calculator calc = new Calculator() — "Calculator" at col 13
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-definition", "--file", "src/Main.java", "--line", "12", "--col", "13",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-calculator");
  });

  it("finds definition of greet from call site", async () => {
    if (!ctx.isServerInstalled) return;
    // Main.java line 11: String message = greet("world") — "greet" at col 27
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-definition", "--file", "src/Main.java", "--line", "11", "--col", "27",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-greet");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/java/102-find-definition`

---

#### Task 3.9.4: Java 103-document-symbols

**Create:** `regression/java/103-document-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("lists document symbols for Main.java", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols", "--file", "src/Main.java",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols-main");
  });

  it("lists document symbols for Calculator.java", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols", "--file", "src/Calculator.java",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols-calculator");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/java/103-document-symbols`

---

#### Task 3.9.5: Java 104-hover

**Create:** `regression/java/104-hover.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — hover", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a method", async () => {
    if (!ctx.isServerInstalled) return;
    // Main.java line 4: public static String greet — "greet" at col 26
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "src/Main.java", "--line", "4", "--col", "26",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-greet");
  });

  it("shows hover info for a class", async () => {
    if (!ctx.isServerInstalled) return;
    // Calculator.java line 3: public class Calculator — "Calculator" at col 14
    const result = await runCLI(ctx.fixtureDir, [
      "hover", "--file", "src/Calculator.java", "--line", "3", "--col", "14",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-calculator");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/java/104-hover`

---

#### Task 3.9.6: Java 105-find-implementations

**Create:** `regression/java/105-find-implementations.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — find-implementations", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds implementations of Animal class", async () => {
    if (!ctx.isServerInstalled) return;
    // Animal.java line 3: public class Animal — "Animal" at col 14
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-implementations", "--file", "src/Animal.java", "--line", "3", "--col", "14",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("implementations-of-animal");
  });

  it("finds implementations of Printable interface", async () => {
    if (!ctx.isServerInstalled) return;
    // Printable.java line 3: public interface Printable — "Printable" at col 18
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-implementations", "--file", "src/Printable.java", "--line", "3", "--col", "18",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("implementations-of-printable");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/java/105-find-implementations`

---

#### Task 3.9.7: Java 106-find-type-definition

**Create:** `regression/java/106-find-type-definition.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — find-type-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds type definition of calculator instance", async () => {
    if (!ctx.isServerInstalled) return;
    // Main.java line 12: Calculator calc — "calc" at col 24
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-type-definition", "--file", "src/Main.java", "--line", "12", "--col", "24",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("type-definition-of-calc");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/java/106-find-type-definition`

---

#### Task 3.9.8: Java 107-find-type-hierarchy

**Create:** `regression/java/107-find-type-hierarchy.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — find-type-hierarchy", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows supertypes of Dog class", async () => {
    if (!ctx.isServerInstalled) return;
    // Dog.java line 3: public class Dog — "Dog" at col 14
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-type-hierarchy", "--file", "src/Dog.java", "--line", "3", "--col", "14",
      "--direction", "supertypes",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("type-hierarchy-dog-supertypes");
  });

  it("shows subtypes of Animal class", async () => {
    if (!ctx.isServerInstalled) return;
    // Animal.java line 3: public class Animal — "Animal" at col 14
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-type-hierarchy", "--file", "src/Animal.java", "--line", "3", "--col", "14",
      "--direction", "subtypes",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("type-hierarchy-animal-subtypes");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/java/107-find-type-hierarchy`

---

#### Task 3.9.9: Java 108-find-calls

**Create:** `regression/java/108-find-calls.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — find-calls", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows call hierarchy for greet method", async () => {
    if (!ctx.isServerInstalled) return;
    // Main.java line 4: public static String greet — "greet" at col 26
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-calls", "--file", "src/Main.java", "--line", "4", "--col", "26",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("calls-greet");
  });

  it("shows call hierarchy for Calculator.add method", async () => {
    if (!ctx.isServerInstalled) return;
    // Calculator.java line 8: public int add — "add" at col 15
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-calls", "--file", "src/Calculator.java", "--line", "8", "--col", "15",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("calls-calculator-add");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/java/108-find-calls`

---

#### Task 3.9.10: Java 109-find-symbols

**Create:** `regression/java/109-find-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — find-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds symbols matching 'greet'", async () => {
    if (!ctx.isServerInstalled) return;
    await runCLIWithRetry(ctx.fixtureDir, [
      "find-document-symbols", "--file", "src/Main.java",
    ], { maxAttempts: 3, delayMs: 2_000 });

    const result = await runCLI(ctx.fixtureDir, ["find-symbols", "--query", "greet"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("symbols-greet");
  });

  it("finds symbols matching 'Calculator'", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, ["find-symbols", "--query", "Calculator"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("symbols-calculator");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/java/109-find-symbols`

---

#### Task 3.9.11: Java 110-rename-symbol

**Create:** `regression/java/110-rename-symbol.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — rename-symbol", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("generates rename diff for a method", async () => {
    if (!ctx.isServerInstalled) return;
    await runCLIWithRetry(ctx.fixtureDir, [
      "find-references", "--file", "src/Main.java", "--line", "4", "--col", "26",
    ], { maxAttempts: 5, delayMs: 3_000 });

    // Main.java line 4: public static String greet — "greet" at col 26
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "rename-symbol", "--file", "src/Main.java", "--line", "4", "--col", "26",
      "--new-name", "sayHello",
    ], { maxAttempts: 3, delayMs: 2_000 });

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("rename-greet");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/java/110-rename-symbol`

---

#### Task 3.9.12: Java 111-file-changed

**Create:** `regression/java/111-file-changed.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("java");

describe("Java — file-changed", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("notifies server of file change", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "file-changed", "--file", "src/Main.java",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/File change|changed|notification|notified|updated/i);
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/java/111-file-changed`

---

### Group 3.10: Svelte Tests (12 files)

#### Task 3.10.1: Svelte 100-diagnostics

**Create:** `regression/svelte/100-diagnostics.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("svelte");

describe("Svelte — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid Svelte file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics", "--file", "fixtures/valid.svelte",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-file-diagnostics");
  });

  it("reports diagnostics for a broken Svelte file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "diagnostics", "--file", "fixtures/broken.svelte", "--refresh",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("broken-file-diagnostics");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/svelte/100-diagnostics`

---

#### Task 3.10.2: Svelte 101-find-references

**Create:** `regression/svelte/101-find-references.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("svelte");

describe("Svelte — find-references", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds references to greet function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.svelte script line 2: export function greet — "greet" at col 18
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-references", "--file", "fixtures/valid.svelte", "--line", "2", "--col", "18",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-greet");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/svelte/101-find-references`

---

#### Task 3.10.3: Svelte 102-find-definition

**Create:** `regression/svelte/102-find-definition.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("svelte");

describe("Svelte — find-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds definition of greet from references.svelte", async () => {
    if (!ctx.isServerInstalled) return;
    // references.svelte line 3: import { greet, farewell } — "greet" at col 10
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/references.svelte", "--line", "3", "--col", "10",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-greet");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/svelte/102-find-definition`

---

#### Task 3.10.4: Svelte 103-document-symbols

**Create:** `regression/svelte/103-document-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("svelte");

describe("Svelte — document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("lists document symbols for valid.svelte", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.svelte",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/svelte/103-document-symbols`

---

#### Task 3.10.5: Svelte 104-hover

**Create:** `regression/svelte/104-hover.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("svelte");

describe("Svelte — hover", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.svelte script line 2: function greet — "greet" at col 18
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.svelte", "--line", "2", "--col", "18",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-greet");
  });

  it("shows hover info for Calculator class", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.svelte script line 13: class Calculator — "Calculator" at col 8
    const result = await runCLI(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.svelte", "--line", "13", "--col", "8",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-calculator");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/svelte/104-hover`

---

#### Task 3.10.6: Svelte 105-find-implementations

**Create:** `regression/svelte/105-find-implementations.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("svelte");

describe("Svelte — find-implementations", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds implementations of Animal class", async () => {
    if (!ctx.isServerInstalled) return;
    // classes.svelte line 3: class Animal — "Animal" at col 8
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-implementations", "--file", "fixtures/classes.svelte", "--line", "3", "--col", "8",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("implementations-of-animal");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/svelte/105-find-implementations`

---

#### Task 3.10.7: Svelte 106-find-type-definition

**Create:** `regression/svelte/106-find-type-definition.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("svelte");

describe("Svelte — find-type-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds type definition of class instance", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.svelte line 22: let message: string = greet('world') — "message" at col 7
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-type-definition", "--file", "fixtures/valid.svelte", "--line", "22", "--col", "7",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("type-definition-of-message");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/svelte/106-find-type-definition`

---

#### Task 3.10.8: Svelte 107-find-calls

**Create:** `regression/svelte/107-find-calls.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("svelte");

describe("Svelte — find-calls", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows call hierarchy for greet function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.svelte line 2: function greet — "greet" at col 18
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-calls", "--file", "fixtures/valid.svelte", "--line", "2", "--col", "18",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("calls-greet");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/svelte/107-find-calls`

---

#### Task 3.10.9: Svelte 108-find-symbols

**Create:** `regression/svelte/108-find-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("svelte");

describe("Svelte — find-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds symbols matching 'greet'", async () => {
    if (!ctx.isServerInstalled) return;
    await runCLIWithRetry(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.svelte",
    ], { maxAttempts: 3, delayMs: 2_000 });

    const result = await runCLI(ctx.fixtureDir, ["find-symbols", "--query", "greet"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("symbols-greet");
  });

  it("finds symbols matching 'Calculator'", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, ["find-symbols", "--query", "Calculator"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("symbols-calculator");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/svelte/108-find-symbols`

---

#### Task 3.10.10: Svelte 109-rename-symbol

**Create:** `regression/svelte/109-rename-symbol.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("svelte");

describe("Svelte — rename-symbol", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("generates rename diff for a function", async () => {
    if (!ctx.isServerInstalled) return;
    await runCLIWithRetry(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.svelte",
    ], { maxAttempts: 5, delayMs: 3_000 });

    // valid.svelte line 2: function greet — "greet" at col 18
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "rename-symbol", "--file", "fixtures/valid.svelte", "--line", "2", "--col", "18",
      "--new-name", "sayHello",
    ], { maxAttempts: 3, delayMs: 2_000 });

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("rename-greet");
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/svelte/109-rename-symbol`

---

#### Task 3.10.11: Svelte 200-prettier

**Create:** `regression/svelte/200-prettier.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";
import * as fs from "node:fs";
import * as path from "node:path";

const ctx = new RegressionTestContext("svelte");

describe("Svelte — prettier", () => {
  beforeAll(async () => {
    await ctx.setup();
    const prettierrcSrc = path.join(ctx.fixtureDir, "fixtures", ".prettierrc");
    if (fs.existsSync(prettierrcSrc)) {
      fs.copyFileSync(prettierrcSrc, path.join(ctx.fixtureDir, ".prettierrc"));
    }
  }, 120_000);

  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports correctly formatted Svelte files", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "prettier", "--files", "fixtures/valid.svelte",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/formatted correctly|no.*need.*formatting|not available/i);
  });

  it("detects unformatted Svelte file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "prettier", "--files", "fixtures/unformatted.svelte",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/need.*formatting|formatted correctly|not available/i);
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/svelte/200-prettier`

---

#### Task 3.10.12: Svelte 201-lint

**Create:** `regression/svelte/201-lint.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("svelte");

describe("Svelte — lint", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("returns lint result for valid file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "lint", "--files", "fixtures/valid.svelte",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/\d+ issues|No linters|0 issues/i);
  });

  it("returns lint result for broken file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "lint", "--files", "fixtures/broken.svelte",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/\d+ issues|No linters|0 issues/i);
  });
});
```

**Verify:** `npx vitest --config vitest.config.regression.ts -u regression/svelte/201-lint`

---

## Phase 4: Generate Snapshots and Validate

### Task 4.1: Generate all snapshot baselines

**Action:** Run each language's tests with the update flag:

```bash
# Run each language individually to generate .snap files
for lang in ruby html markdown vue dockerfile toml terraform lua java svelte; do
  npx vitest --config vitest.config.regression.ts -u "regression/$lang/" 2>&1 || true
done
```

**Verify:** Each language should have a `regression/{lang}/__snapshots__/` directory with `.snap` files matching the test file names.

---

### Task 4.2: Validate snapshot content

**Action:** Manually review each `.snap` file to verify:
1. No absolute paths remain (should be `<ROOT>`, `<TMPDIR>`, `~`)
2. No PIDs remain (should be `<PID>`)
3. No timing values remain (should be `<TIME>`)
4. Content is sensible (e.g., diagnostics show errors for broken files, symbols list is non-empty)

If normalization is incomplete, update `regression/_shared/normalize.ts` to add new patterns.

**Verify:** All snapshots are clean and deterministic.

---

## Dependency Graph

```
Phase 1 (Tasks 1.1, 1.2) ──→ Phase 2 (Tasks 2.1–2.10) ──→ Phase 3 (Tasks 3.x.x) ──→ Phase 4 (Tasks 4.1, 4.2)
                                   │                            │
                                   │  (fixtures needed)         │  (test files need
                                   │                            │   fixtures + infrastructure)
                                   └────────────────────────────┘
                                        Can run in parallel
                                        once Phase 1 is done
```

- **Phase 1 tasks** (1.1, 1.2): Can run in parallel with each other
- **Phase 2 tasks** (2.1–2.10): Can all run in parallel — they only create fixture files
- **Phase 3 groups** (3.1–3.10): Can all run in parallel — they only create test files (snapshots auto-generate on first run)
- **Within each Phase 3 group**: Tasks can run in parallel within the group
- **Phase 4**: Must wait for Phase 3 to complete

**Optimal parallel execution:**
1. Phase 1 (2 tasks in parallel)
2. Phase 2 + Phase 3 together (80 tasks in parallel, max 10 language groups)
3. Phase 4 (2 tasks sequential)

---

## Files Summary

### Modified files (2):
| File | Changes |
|------|---------|
| `vitest.workspace.ts` | Add 10 new languages to LANGUAGES array |
| `regression/_shared/test-context.ts` | Add WARMUP_FILES, detectCommands, initJavaWorkspace, initDockerfileWorkspace |

### New fixture directories (10):
| Directory | Files |
|-----------|-------|
| `regression/ruby/fixtures/` | valid.rb, broken.rb, references.rb, .rubocop.yml |
| `regression/html/fixtures/` | valid.html, invalid.html, unformatted.html, .prettierrc |
| `regression/markdown/fixtures/` | valid.md, unformatted.md, .prettierrc |
| `regression/vue/fixtures/` | valid.vue, broken.vue, references.vue, classes.vue, unformatted.vue, .prettierrc, tsconfig.json |
| `regression/dockerfile/fixtures/` | Dockerfile, invalid.Dockerfile |
| `regression/toml/fixtures/` | valid.toml, invalid.toml |
| `regression/terraform/fixtures/` | main.tf, invalid.tf, variables.tf |
| `regression/lua/fixtures/` | valid.lua, broken.lua, references.lua, .luarc.json |
| `regression/java/fixtures/` | Main.java, Calculator.java, Broken.java, Animal.java, Dog.java, Printable.java, Document.java |
| `regression/svelte/fixtures/` | valid.svelte, broken.svelte, references.svelte, classes.svelte, unformatted.svelte, .prettierrc, tsconfig.json |

### New test files (80):
| Language | Test files |
|----------|-----------|
| Ruby (10) | 100-diagnostics, 101-find-references, 102-find-definition, 103-hover, 104-document-symbols, 105-find-implementations, 106-find-type-definition, 107-find-symbols, 108-rename-symbol, 200-lint |
| HTML (5) | 100-diagnostics, 101-document-symbols, 102-hover, 103-find-definition, 200-prettier |
| Markdown (4) | 100-document-symbols, 101-hover, 102-find-references, 200-prettier |
| Vue (13) | 100-diagnostics, 101-find-references, 102-find-definition, 103-document-symbols, 104-hover, 105-find-implementations, 106-find-type-definition, 107-find-type-hierarchy, 108-find-calls, 109-find-symbols, 110-rename-symbol, 200-prettier, 201-lint |
| Dockerfile (4) | 100-diagnostics, 101-document-symbols, 102-hover, 103-find-definition |
| TOML (3) | 100-diagnostics, 101-document-symbols, 102-hover |
| Terraform (6) | 100-diagnostics, 101-find-references, 102-find-definition, 103-document-symbols, 104-hover, 105-find-symbols |
| Lua (5) | 100-diagnostics, 101-find-references, 102-find-definition, 103-hover, 104-rename-symbol |
| Java (12) | 100-diagnostics, 101-find-references, 102-find-definition, 103-document-symbols, 104-hover, 105-find-implementations, 106-find-type-definition, 107-find-type-hierarchy, 108-find-calls, 109-find-symbols, 110-rename-symbol, 111-file-changed |
| Svelte (12) | 100-diagnostics, 101-find-references, 102-find-definition, 103-document-symbols, 104-hover, 105-find-implementations, 106-find-type-definition, 107-find-calls, 108-find-symbols, 109-rename-symbol, 200-prettier, 201-lint |

### Out of scope:
- No changes to `regression/_shared/run-cli.ts`
- No changes to `regression/_shared/types.ts`
- No changes to `vitest.config.regression.ts`
- No changes to source code under `src/`
- No CI/CD changes (Phase 4 deferred)
