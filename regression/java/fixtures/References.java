package com.regression;

public class References {
    public static void callThings() {
        Main.greet("Alice");
        Main.farewell("Bob");
        
        Calculator calc = new Calculator();
        calc.add(1, 2);
        calc.subtract(5, 3);
        
        Dog dog = new Dog("Rex");
        dog.speak();
    }
}
