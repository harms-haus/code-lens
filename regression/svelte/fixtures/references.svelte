<script lang="ts">
  import { writable } from 'svelte/store';


  const count = writable(0);


  function increment(): void {
    count.update(n => n + 1);
  }

  function decrement(): void {
    count.update(n => n - 1);
  }

  increment();
  decrement();
</script>

<button on:click={increment}>Increment</button>
