#include <stdio.h>

int add(int a, int b) {
    return a + b;
}

int subtract(int a, int b) {
    return a - b;
}

typedef struct {
    int x;
    int y;
} Point;

Point create_point(int x, int y) {
    Point p;
    p.x = x;
    p.y = y;
    return p;
}

int main() {
    int sum = add(3, 4);
    printf("Sum: %d\n", sum);

    Point p = create_point(1, 2);
    printf("Point: (%d, %d)\n", p.x, p.y);

    return 0;
}
