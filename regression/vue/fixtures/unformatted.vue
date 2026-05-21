<script>
function greet(name) {
return `Hello, ${name}!`;
}

function farewell(name) {
return `Goodbye, ${name}!`;
}

greet("World");
</script>

<template>
<div class="container">
<h1>{{ greet('World') }}</h1>
</div>
</template>
