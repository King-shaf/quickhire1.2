import cv2
import numpy as np

class ImagePreprocessor:
    def preprocess_image(self, image):
        """
        Preprocess image for better OCR accuracy.
        1. Grayscale
        2. Noise reduction (Gaussian Blur)
        3. Thresholding (Binarization)
        """
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        denoised = cv2.GaussianBlur(gray, (5, 5), 0)
        _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        return thresh

    def deskew(self, image):
        """
        Deskew image to correct rotation.
        """
        coords = np.column_stack(np.where(image > 0))
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
        
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        return rotated
