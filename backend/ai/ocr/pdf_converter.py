from pdf2image import convert_from_path
import cv2
import numpy as np

class PDFConverter:
    def process_pdf(self, pdf_path, dpi=300):
        """
        Convert PDF to images for each page.
        """
        try:
            images = convert_from_path(pdf_path, dpi=dpi)
            cv_images = []
            for img in images:
                # Convert PIL image to OpenCV format
                cv_img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
                cv_images.append(cv_img)
            return cv_images
        except Exception as e:
            print(f"Warning: PDF conversion failed ({e}).")
            return []
