# 🛡️ Abusive Comment Detector

A Chrome extension and Python backend for real-time detection and filtering of toxic or hate comments using AI. Powered by a fine-tuned RoBERTa model, this project helps keep online conversations safe and respectful.

## Features
- Chrome extension for automatic comment analysis and filtering on major social platforms
- Flask API serving toxicity predictions from a multi-label RoBERTa model
- Streamlit app for interactive text toxicity analysis
- Modern dark-themed popup UI with stats and test input
- Multi-label classification: toxic, severe_toxic, obscene, threat, insult, identity_hate

## Folder Structure
```
Toxic-Comment-Detector/
├── app.py                # Flask backend API
├── app_streamlit.py      # Streamlit UI app
├── predict.py            # Model loading and inference logic
├── requirements.txt      # Python dependencies
├── best_twitter_roberta/ # Fine-tuned RoBERTa model files
├── toxic_model/          # Additional model weights
├── toxic-comment-extension/
│   └── toxic-comment-extension/
│       ├── manifest.json
│       ├── background.js
│       ├── content.js
│       ├── popup.html
│       ├── popup.js
│       ├── popup.css
│       ├── styles.css
│       └── icons/
├── README.md
└── ...
```

## Quick Start
### 1. Python Backend
```bash
python -m venv venv
venv\Scripts\activate  # On Windows
pip install -r requirements.txt
python app.py
```
- The API runs at `http://127.0.0.1:5000/predict`.

### 2. Streamlit App
```bash
streamlit run app_streamlit.py
```

### 3. Chrome Extension
- Go to `chrome://extensions` in your browser
- Enable "Developer mode"
- Click "Load unpacked" and select `toxic-comment-extension/toxic-comment-extension/`
- The extension icon will appear in your browser toolbar

## Usage
- The extension automatically checks comments for toxicity and blurs/block toxic ones
- The popup UI shows stats and lets you test any text for toxicity
- The backend API can be used independently for other integrations

## Model
- Fine-tuned RoBERTa (multi-label, 6 categories)
- Model files in `best_twitter_roberta/` (not included in repo).

### Download the Model from Hugging Face

**Note:** The model files are not included in this repository due to their size. You must manually download the model from Hugging Face before running the backend or Streamlit app.

- Model name: `cardiffnlp/twitter-roberta-base`
- Download from: https://huggingface.co/cardiffnlp/twitter-roberta-base

After downloading, place all model files into the `best_twitter_roberta/` directory in the project root.

## Contributing
Pull requests and suggestions are welcome! Please open an issue for major changes.

## License
MIT

## Project Outputs

### Map View
![Map View](images/map_view.png)

### Filter Demo
![Filter Demo](images/filter_demo.png)

