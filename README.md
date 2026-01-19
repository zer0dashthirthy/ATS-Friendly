# ATS-Friendly CV Builder

A professional web-based application designed to generate resumes optimized for Applicant Tracking Systems (ATS). This tool ensures high readability for automated recruitment software while maintaining a sophisticated visual presentation for human reviewers.

## Key Features

- **AI-Powered Resume Parsing**: Integration with Google Gemini 1.5 Pro for automated data extraction from legacy PDF resumes.
- **Standardized Templates**: Clean, valid HTML/CSS structures for "Classic", "Compact", "Elegant", and "Modern" layouts.
- **Cross-Platform Synchronization**: Real-time data persistence using Firebase Firestore for seamless transitions between desktop and mobile environments.
- **Internationalization**: Comprehensive support for English and Turkish localization.
- **Dynamic Layout Engine**: Real-time adjustment of typography, margins, and section spacing via an interactive interface.
- **Mobile Optimization**: Specialized responsive editor and scaled preview engine for professional mobile use.
- **Security Compliance**: GDPR and KVKK compliant data handling with SSL encryption.

## Architecture and Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 (Grid and Flexbox).
- **Backend**: Firebase Cloud Functions (Node.js runtime).
- **Database**: Firebase Firestore.
- **Authentication**: Firebase Authentication.
- **AI Integration**: Google Generative AI (Gemini 1.5 Pro).
- **PDF Processing**: PDF.js for client-side text extraction and analysis.

## Installation and Setup

### Prerequisites

- Node.js (Long Term Support version recommended).
- Firebase Command Line Interface (CLI).
- Google AI Studio API Key.

### Local Configuration

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/ats-friendly/ATS-Friendly.git
   ```

2. **Install Dependencies**:
   Navigate to the `functions` directory and install the required Node.js packages:
   ```bash
   cd functions && npm install
   ```

3. **Firebase Environment**:
   - Initialize the Firebase project and update the `firebaseConfig` object in `script.js`.
   - Provision the Gemini API Key using Firebase Secrets:
     ```bash
     firebase functions:secrets:set GEMINI_API_KEY
     ```

## Usage and Deployment

### Development
To run the application locally, use a standard web server or the Firebase Hosting emulator:
```bash
firebase emulators:start
```

### Production Deployment
Deploy the frontend and backend components to the Firebase production environment:
```bash
firebase deploy
```

## Security

The application implements rigorous security protocols, including client-side HTML escaping to mitigate Cross-Site Scripting (XSS) risks for all user-generated content. Data is stored within the Firebase ecosystem with restricted access rules.

## License

This project is licensed under the MIT License.

### MIT License Blurb
Copyright (c) 2026 ATS-Friendly CV Maker

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
