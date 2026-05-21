package com.regression;

public class Broken {
    public static void main(String[] args) {
        String x = 42;
        nonexistentMethod();
        int[] arr = new int[3];
        int val = arr[10];
    }
}
