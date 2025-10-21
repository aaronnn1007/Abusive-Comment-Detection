from flask import Flask, request, jsonify
from flask_cors import CORS
from predict import predict_comment
import os

app = Flask(__name__)
"""
Allow cross-origin requests so the Chrome extension's content scripts
running on https sites (e.g., YouTube) can call the local API.
We allow all origins on /predict for simplicity during development.
Tighten this as needed for production.
"""
CORS(app, resources={r"/predict": {"origins": "*"}})

# Allow requests from any origin (frontend, browser, extension)
# CORS(app, resources={r"/*": {"origins": "*"}})


@app.route("/")
def home():
    # Return a minimal message since we don't use templates anymore
    return "Toxic Comment Detector API", 200


@app.route("/healthz")
def healthz():
    return jsonify({"status": "ok"}), 200


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json(silent=True)
        if not data or "text" not in data:
            return jsonify({"error": "Text input is missing"}), 400

        text = data.get("text", "")
        print("🔍 Received text:", text)
        result = predict_comment(text)
        print("✅ Sending result:", result)
        return jsonify(result)
    except Exception as e:
        # Log full traceback to server console and return JSON error to client
        import traceback
        tb = traceback.format_exc()
        print("❌ Exception in /predict:\n", tb)
        return jsonify({
            "error": "Internal Server Error",
            "message": str(e),
            "traceback": tb
        }), 500


@app.after_request
def add_pna_header(resp):
    """Add Private Network Access header for localhost usage from HTTPS pages."""
    # Only add for our API responses
    try:
        if request.path == "/predict":
            resp.headers["Access-Control-Allow-Private-Network"] = "true"
    except Exception:
        pass
    return resp


if __name__ == "__main__":
    # Use PORT if provided by hosting (e.g., Render/Heroku), otherwise 5000 for local dev
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host='0.0.0.0', port=port)


# from flask import render_template
# from flask import Flask, request, jsonify
# from flask_cors import CORS
# from predict import predict_comment

# app = Flask(__name__)
# CORS(app)

# @app.route("/")
# def home():
#     return render_template("index.html")

# # More specific CORS configuration
# CORS(app, origins=[
#     "chrome-extension://*",
#     "http://localhost:3000",  # for your React app
#     "http://127.0.0.1:3000"
# ])

# @app.route("/predict", methods=["POST"])
# def predict():
#     data = request.get_json()
#     text = data.get("text", "")
#     if not text:
#         return jsonify({"error": "Text input is missing"}), 400

#     result = predict_comment(text)
#     return jsonify(result)

# if __name__ == "__main__":
#     app.run(debug=True, host='0.0.0.0', port=5000)

# @app.route('/predict', methods=['POST'])
# def predict_api():
#     data = request.get_json()
#     print("🔍 Received text:", data)
#     result = predict_comment(data["text"])
#     print("✅ Sending result:", result)
#     return jsonify(result)


# from flask import Flask, request, jsonify
# from flask_cors import CORS
# from predict import predict_comment  # your BERT prediction logic

# app = Flask(__name__)
# CORS(app)  # enable CORS

# @app.route("/predict", methods=["POST"])
# def predict():
#     data = request.get_json()
#     text = data.get("text", "")
#     if not text:
#         return jsonify({"error": "Text input is missing"}), 400

#     result = predict_comment(text)
#     return jsonify(result)

# if __name__ == "__main__":
#     app.run(debug=True)
