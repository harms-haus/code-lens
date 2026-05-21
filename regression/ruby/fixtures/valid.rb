# frozen_string_literal: true

def greet(name)
  "Hello, #{name}!"
end

def farewell(name)
  "Goodbye, #{name}!"
end

class Calculator
  def add(a, b)
    a + b
  end

  def subtract(a, b)
    a - b
  end
end

class Student
  def initialize(name)
    @name = name
  end

  def greet
    "Hello, I'm #{@name}!"
  end
end

# Call functions to avoid unused variable warnings
greet("World")
Calculator.new.add(1, 2)
