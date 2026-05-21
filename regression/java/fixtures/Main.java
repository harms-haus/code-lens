package com.regression;

public class Main {
    public static void main(String[] args) {
        String greeting = greet("World");
        System.out.println(greeting);
        
        Calculator calc = new Calculator();
        int sum = calc.add(2, 3);
        int diff = calc.subtract(5, 2);
        
        System.out.println("Sum: " + sum);
        System.out.println("Diff: " + diff);
    }
    
    public static String greet(String name) {
        return "Hello, " + name + "!";
    }
    
    public static String farewell(String name) {
        return "Goodbye, " + name + "!";
    }
}
