# Regression Testing - Execution Commands

This document lists the commands to run the regression test suite. The test cases have been segregated by persona, and you can run them individually or as a complete suite.

---

## **1. Run All Test Cases**
To execute all test cases across all personas (Graph, HR, Tender, Asset Manager):
```bash
python -m regression.main
```
*Alternatively, you can be explicit:*
```bash
python -m regression.main --persona all
```

---

## **2. Persona-Specific Execution**
To run tests only for a specific persona, use the `--persona` flag:

### **Graph Persona**
```bash
python -m regression.main --persona graph
```

### **HR Persona**
```bash
python -m regression.main --persona hr
```

### **Tender Persona**
```bash
python -m regression.main --persona tender
```

### **Asset Manager Persona**
```bash
python -m regression.main --persona asset_manager
```

---

## **3. Command Help**
To view all available arguments and persona choices:
```bash
python -m regression.main --help
```

## **Results**
All execution results (Excel files) are automatically saved to the following directory:
`regression/results_regression/`