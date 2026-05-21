local utils = require("valid")

local function call_greet()
    return utils.greet("Alice")
end

local function call_farewell()
    return utils.farewell("Bob")
end

call_greet()
call_farewell()
