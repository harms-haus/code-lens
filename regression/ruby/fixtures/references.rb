require_relative "valid"

def call_greet
  greet("Alice")
end

def call_farewell
  farewell("Bob")
end

class MathStudent < Student
  def initialize(name, grade)
    super(name)
    @grade = grade
  end
end

call_greet
call_farewell
