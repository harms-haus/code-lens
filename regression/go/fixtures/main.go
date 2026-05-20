package main

import "fmt"

func greet(name string) string {
	return fmt.Sprintf("Hello, %s!", name)
}

func farewell(name string) string {
	return fmt.Sprintf("Goodbye, %s!", name)
}

type Calculator struct {
	result int
}

func NewCalculator() *Calculator {
	return &Calculator{result: 0}
}

func (c *Calculator) Add(a int, b int) int {
	c.result = a + b
	return c.result
}

func main() {
	message := greet("world")
	fmt.Println(message)

	calc := NewCalculator()
	sum := calc.Add(3, 4)
	fmt.Println(sum)
}
