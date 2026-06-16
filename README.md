# BigQuery Release Hub

A premium, modern dashboard web application built to fetch, parse, and showcase the official Google BigQuery release notes. 

## Features

- **Real-Time XML Feed Parsing**: Integrates with the official [Google Cloud BigQuery Release Notes RSS Feed](https://docs.cloud.google.com/feeds/bigquery-release-notes.xml) to serve the latest updates dynamically.
- **Advanced Filtering**: Filter updates by their action types (e.g., `Feature`, `Issue`, `Deprecation`, `Announcement`, `Update`).
- **Interactive Search**: Search release notes by keywords, tags, or dates in real-time.
- **Copy and Share**: Copy formatted release details directly to your clipboard.
- **Twitter / X Integration**: Select any specific release note to draft and post a tweet/post with a beautiful mock-preview card and character progress indicator.
- **Premium Design & Micro-Animations**: A fully customized dark-themed layout featuring ambient mesh gradients, skeleton loaders, glassmorphism headers, and smooth transitions.
- **Robust Caching**: Implements a 5-minute memory cache to load updates instantly while supporting manual force-refreshes.

## Tech Stack

- **Backend**: Python Flask, BeautifulSoup4, XML ElementTree
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (Custom gradients, animations, glassmorphism), Vanilla JavaScript (ES6+)

## Getting Started

### Prerequisites

- Python 3.9 or higher

### Installation & Run

1. **Activate the virtual environment**:
   ```bash
   source .venv/bin/activate
   ```

2. **Start the Flask server**:
   ```bash
   python app.py
   ```

3. **Open the web application**:
   Navigate to **[http://127.0.0.1:5001](http://127.0.0.1:5001)** in your web browser.

## Project Structure

```text
├── app.py                 # Flask server & XML parsing engine
├── requirements.txt       # Python dependency list
├── .gitignore             # Git ignored files & environments
├── README.md              # Project documentation
├── templates/
│   └── index.html         # Main dashboard HTML template
└── static/
    ├── css/
    │   └── styles.css     # Premium styling, theme, and animations
    └── js/
        └── app.js         # AJAX fetching, search, filter, and Tweet composer logic
```
