package com.regression;

public class Dog extends Animal {
    public Dog(String name) {
        super(name);
    }
    
    @Override
    public String speak() {
        return "Woof!";
    }
}
