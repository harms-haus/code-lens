<script setup lang="ts">
import { ref } from 'vue';

const count = ref(0);

function increment(): void {
  count.value++;
}

function decrement(): void {
  count.value--;
}

increment();
decrement();
</script>

<template>
  <button @click="increment">{{ count }}</button>
</template>
