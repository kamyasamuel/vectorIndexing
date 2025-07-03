#!/usr/bin/env python3
"""
Test script to verify that all required libraries are installed and functioning
"""
import os
import sys
import importlib

# List of required packages
REQUIRED_PACKAGES = [
    "fastapi",
    "uvicorn",
    "python-dotenv",
    "numpy",
    "requests",
    "PyPDF2",
    "python-docx",
    "pydantic",
    "pytesseract",
    "pdf2image",
    "PIL",
    "bs4",
    "python-multipart"
]

def check_package(package_name):
    """Check if a package is installed and importable"""
    try:
        importlib.import_module(package_name)
        return True
    except ImportError:
        return False

def main():
    """Main function to check all required packages"""
    print("Checking required packages...")
    missing_packages = []
    
    for package in REQUIRED_PACKAGES:
        if check_package(package):
            print(f"✅ {package}: OK")
        else:
            print(f"❌ {package}: MISSING")
            missing_packages.append(package)
    
    if missing_packages:
        print("\nMissing packages:")
        print("Run the following command to install them:")
        print(f"pip install {' '.join(missing_packages)}")
        return 1
    else:
        print("\nAll required packages are installed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())
