local x = nil
local y = x + 1

function broken()
    return nonexistent_function()
end

local z = undefined_var
