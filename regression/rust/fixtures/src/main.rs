fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

fn farewell(name: &str) -> String {
    format!("Goodbye, {}!", name)
}

struct Calculator {
    result: i32,
}

impl Calculator {
    fn new() -> Self {
        Calculator { result: 0 }
    }

    fn add(&mut self, a: i32, b: i32) -> i32 {
        self.result = a + b;
        self.result
    }
}

fn main() {
    let message = greet("world");
    println!("{}", message);

    let mut calc = Calculator::new();
    let sum = calc.add(3, 4);
    println!("{}", sum);
}
