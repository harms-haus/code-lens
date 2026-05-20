def broken() -> str:
    x: str = 42  # type error
    return x

def undefined_call():
    return nonexistent_function()  # name error
