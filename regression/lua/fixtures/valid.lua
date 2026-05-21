local M = {}

function M.greet(name)
    return "Hello, " .. name .. "!"
end

function M.farewell(name)
    return "Goodbye, " .. name .. "!"
end

local Calculator = {}
Calculator.__index = Calculator

function Calculator.new()
    local self = setmetatable({}, Calculator)
    return self
end

function Calculator:add(a, b)
    return a + b
end

function Calculator:subtract(a, b)
    return a - b
end

local calc = Calculator.new()
local result = calc:add(2, 3)

M.greet("World")

return M
