<script lang="ts">
   abstract class Animal {
    abstract speak(): string;
  }

  class Dog extends Animal {
    speak(): string {
      return 'Woof!';
    }
  }

  class Cat extends Animal {
    speak(): string {
      return 'Meow!';
    }
  }
</script>
