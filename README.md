# DP Last - Automated Urbanism Document Generator

DP Last is a modern web application designed to streamline the creation of French urbanism documents, specifically **Déclaration Préalable (DP)** and **CERFA 13703*** forms. It leverages AI to automate complex descriptive tasks and features a brutalist, street-food inspired aesthetic.

## 🚀 Key Features

- **AI-Powered DP4 Generation**: Uses the Mistral-14B model via NVIDIA's API to analyze project details and uploaded photos to generate professional architectural notices.
- **Automated CERFA Mapping**: Automatically populates complex PDF forms based on user input, minimizing manual entry errors.
- **Dynamic PDF Generation**: Generates clean, compliant architectural documents with custom branding and styling.
- **Test Mode**: A dedicated toggle for developers and demonstrators to instantly populate the form with dummy data.
- **Brutalist UI**: A high-impact, premium user interface designed for speed and clarity.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: Tailwind CSS / Vanilla CSS
- **AI Integration**: Mistral-14B (Vision & Text) via [NVIDIA NIM](https://www.nvidia.com/en-us/ai/)
- **PDF Manipulation**: [pdf-lib](https://pdf-lib.js.org/)
- **Icons & UI**: Lucide React / Custom Brutalist Components

## 🏁 Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn
- An NVIDIA API Key (for DP4 AI generation)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ayouubmzariiii/DP-Last.git
   cd DP-Last
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env.local` file in the root directory and add your API keys:
   ```env
   NVIDIA_API_KEY=your_nvidia_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 📖 Usage

1. **Information Identity**: Enter the applicant's details (Individual or Company).
2. **Terrain & Address**: Specify where the work will take place.
3. **Travaux**: Describe the project and specific surfaces (Existante, Créée, Supprimée).
4. **Photos & Plans**: Upload project photos to power the AI vision analysis.
5. **Génération**: Trigger the AI to write your DP4 notice and download the final signed PDFs.

## 🧪 Test Mode

For rapid testing, toggle **"Test Mode"** in the navigation bar. This will fill all form fields with valid dummy data, allowing you to jump straight to the generation step.

## 📄 License

Proprietary. All rights reserved.
