const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { defineSecret } = require('firebase-functions/params');

// Securely store your API key in Firebase Secrets
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

exports.parseResumeWithAI = onCall({ secrets: [GEMINI_API_KEY] }, async (request) => {
    // 1. Authentication Check (Optional but recommended for production)
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "This function must be called by a logged-in user.");
    }

    const { text } = request.data;
    if (!text) {
        throw new HttpsError("invalid-argument", "The function must be called with a 'text' argument.");
    }

    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

        const prompt = `
            Extract the following information from the resume text provided below. 
            Return the data STRICTLY as a JSON object with these keys: 
            fullname, title, email, phone, address, linkedin, summary, experiences (array of {title, company, date, desc}), education (array of {school, degree, date}).
            
            If a field is not found, return an empty string or empty array. 
            Translate any non-English headers if necessary to match the keys.
            Do not add any markdown formatting or extra text - return ONLY the JSON object.
            
            RESUME TEXT:
            ${text}
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        // Clean JSON response (AI sometimes adds ```json markers)
        const cleanedJson = responseText.replace(/```json|```/g, "").trim();
        return JSON.parse(cleanedJson);

    } catch (error) {
        console.error("Gemini AI Error:", error);
        throw new HttpsError("internal", "Error parsing resume with AI: " + error.message);
    }
});
