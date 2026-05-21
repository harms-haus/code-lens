<script>
import { ref } from 'vue';

const count = ref(0);

function increment() {
  count.value++;
}

function decrement() {
  count.value--;
}

increment();
decrement();
</script>

<template>
  <button @click="increment">{{ count }}</button>
</template>
