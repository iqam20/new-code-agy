import xml.etree.ElementTree as ET
import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request
import time
import logging

import re

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Simple in-memory cache
cache = {
    "data": None,
    "last_fetched": 0
}
CACHE_TTL = 300  # 5 minutes

def clean_text(html_text):
    """Cleans HTML-derived text by collapsing consecutive spaces and line-wraps inside paragraphs while retaining paragraph gaps."""
    soup = BeautifulSoup(html_text, 'html.parser')
    text = soup.get_text()
    
    # Split by double newlines to isolate paragraphs
    paragraphs = text.split('\n\n')
    cleaned_paragraphs = []
    
    for p in paragraphs:
        # Collapse all inner whitespace (including single newlines, tabs, and spaces) to a single space
        cleaned_p = re.sub(r'\s+', ' ', p).strip()
        if cleaned_p:
            cleaned_paragraphs.append(cleaned_p)
            
    return '\n\n'.join(cleaned_paragraphs)

def parse_feed_content(html_content):
    """Parses html release note content into individual structured updates."""
    if not html_content:
        return []
        
    soup = BeautifulSoup(html_content, 'html.parser')
    updates = []
    current_header = None
    current_content = []
    
    # Iterate through direct children of soup
    for child in soup.contents:
        # Check if child is an H3 tag
        if hasattr(child, 'name') and child.name == 'h3':
            if current_header:
                content_html = "".join(str(c) for c in current_content)
                updates.append({
                    'type': current_header,
                    'content_html': content_html,
                    'content_text': clean_text(content_html)
                })
            current_header = child.get_text().strip()
            current_content = []
        elif current_header:
            current_content.append(child)
            
    # Add the final update
    if current_header:
        content_html = "".join(str(c) for c in current_content)
        updates.append({
            'type': current_header,
            'content_html': content_html,
            'content_text': clean_text(content_html)
        })
        
    # If there were no H3 headers but there was some content, return it as a generic Update
    if not updates and html_content.strip():
        updates.append({
            'type': 'Update',
            'content_html': html_content,
            'content_text': clean_text(html_content)
        })
        
    return updates

def fetch_and_parse_notes():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    logger.info("Fetching release notes feed from remote URL")
    
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    
    root = ET.fromstring(response.content)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = []
    for entry_elem in root.findall('atom:entry', ns):
        title_elem = entry_elem.find('atom:title', ns)
        id_elem = entry_elem.find('atom:id', ns)
        updated_elem = entry_elem.find('atom:updated', ns)
        
        # Link resolution
        link_elem = entry_elem.find('atom:link[@rel="alternate"]', ns)
        if link_elem is None:
            link_elem = entry_elem.find('atom:link', ns)
            
        content_elem = entry_elem.find('atom:content', ns)
        
        date_str = title_elem.text if title_elem is not None else ""
        entry_id = id_elem.text if id_elem is not None else ""
        updated_str = updated_elem.text if updated_elem is not None else ""
        link_href = link_elem.attrib.get('href', '') if link_elem is not None else ""
        
        html_content = content_elem.text if content_elem is not None else ""
        updates = parse_feed_content(html_content)
        
        entries.append({
            'date': date_str,
            'id': entry_id,
            'updated': updated_str,
            'link': link_href,
            'updates': updates
        })
        
    return entries

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force_refresh = request.args.get('force', 'false').lower() == 'true'
    now = time.time()
    
    # Check cache validity
    if not force_refresh and cache["data"] and (now - cache["last_fetched"] < CACHE_TTL):
        logger.info("Serving release notes from memory cache")
        return jsonify({
            "source": "cache",
            "last_fetched": cache["last_fetched"],
            "notes": cache["data"]
        })
        
    try:
        notes = fetch_and_parse_notes()
        cache["data"] = notes
        cache["last_fetched"] = now
        return jsonify({
            "source": "live",
            "last_fetched": now,
            "notes": notes
        })
    except Exception as e:
        logger.error(f"Error fetching/parsing release notes: {e}", exc_info=True)
        # Fallback to cache if available
        if cache["data"]:
            return jsonify({
                "source": "cache_fallback",
                "last_fetched": cache["last_fetched"],
                "notes": cache["data"],
                "error": str(e)
            }), 200
            
        return jsonify({
            "error": "Failed to fetch release notes from upstream source",
            "details": str(e)
        }), 500

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5001))
    app.run(host='127.0.0.1', port=port, debug=True)
