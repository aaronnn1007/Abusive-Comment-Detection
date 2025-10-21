# predict.py

import os
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch.nn.functional as F

"""
Model loader and predictor, adapted to prefer a local RoBERTa model folder.

Priority order for loading:
1) Environment variable TOXIC_MODEL_LOCAL_DIR
2) Local folder ./best_twitter_roberta
3) Fallback public model name (RoBERTa-based if possible)

Label handling is dynamic based on model.config:
- Multi-label: sigmoid per label
- Binary single-label: softmax and take class-1 as toxic (or the class whose name contains 'toxic')
- Single output (num_labels == 1): sigmoid on the single logit
"""

# Prefer local RoBERTa fine-tuned model when available
DEFAULT_LOCAL_DIR = os.path.join(
    os.path.dirname(__file__), "best_twitter_roberta")
# public RoBERTa toxic/offensive
FALLBACK_MODEL_NAME = "cardiffnlp/twitter-roberta-base-offensive"

# Optional: set env var TOXIC_MODEL_LOCAL_DIR to the local folder containing
# the downloaded model files (config.json, safetensors/bin, tokenizer files, etc.)
LOCAL_DIR = os.environ.get("TOXIC_MODEL_LOCAL_DIR", DEFAULT_LOCAL_DIR)


def _load_tokenizer_and_model():
    # Try local directory first
    if LOCAL_DIR and os.path.isdir(LOCAL_DIR):
        try:
            local_tokenizer = AutoTokenizer.from_pretrained(
                LOCAL_DIR, local_files_only=True
            )
            local_model = AutoModelForSequenceClassification.from_pretrained(
                LOCAL_DIR, local_files_only=True
            )
            local_model.eval()
            return local_tokenizer, local_model
        except Exception:
            pass
    # Fallback to a public RoBERTa model
    remote_tokenizer = AutoTokenizer.from_pretrained(FALLBACK_MODEL_NAME)
    remote_model = AutoModelForSequenceClassification.from_pretrained(
        FALLBACK_MODEL_NAME
    )
    remote_model.eval()
    return remote_tokenizer, remote_model


tokenizer, model = _load_tokenizer_and_model()

# Derive label names from model config when available


def _get_label_names():
    config = getattr(model, "config", None)
    if not config:
        return None
    id2label = getattr(config, "id2label", None)
    num_labels = getattr(config, "num_labels", None)

    if isinstance(id2label, dict) and len(id2label) > 0:
        # Ensure order by id
        ordered = [id2label[i] for i in sorted(id2label.keys())]

        # If we have 6 generic labels, map to Jigsaw categories
        if len(ordered) == 6 and all(str(x).startswith("LABEL_") for x in ordered):
            jigsaw_labels = [
                "toxic", "severe_toxic", "obscene", "threat", "insult", "identity_hate"
            ]
            return jigsaw_labels

        # Normalize common patterns
        lower = [str(x).lower() for x in ordered]
        # If labels are generic like LABEL_0.., keep going to try better names below
        if not all(l.startswith("label_") for l in lower):
            return ordered

    if num_labels is None:
        return None
    if num_labels == 2:
        # Generic binary toxic vs non-toxic
        return ["non_toxic", "toxic"]
    if num_labels == 1:
        return ["toxic"]
    if num_labels == 6:
        # Default 6-label mapping for toxic comment classification
        return ["toxic", "severe_toxic", "obscene", "threat", "insult", "identity_hate"]
    # Fallback generic labels
    return [f"LABEL_{i}" for i in range(num_labels)]


CATEGORY_NAMES = _get_label_names()


def predict_comment(text: str):
    inputs = tokenizer(text, return_tensors="pt",
                       truncation=True, padding=True)
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits[0]

    config = getattr(model, "config", None)
    num_labels = getattr(config, "num_labels",
                         logits.shape[-1]) if config else logits.shape[-1]
    problem_type = getattr(config, "problem_type", None) if config else None

    categories = {}

    if num_labels == 1:
        # Single output: interpret as toxicity score via sigmoid
        prob_toxic = torch.sigmoid(logits.squeeze()).item()
        toxicity_score = float(prob_toxic)
        toxic_any = toxicity_score > 0.5
        non_toxic_confidence = float(1.0 - toxicity_score)
        if CATEGORY_NAMES:
            categories = {CATEGORY_NAMES[0]: toxic_any}
    else:
        if problem_type == "multi_label_classification" or num_labels > 2:
            probs = torch.sigmoid(logits).cpu().numpy()
            toxicity_score = float(probs.max())
            toxic_any = bool((probs > 0.5).any())
            if CATEGORY_NAMES:
                categories = {name: bool(probs[idx] > 0.5)
                              for idx, name in enumerate(CATEGORY_NAMES)}
            else:
                categories = {f"LABEL_{i}": bool(
                    probs[i] > 0.5) for i in range(num_labels)}
            non_toxic_confidence = float(1.0 - toxicity_score)
        else:
            # Binary single-label classification: softmax
            probs = torch.softmax(logits, dim=-1).cpu().numpy()
            # Choose toxic index: prefer label name containing 'toxic'
            toxic_idx = 1
            if CATEGORY_NAMES:
                for i, name in enumerate(CATEGORY_NAMES):
                    if isinstance(name, str) and ("toxic" in name.lower()):
                        toxic_idx = i
                        break
            toxicity_score = float(probs[toxic_idx])
            toxic_any = toxicity_score > 0.5
            non_toxic_confidence = float(1.0 - toxicity_score)
            if CATEGORY_NAMES:
                categories = {name: (i == toxic_idx and toxic_any)
                              for i, name in enumerate(CATEGORY_NAMES)}

    return {
        "label": "toxic" if toxic_any else "non-toxic",
        "probability": toxicity_score,
        "toxicity_score": toxicity_score,
        "non_toxic_confidence": non_toxic_confidence,
        "categories": categories,
    }
