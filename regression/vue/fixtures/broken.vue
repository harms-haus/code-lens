<script setup lang="ts">
const x: string = 42;

function broken(): string {
  return nonexistent_variable;
}

const arr: number[] = [1, 2, "three"];
</script>

<template>
  <div>{{ broken() }}</div>
</template>
