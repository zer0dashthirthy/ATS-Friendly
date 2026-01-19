# ATS-Friendly CV Builder 🚀

A modern, web-based CV builder designed specifically to beat Applicant Tracking Systems (ATS). Create professional, clean, and high-scoring resumes in minutes.

![ATS-Friendly Banner](https://ats-friendly.github.io/ATS-Friendly/assets/og-image.png)

## ✨ Features

- **🤖 AI-Powered Parsing**: Upload your existing PDF resume and let Gemini 1.5 Pro automatically extract your details into the form.
- **📄 ATS-Optimized Templates**: Choose from "Classic", "Compact", "Elegant", or the photo-friendly "Modern" template designed with clean code structures that HR software can easily read.
- **🔗 Professional Connectivity**: Add your LinkedIn profile link to any template to ensure a complete, ATS-compatible professional profile.
- **☁️ Real-time Cloud Sync**: Your progress is automatically saved to Firebase Firestore. Start on your PC and finish on your phone.
- **🌍 Bilingual Support**: Full localization for both Turkish (TR) and English (EN) users.
- **🎨 Live Customization**: Adjust fonts, colors, margins, and section gaps in real-time with an interactive preview.
- **📱 Responsive UI**: Fully optimized for mobile devices with a specialized "bottom sheet" editor and scaled preview.
- **🔒 Secure & Private**: GDPR/KVKK compliant. Data is encrypted via SSL and stored securely in Firebase.

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 (Grid/Flexbox).
- **Backend**: Firebase Cloud Functions (Node.js).
- **Database & Auth**: Firebase Firestore & Firebase Authentication.
- **AI Engine**: Google Generative AI (Gemini 1.5 Pro).
- **PDF Processing**: PDF.js for client-side text extraction.

## 🚀 Getting Started

### Prerequisites
- Node.js installed.
- A Firebase project.
- A Google AI Studio API Key.

### Local Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/ats-friendly/ATS-Friendly.git
   ```
2. Navigate to the project folder and install function dependencies:
   ```bash
   cd functions && npm install
   ```
3. Configure your Firebase environment:
   - Update `firebaseConfig` in `script.js` with your project credentials.
   - Set up your Gemini API Key using Firebase Secrets:
     ```bash
     firebase functions:secrets:set GEMINI_API_KEY
     ```

### Deployment
Deploy to Firebase Hosting and Functions:
```bash
firebase deploy
```

## 🛡️ Security
This project includes built-in XSS prevention using HTML escaping for all user-generated content in the CV preview pane.

## 📄 License
© 2026 ATS-Friendly CV Maker. All rights reserved.
