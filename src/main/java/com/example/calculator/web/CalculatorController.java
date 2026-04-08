package com.example.calculator.web;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CalculatorController {

  @PostMapping(value = "/api/calculate", consumes = MediaType.APPLICATION_JSON_VALUE)
  public CalculateResponse calculate(@RequestBody CalculateRequest req) {
    double a = req.a();
    double b = req.b();
    String op = req.op() == null ? "+" : req.op().trim();
    double result =
        switch (op) {
          case "+" -> a + b;
          case "-" -> a - b;
          case "*" -> a * b;
          case "/" -> b == 0 ? Double.NaN : a / b;
          default -> throw new IllegalArgumentException("Unsupported operator: " + op);
        };
    return new CalculateResponse(result);
  }

  public record CalculateRequest(double a, double b, String op) {}

  public record CalculateResponse(double result) {}
}
