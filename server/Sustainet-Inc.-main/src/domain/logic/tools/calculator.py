from typing import Any, Dict

class CalculatorTools:
    """Basic calculator tools for the game"""
    
    def __init__(self):
        self.name = "calculator"
        self.description = "Basic calculator for arithmetic operations"
    
    def execute(self, operation: str, **kwargs) -> Dict[str, Any]:
        """
        Execute a calculator operation
        
        Args:
            operation: The operation to execute
            **kwargs: Additional arguments
            
        Returns:
            Dict containing the result
        """
        try:
            a = float(kwargs.get("a", 0))
            b = float(kwargs.get("b", 0))
            
            if operation == "add":
                result = a + b
            elif operation == "subtract":
                result = a - b
            elif operation == "multiply":
                result = a * b
            elif operation == "divide":
                if b == 0:
                    raise ValueError("Cannot divide by zero")
                result = a / b
            else:
                raise ValueError(f"Unknown operation: {operation}")
                
            return {
                "success": True,
                "result": result,
                "operation": operation
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "operation": operation
            } 