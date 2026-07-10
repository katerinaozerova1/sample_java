package com.example.calculator.web;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CalculatorController {

  @PostMapping(value = "/api/calculate", consumes = MediaType.APPLICATION_JSON_VALUE)
  public CalculateResponse calculate(@RequestBody CalculateRequest request) {
    double a = request.a();
    double b = request.b();
    String operator = request.op() == null ? "+" : request.op().trim();
    double result =
        switch (operator) {
          case "*" -> a * b;    
          case "-" -> a - b;
          case "+" -> a + b;
          case "/" -> b == 0 ? Double.NaN : a / b;
          default -> throw new IllegalArgumentException("Unsupported operator: " + operator);
        };
    return new CalculateResponse(result);
  }

  public record CalculateRequest(double a, double b, String op) {}

  public record CalculateResponse(double result) {}
}
