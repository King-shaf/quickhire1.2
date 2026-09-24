import torch
import torch.nn.functional as F
from torchvision import transforms
from PIL import Image
import cv2
import numpy as np
from typing import Tuple, List, Dict, Optional
from .model import ImprovedLayoutAnalyzer

class ImprovedLayoutPredictor:
    def __init__(self, model_path=None, device='cpu', backbone='resnet18', 
                 confidence_threshold=0.6):
        self.device = device
        self.confidence_threshold = confidence_threshold
        self.model = ImprovedLayoutAnalyzer(backbone=backbone)
        
        if model_path:
            try:
                # Load with flexibility for different model formats
                state_dict = torch.load(model_path, map_location=device)
                if 'model_state_dict' in state_dict:
                    state_dict = state_dict['model_state_dict']
                self.model.load_state_dict(state_dict, strict=False)
                print(f"Successfully loaded CNN weights from {model_path}")
            except Exception as e:
                print(f"Warning: Could not load CNN weights from {model_path}: {e}")
                print("Using randomly initialized model (for testing only)")
        
        self.model.eval()
        self.model.to(device)
        
        # Enhanced transformations with augmentation options
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.RandomHorizontalFlip(p=0.0),  # No flip during inference
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                               std=[0.229, 0.224, 0.225]),
        ])
        
        # For confidence calibration
        self.temperature = 1.0  # For temperature scaling if needed
        
    def preprocess_patch(self, patch_img, enhance=False):
        """
        Preprocess image patch with optional enhancement.
        """
        if isinstance(patch_img, np.ndarray):
            # Convert BGR to RGB
            if len(patch_img.shape) == 3 and patch_img.shape[2] == 3:
                patch_img = cv2.cvtColor(patch_img, cv2.COLOR_BGR2RGB)
            patch_img = Image.fromarray(patch_img)
        
        # Optional image enhancement for low-quality patches
        if enhance:
            if patch_img.mode == 'RGB':
                # Increase contrast slightly
                import torchvision.transforms.functional as TF
                patch_img = TF.adjust_contrast(patch_img, contrast_factor=1.2)
        
        return self.transform(patch_img)
    
    def predict_patch(self, patch_img, return_confidence=True, 
                      return_all_probs=False) -> Tuple[int, str, Optional[float], Optional[np.ndarray]]:
        """
        Predict the section of a single image patch.
        
        Args:
            patch_img: PIL Image or numpy array
            return_confidence: If True, return confidence score
            return_all_probs: If True, return all class probabilities
            
        Returns:
            class_id, section_name, confidence (if requested), probabilities (if requested)
        """
        input_tensor = self.preprocess_patch(patch_img).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            logits = self.model(input_tensor)
            probabilities = F.softmax(logits / self.temperature, dim=1)
            confidence, predicted = torch.max(probabilities, dim=1)
            
        class_id = predicted.item()
        section_name = self.model.get_section_name(class_id)
        confidence_score = confidence.item()
        
        results = (class_id, section_name)
        
        if return_confidence:
            results = (class_id, section_name, confidence_score)
        
        if return_all_probs:
            all_probs = probabilities.cpu().numpy()[0]
            results = (class_id, section_name, confidence_score, all_probs)
            
        return results
    
    def predict_batch(self, patches: List[np.ndarray]) -> List[Dict]:
        """
        Predict sections for multiple patches in batch.
        """
        batch_tensors = []
        for patch in patches:
            tensor = self.preprocess_patch(patch)
            batch_tensors.append(tensor)
        
        batch = torch.stack(batch_tensors).to(self.device)
        
        with torch.no_grad():
            logits = self.model(batch)
            probabilities = F.softmax(logits / self.temperature, dim=1)
            confidences, predictions = torch.max(probabilities, dim=1)
        
        results = []
        for i, (pred, conf) in enumerate(zip(predictions, confidences)):
            results.append({
                'class_id': pred.item(),
                'section': self.model.get_section_name(pred.item()),
                'confidence': conf.item(),
                'probabilities': probabilities[i].cpu().numpy()
            })
        
        return results