def greet(name: str) -> str:
    return f"Hello, {name}!"

def farewell(name: str) -> str:
    return f"Goodbye, {name}!"

class Calculator:
    def __init__(self) -> None:
        self.result = 0

    def add(self, a: int, b: int) -> int:
        self.result = a + b
        return self.result

    def subtract(self, a: int, b: int) -> int:
        self.result = a - b
        return self.result
