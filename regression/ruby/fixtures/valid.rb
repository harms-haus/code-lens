# frozen_string_literal: true

# Simple module with methods
module Greeter
  def self.greet(name)
    "Hello, #{name}!"
  end

  def self.farewell(name)
    "Goodbye, #{name}!"
  end
end

# Calculator class
class Calculator
  def add(a, b)
    a + b
  end

  def subtract(a, b)
    a - b
  end
end

# Student class
class Student
  def initialize(name)
    @name = name
  end

  def greet
    "Hello, I'm #{@name}!"
  end
end
