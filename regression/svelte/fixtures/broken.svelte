<script lang="ts">
  const x: string = 42;

  function broken(): string {
    return nonexistent_variable;
  }
</script>

<div>{broken()}</div>
