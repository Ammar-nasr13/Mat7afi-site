# Mat7afi Website Architecture

This directory contains the source code for the official Minya University Museums (Mat7afi) website.

## Directory Structure

- `index.html`: Home page with marketing features and AI assistant.
- `museum.html`: Artifact explorer with live search functionality.
- `artifact.html`: Individual artifact detail view (mobile-first).
- `reset-password.html`: Secure password recovery with a 90s timer.
- `style.css`: Centralized design system and responsive styles.
- `script.js`: Client-side logic, Appwrite integration, and OpenAI chatbot.
- `assets/`: Images and branding assets.
- `robots.txt` & `sitemap.xml`: SEO optimization files.

## Technical Stack

- **Frontend**: Vanilla HTML/JS/CSS, Bootstrap 5.3, AOS.
- **Backend-as-a-Service**: Appwrite (Database & Storage).
- **AI Service**: OpenAI API (Ego Pro Chatbot).

## Key Features

1. **Live Search**: Instant filtering of museum artifacts by name or description.
2. **AI Assistant**: Interactive GPT-3.5 chatbot for museum queries.
3. **Security Timer**: Automatic session expiration on the password reset page.
4. **Professional SEO**: Full meta-tag suite, JSON-LD structured data, and search engine crawling rules.
5. **Responsive Design**: Fully optimized for mobile, tablet, and desktop screens.

## Deployment

Simply upload all files in this directory to your web server. Ensure your Appwrite endpoint and OpenAI API key are correctly configured in `script.js`.
