package com.regression;

public abstract class Animal {
    private String name;
    
    public Animal(String name) {
        this.name = name;
    }
    
    public abstract String speak();
    
    public String getName() {
        return name;
    }
}
