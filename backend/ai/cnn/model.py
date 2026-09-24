import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from typing import Dict, List, Tuple
import warnings

class ImprovedLayoutAnalyzer(nn.Module):
    """
    Improved CNN model for CV layout analysis with multiple backbone options.
    Supports ResNet18, ResNet34, or EfficientNet for better accuracy.
    """
    def __init__(self, backbone='resnet18', num_classes=8, dropout_rate=0.3):
        super(ImprovedLayoutAnalyzer, self).__init__()
        
        self.backbone_name = backbone
        self.num_classes = num_classes
        self.section_map = {
            0: "header",
            1: "summary",
            2: "experience",
            3: "education",
            4: "skills",
            5: "certifications",
            6: "projects",
            7: "other"
        }
        
        # Load pre-trained backbone
        if backbone == 'resnet18':
            self.backbone = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
            num_features = self.backbone.fc.in_features
            self.backbone.fc = nn.Identity()
        elif backbone == 'resnet34':
            self.backbone = models.resnet34(weights=models.ResNet34_Weights.IMAGENET1K_V1)
            num_features = self.backbone.fc.in_features
            self.backbone.fc = nn.Identity()
        elif backbone == 'efficientnet_b0':
            self.backbone = models.efficientnet_b0(weights=models.EfficientNet_B0_Weights.IMAGENET1K_V1)
            num_features = self.backbone.classifier[1].in_features
            self.backbone.classifier = nn.Identity()
        else:
            raise ValueError(f"Unsupported backbone: {backbone}")
        
        # Custom classification head with regularization
        self.classifier = nn.Sequential(
            nn.Dropout(dropout_rate),
            nn.Linear(num_features, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout_rate),
            nn.Linear(256, 128),
            nn.ReLU(inplace=True),
            nn.Linear(128, num_classes)
        )
        
        # Store class weights for imbalanced training (optional)
        self.class_weights = None
        
    def forward(self, x):
        features = self.backbone(x)
        if self.backbone_name.startswith('efficientnet'):
            features = features.flatten(1)
        output = self.classifier(features)
        return output
    
    def predict_with_confidence(self, x):
        """Return predictions with softmax confidence scores"""
        logits = self.forward(x)
        probabilities = F.softmax(logits, dim=1)
        confidences, predictions = torch.max(probabilities, dim=1)
        return predictions, confidences
    
    def get_section_name(self, class_id):
        return self.section_map.get(class_id, "unknown")


class MultiScaleLayoutAnalyzer(nn.Module):
    """
    Enhanced model that analyzes patches at multiple scales for better context.
    """
    def __init__(self, base_model, num_scales=3):
        super(MultiScaleLayoutAnalyzer, self).__init__()
        self.base_model = base_model
        self.num_scales = num_scales
        
    def forward(self, x):
        # x is already resized to standard size
        return self.base_model(x)