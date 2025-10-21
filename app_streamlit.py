import streamlit as st
from predict import predict_comment

st.set_page_config(page_title="AI- Powered Toxicity Detector",
                   page_icon="🛡️", layout="centered")

st.title("Shield Your Community from Hate Speech")
st.write("Type any comment below—see how AI can help keep conversations safe and respectful.")

text = st.text_area("Paste or type any message here...", height=100)


if st.button("🔍 Check Toxicity"):
    if not text.strip():
        st.warning("❗Please enter some text!")
    else:
        result = predict_comment(text)
        # Use explicit fields when available: show toxicity for toxic case,
        # and non-toxic confidence for non-toxic case.
        toxicity_score = result.get(
            "toxicity_score", result["probability"])  # backward compat
        non_toxic_conf = result.get(
            "non_toxic_confidence", max(0.0, 1 - toxicity_score))
        if result["label"] == "toxic":
            st.error(f"⚠️ Toxic (Toxicity: {round(toxicity_score * 100, 2)}%)")
            # Show detected categories
            toxic_categories = [cat.replace("_", " ").title(
            ) for cat, present in result["categories"].items() if present]
            if toxic_categories:
                st.markdown(
    """
    <style>
    .reason-box:hover {
        background-color: #28527a !important;
        box-shadow: 0 0 8px #60aaff33;
        cursor: pointer;
    }
    </style>
    <div class='reason-box' style='background-color:#18324a;padding:12px 18px;border-radius:14px;transition:background 0.2s'>
        <span style='color:#60aaff;font-weight:600'>Reason(s):</span>
        <span style='color:#60aaff'>Toxic, Obscene, Insult</span>
    </div>
    """,
    unsafe_allow_html=True
)
        else:
            st.success(
                f"✅ Not Toxic (Confidence: {round(non_toxic_conf * 100, 2)}%)")
