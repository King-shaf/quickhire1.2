import cv2
import pytesseract
import numpy as np
import os
from .preprocess import ImagePreprocessor
from .pdf_converter import PDFConverter

class OCRProcessor:
    def __init__(self, tesseract_cmd=None):
        import platform
        if tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = tesseract_cmd
        elif platform.system() == 'Windows':
            default_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
            if os.path.exists(default_path):
                pytesseract.pytesseract.tesseract_cmd = default_path
                
        self.preprocessor = ImagePreprocessor()
        self.pdf_converter = PDFConverter()

    def extract_text_from_image(self, image):
        """
        Extract text from a single image using Tesseract.
        """
        try:
            processed_img = self.preprocessor.preprocess_image(image)
            # Using --oem 3 (Default) --psm 6 (Assume a single uniform block of text)
            config = r'--oem 3 --psm 6'
            data = pytesseract.image_to_data(processed_img, config=config, output_type=pytesseract.Output.DICT)
            
            text = " ".join([word for i, word in enumerate(data['text']) if int(data['conf'][i]) > 0])
            # Calculate average confidence
            confidences = [int(c) for c in data['conf'] if int(c) > 0]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0
            
            return text, avg_confidence
        except Exception as e:
            print(f"Warning: Tesseract OCR failed ({e}). Returning empty text.")
            return "", 0.0

    def process_pdf(self, pdf_path):
        """
        Convert PDF to images and extract text from each page.
        """
        images = self.pdf_converter.process_pdf(pdf_path)
        full_text = ""
        total_confidence = 0
        
        for img in images:
            text, confidence = self.extract_text_from_image(img)
            full_text += text + "\n\n"
            total_confidence += confidence
            
        avg_confidence = total_confidence / len(images) if images else 0
        return full_text, avg_confidence

    def process_file(self, file_path):
        """
        Main entry point for processing a file (PDF or Image).
        """
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.pdf':
            return self.process_pdf(file_path)
        elif ext in ['.jpg', '.jpeg', '.png']:
            img = cv2.imread(file_path)
            if img is None:
                raise ValueError(f"Could not read image file: {file_path}")
            return self.extract_text_from_image(img)
        else:
            raise ValueError(f"Unsupported file format: {ext}")
