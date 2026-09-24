import cv2
import numpy as np
from typing import List, Dict, Tuple, Optional
from .predict import ImprovedLayoutPredictor

class ImprovedLayoutSegmenter:
    def __init__(self, model_path=None, device='cpu', backbone='resnet18',
                 sliding_window_size=(224, 224), stride=112, min_confidence=0.5):
        self.predictor = ImprovedLayoutPredictor(model_path, device, backbone)
        self.sliding_window_size = sliding_window_size
        self.stride = stride
        self.min_confidence = min_confidence
        
    def extract_sliding_windows(self, image: np.ndarray) -> List[Dict]:
        """
        Extract overlapping sliding windows for fine-grained analysis.
        """
        h, w = image.shape[:2]
        windows = []
        window_h, window_w = self.sliding_window_size
        
        for y in range(0, h - window_h + 1, self.stride):
            for x in range(0, w - window_w + 1, self.stride):
                window = image[y:y+window_h, x:x+window_w]
                windows.append({
                    'bbox': [x, y, x+window_w, y+window_h],
                    'image': window
                })
        
        return windows
    
    def merge_predictions(self, windows: List[Dict]) -> List[Dict]:
        """
        Merge overlapping window predictions into coherent sections.
        Uses non-maximum suppression and voting.
        """
        if not windows:
            return []
        
        # Group by predicted section
        sections_by_type = {}
        for win in windows:
            section = win['predicted_section']
            if section not in sections_by_type:
                sections_by_type[section] = []
            sections_by_type[section].append(win)
        
        # Merge overlapping boxes for each section type
        merged_sections = []
        for section_type, wins in sections_by_type.items():
            # Sort by confidence
            wins.sort(key=lambda x: x['confidence'], reverse=True)
            
            # Non-maximum suppression
            merged_boxes = []
            for win in wins:
                bbox = win['bbox']
                if not merged_boxes:
                    merged_boxes.append(win)
                    continue
                
                # Check overlap with existing boxes
                overlap = False
                for existing in merged_boxes:
                    if self._calculate_iou(bbox, existing['bbox']) > 0.3:
                        overlap = True
                        break
                
                if not overlap:
                    merged_boxes.append(win)
            
            merged_sections.extend(merged_boxes)
        
        # Sort by vertical position
        merged_sections.sort(key=lambda x: x['bbox'][1])
        
        return merged_sections
    
    def _calculate_iou(self, box1, box2):
        """Calculate Intersection over Union of two bounding boxes."""
        x1 = max(box1[0], box2[0])
        y1 = max(box1[1], box2[1])
        x2 = min(box1[2], box2[2])
        y2 = min(box1[3], box2[3])
        
        intersection = max(0, x2 - x1) * max(0, y2 - y1)
        area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
        area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
        union = area1 + area2 - intersection
        
        return intersection / union if union > 0 else 0
    
    def segment_cv_adaptive(self, image: np.ndarray, method='sliding_window') -> List[Dict]:
        """
        Segment CV using adaptive method based on document structure.
        
        Args:
            image: CV image (BGR format from OpenCV)
            method: 'sliding_window', 'heuristic', or 'hybrid'
            
        Returns:
            List of sections with bbox, section type, and confidence
        """
        if method == 'sliding_window':
            return self._segment_sliding_window(image)
        elif method == 'heuristic':
            return self._segment_heuristic(image)
        elif method == 'hybrid':
            return self._segment_hybrid(image)
        else:
            raise ValueError(f"Unknown method: {method}")
    
    def _segment_sliding_window(self, image: np.ndarray) -> List[Dict]:
        """
        Fine-grained segmentation using sliding window approach.
        """
        # Extract sliding windows
        windows = self.extract_sliding_windows(image)
        
        # Predict for each window (batch processing)
        for i in range(0, len(windows), 16):  # Batch size 16
            batch = windows[i:i+16]
            patches = [w['image'] for w in batch]
            predictions = self.predictor.predict_batch(patches)
            
            for j, pred in enumerate(predictions):
                batch[j]['predicted_section'] = pred['section']
                batch[j]['confidence'] = pred['confidence']
                batch[j]['class_id'] = pred['class_id']
                batch[j]['probabilities'] = pred['probabilities']
        
        # Merge overlapping predictions
        sections = self.merge_predictions(windows)
        
        # Filter by confidence
        sections = [s for s in sections if s['confidence'] >= self.min_confidence]
        
        return sections
    
    def _segment_heuristic(self, image: np.ndarray) -> List[Dict]:
        """
        Improved heuristic segmentation with dynamic sizing.
        """
        h, w = image.shape[:2]
        sections = []
        
        # Detect if CV has header (based on text density at top)
        top_region = image[0:int(h*0.15), 0:w]
        top_density = self._calculate_text_density(top_region)
        
        # Adjust section boundaries based on content
        if top_density > 0.3:  # Dense text suggests header
            header_height = int(h * 0.2)
        else:
            header_height = int(h * 0.1)
        
        # More sophisticated segmentation
        section_boundaries = self._detect_section_boundaries(image)
        
        for i, (start, end) in enumerate(section_boundaries):
            patch = image[start:end, 0:w]
            if patch.size == 0:
                continue
                
            class_id, section_name, confidence = self.predictor.predict_patch(patch)
            
            sections.append({
                'section': section_name,
                'bbox': [0, start, w, end],
                'confidence': confidence,
                'class_id': class_id
            })
        
        return sections
    
    def _segment_hybrid(self, image: np.ndarray) -> List[Dict]:
        """
        Hybrid approach: heuristic for coarse, sliding window for fine details.
        """
        # First, get coarse sections
        coarse_sections = self._segment_heuristic(image)
        
        # For each coarse section, apply sliding window for sub-sections
        fine_sections = []
        for section in coarse_sections:
            bbox = section['bbox']
            section_img = image[bbox[1]:bbox[3], bbox[0]:bbox[2]]
            
            if section_img.size == 0:
                continue
            
            # Apply sliding window within this section
            sub_windows = self.extract_sliding_windows(section_img)
            
            for win in sub_windows:
                win['bbox'][0] += bbox[0]  # Adjust coordinates
                win['bbox'][2] += bbox[0]
                win['bbox'][1] += bbox[1]
                win['bbox'][3] += bbox[1]
            
            # Predict and merge
            for i in range(0, len(sub_windows), 16):
                batch = sub_windows[i:i+16]
                patches = [w['image'] for w in batch]
                predictions = self.predictor.predict_batch(patches)
                
                for j, pred in enumerate(predictions):
                    batch[j]['predicted_section'] = pred['section']
                    batch[j]['confidence'] = pred['confidence']
            
            merged = self.merge_predictions(sub_windows)
            fine_sections.extend(merged)
        
        return fine_sections
    
    def _calculate_text_density(self, image: np.ndarray) -> float:
        """
        Calculate text density using edge detection.
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        density = np.sum(edges > 0) / (image.shape[0] * image.shape[1])
        return density
    
    def _detect_section_boundaries(self, image: np.ndarray) -> List[Tuple[int, int]]:
        """
        Detect natural section boundaries using horizontal line detection.
        """
        h, w = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Detect horizontal lines
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (w//10, 1))
        detected_lines = cv2.morphologyEx(gray, cv2.MORPH_OPEN, horizontal_kernel)
        
        # Find y-coordinates with significant line presence
        line_presence = np.sum(detected_lines > 0, axis=1)
        threshold = w * 0.3  # Line must span at least 30% of width
        boundary_y = np.where(line_presence > threshold)[0]
        
        # Cluster boundaries
        boundaries = [0]
        for y in boundary_y:
            if y - boundaries[-1] > h * 0.1:  # At least 10% height between boundaries
                boundaries.append(y)
        boundaries.append(h)
        
        # Create sections from boundaries
        sections = []
        for i in range(len(boundaries) - 1):
            if boundaries[i+1] - boundaries[i] > h * 0.05:  # Minimum section height
                sections.append((boundaries[i], boundaries[i+1]))
        
        return sections
    
    def visualize_sections(self, image: np.ndarray, sections: List[Dict], 
                          save_path: Optional[str] = None) -> np.ndarray:
        """
        Visualize detected sections with colored bounding boxes.
        """
        vis_image = image.copy()
        
        # Color map for different sections
        colors = {
            'header': (255, 0, 0),      # Blue
            'summary': (0, 255, 0),     # Green
            'experience': (0, 0, 255),  # Red
            'education': (255, 255, 0), # Cyan
            'skills': (255, 0, 255),    # Magenta
            'certifications': (0, 255, 255), # Yellow
            'projects': (128, 0, 128),  # Purple
            'other': (128, 128, 128)    # Gray
        }
        
        for section in sections:
            bbox = section['bbox']
            section_name = section['section']
            color = colors.get(section_name, (128, 128, 128))
            confidence = section.get('confidence', 0)
            
            # Draw rectangle
            cv2.rectangle(vis_image, (bbox[0], bbox[1]), (bbox[2], bbox[3]), color, 2)
            
            # Add label
            label = f"{section_name} ({confidence:.2f})"
            label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
            cv2.rectangle(vis_image, (bbox[0], bbox[1] - label_size[1] - 5),
                         (bbox[0] + label_size[0] + 5, bbox[1]), color, -1)
            cv2.putText(vis_image, label, (bbox[0] + 2, bbox[1] - 5),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        if save_path:
            cv2.imwrite(save_path, vis_image)
        
        return vis_image