document.addEventListener('DOMContentLoaded', () => {
    // State Management
    let releaseNotes = [];
    let activeFilter = 'all';
    let searchQuery = '';
    let selectedUpdate = null; // Currently selected update for tweeting
    
    // UI Elements
    const btnRefresh = document.getElementById('btn-refresh');
    const syncStatusText = document.querySelector('#sync-status .status-text');
    const syncStatusDot = document.querySelector('#sync-status .status-dot');
    const searchInput = document.getElementById('search-input');
    const btnClearSearch = document.getElementById('btn-clear-search');
    const filterBadges = document.getElementById('filter-badges');
    const skeletonLoader = document.getElementById('skeleton-loader');
    const emptyState = document.getElementById('empty-state');
    const btnResetFilters = document.getElementById('btn-reset-filters');
    const notesList = document.getElementById('notes-list');
    const btnExportCsv = document.getElementById('btn-export-csv');
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    
    // Theme Switcher Initialization
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
    }
    
    // Tweet Modal Elements
    const tweetModal = document.getElementById('tweet-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCounter = document.getElementById('char-counter');
    const charProgressBar = document.getElementById('char-progress-bar');
    const btnCopyTweet = document.getElementById('btn-copy-tweet');
    const btnSubmitTweet = document.getElementById('btn-submit-tweet');
    const tweetMetadataTag = document.getElementById('tweet-metadata-tag');
    const toastContainer = document.getElementById('toast-container');
    
    // Initial Load
    fetchReleaseNotes();
    
    // Event Listeners
    btnRefresh.addEventListener('click', () => fetchReleaseNotes(true));
    searchInput.addEventListener('input', handleSearch);
    btnClearSearch.addEventListener('click', clearSearch);
    btnResetFilters.addEventListener('click', resetFilters);
    btnExportCsv.addEventListener('click', exportFilteredNotesToCSV);
    
    btnThemeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        showToast(`Swapped to ${isLight ? 'Light' : 'Dark'} Mode`, 'info');
    });
    
    // Filter Badges handler
    filterBadges.addEventListener('click', (e) => {
        const badge = e.target.closest('.badge');
        if (!badge) return;
        
        // Update active class
        filterBadges.querySelectorAll('.badge').forEach(b => b.classList.remove('active'));
        badge.classList.add('active');
        
        activeFilter = badge.dataset.type;
        filterAndRenderNotes();
    });
    
    // Modal Event Listeners
    btnCloseModal.addEventListener('click', closeTweetModal);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeTweetModal();
    });
    tweetTextarea.addEventListener('input', updateCharCount);
    btnCopyTweet.addEventListener('click', copyTweetToClipboard);
    btnSubmitTweet.addEventListener('click', submitTweet);
    
    // Fetch release notes from backend API
    async function fetchReleaseNotes(force = false) {
        setLoadingState(true);
        
        try {
            const url = `/api/release-notes${force ? '?force=true' : ''}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            releaseNotes = data.notes;
            
            // Update Sync Status
            const fetchDate = new Date(data.last_fetched * 1000);
            const formattedTime = fetchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            syncStatusText.textContent = `Synced ${formattedTime}`;
            syncStatusDot.className = 'status-dot green';
            
            if (force) {
                showToast('Refreshed release notes feed', 'success');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            syncStatusText.textContent = 'Sync Failed';
            syncStatusDot.className = 'status-dot';
            showToast('Failed to load release notes', 'error');
        } finally {
            setLoadingState(false);
            filterAndRenderNotes();
        }
    }
    
    // Set loading state in UI
    function setLoadingState(isLoading) {
        if (isLoading) {
            btnRefresh.classList.add('spinning');
            btnRefresh.disabled = true;
            skeletonLoader.style.display = 'block';
            notesList.style.display = 'none';
            emptyState.style.display = 'none';
            syncStatusDot.className = 'status-dot loading';
            syncStatusText.textContent = 'Syncing...';
        } else {
            btnRefresh.classList.remove('spinning');
            btnRefresh.disabled = false;
            skeletonLoader.style.display = 'none';
        }
    }
    
    // Handle Search input
    function handleSearch(e) {
        searchQuery = e.target.value.toLowerCase().trim();
        if (searchQuery) {
            btnClearSearch.style.display = 'flex';
        } else {
            btnClearSearch.style.display = 'none';
        }
        filterAndRenderNotes();
    }
    
    // Clear Search input
    function clearSearch() {
        searchInput.value = '';
        searchQuery = '';
        btnClearSearch.style.display = 'none';
        filterAndRenderNotes();
    }
    
    // Reset all filters
    function resetFilters() {
        clearSearch();
        activeFilter = 'all';
        filterBadges.querySelectorAll('.badge').forEach(b => {
            if (b.dataset.type === 'all') {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });
        filterAndRenderNotes();
    }
    
    // Filter and Render release notes based on search query and active badge filter
    function filterAndRenderNotes() {
        const filteredDays = [];
        
        releaseNotes.forEach(day => {
            const filteredUpdates = day.updates.filter(update => {
                // Type filter
                const matchesType = activeFilter === 'all' || update.type.toLowerCase() === activeFilter.toLowerCase();
                
                // Search query filter
                const matchesSearch = !searchQuery || 
                    update.type.toLowerCase().includes(searchQuery) || 
                    update.content_text.toLowerCase().includes(searchQuery) ||
                    day.date.toLowerCase().includes(searchQuery);
                    
                return matchesType && matchesSearch;
            });
            
            if (filteredUpdates.length > 0) {
                filteredDays.push({
                    ...day,
                    updates: filteredUpdates
                });
            }
        });
        
        renderNotesList(filteredDays);
    }
    
    // Render the filtered days to HTML
    function renderNotesList(days) {
        if (days.length === 0) {
            notesList.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }
        
        emptyState.style.display = 'none';
        notesList.style.display = 'block';
        notesList.innerHTML = '';
        
        days.forEach(day => {
            const dateGroup = document.createElement('div');
            dateGroup.className = 'date-group';
            
            // Header for the date
            const dateHeader = document.createElement('div');
            dateHeader.className = 'date-header';
            const h2 = document.createElement('h2');
            h2.textContent = day.date;
            dateHeader.appendChild(h2);
            dateGroup.appendChild(dateHeader);
            
            // Render updates for this date
            day.updates.forEach(update => {
                const updateCard = document.createElement('div');
                updateCard.className = 'update-card';
                
                // Card header
                const cardHeader = document.createElement('div');
                cardHeader.className = 'card-header';
                
                const typeClass = update.type.toLowerCase();
                const typeBadge = document.createElement('span');
                typeBadge.className = `type-badge ${typeClass}`;
                typeBadge.textContent = update.type;
                cardHeader.appendChild(typeBadge);
                
                const cardActions = document.createElement('div');
                cardActions.className = 'card-actions-quick';
                
                // Copy text button
                const btnCopy = document.createElement('button');
                btnCopy.className = 'btn-icon-share';
                btnCopy.setAttribute('aria-label', 'Copy update text');
                btnCopy.innerHTML = `
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                `;
                btnCopy.addEventListener('click', () => {
                    navigator.clipboard.writeText(`[BigQuery ${update.type}] (${day.date}):\n${update.content_text}`);
                    showToast('Copied update to clipboard!', 'success');
                });
                
                cardActions.appendChild(btnCopy);
                cardHeader.appendChild(cardActions);
                updateCard.appendChild(cardHeader);
                
                // Card body
                const cardBody = document.createElement('div');
                cardBody.className = 'card-body';
                cardBody.innerHTML = update.content_html;
                updateCard.appendChild(cardBody);
                
                // Card footer
                const cardFooter = document.createElement('div');
                cardFooter.className = 'card-footer';
                
                const btnCopyFooter = document.createElement('button');
                btnCopyFooter.className = 'btn-copy-footer-action';
                btnCopyFooter.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    <span>Copy Text</span>
                `;
                btnCopyFooter.addEventListener('click', () => {
                    navigator.clipboard.writeText(`[BigQuery ${update.type}] (${day.date}):\n${update.content_text}`);
                    showToast('Copied update to clipboard!', 'success');
                });
                
                const btnTweet = document.createElement('button');
                btnTweet.className = 'btn-tweet-action';
                btnTweet.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span>Tweet Update</span>
                `;
                btnTweet.addEventListener('click', () => openTweetModal(day, update));
                
                cardFooter.appendChild(btnCopyFooter);
                cardFooter.appendChild(btnTweet);
                updateCard.appendChild(cardFooter);
                
                dateGroup.appendChild(updateCard);
            });
            
            notesList.appendChild(dateGroup);
        });
    }
    
    // Open Tweet Composer Modal
    function openTweetModal(day, update) {
        selectedUpdate = { day, update };
        
        // Prepare initial text
        // Format: [BigQuery Type] (Date): Description... Read more: Link
        const baseLink = day.link || 'https://docs.cloud.google.com/bigquery/docs/release-notes';
        const rawText = update.content_text;
        
        // Build prefix and suffix
        const prefix = `[BigQuery ${update.type}] (${day.date}): `;
        const suffix = `\n\nDetails: ${baseLink}`;
        
        // Max Tweet length is 280.
        // Let's truncate rawText if it exceeds limits
        const maxTextLen = 280 - prefix.length - suffix.length;
        let snippet = rawText;
        if (rawText.length > maxTextLen) {
            snippet = rawText.substring(0, maxTextLen - 3) + '...';
        }
        
        const initialText = `${prefix}${snippet}${suffix}`;
        
        tweetTextarea.value = initialText;
        updateCharCount();
        
        // Set up the link card inside the mock tweet
        const linkDomain = tweetMetadataTag.querySelector('.link-domain');
        const linkTitle = tweetMetadataTag.querySelector('.link-title');
        
        try {
            const urlObj = new URL(baseLink);
            linkDomain.textContent = urlObj.hostname;
        } catch {
            linkDomain.textContent = 'cloud.google.com';
        }
        
        linkTitle.textContent = `BigQuery Release Notes - ${day.date}`;
        
        // Show modal with transition
        tweetModal.style.display = 'flex';
        setTimeout(() => {
            tweetModal.classList.add('show');
            tweetTextarea.focus();
        }, 10);
    }
    
    // Close Tweet Composer Modal
    function closeTweetModal() {
        tweetModal.classList.remove('show');
        setTimeout(() => {
            tweetModal.style.display = 'none';
            selectedUpdate = null;
        }, 250);
    }
    
    // Update Character Counter UI
    function updateCharCount() {
        const text = tweetTextarea.value;
        const count = text.length;
        const remaining = 280 - count;
        
        charCounter.textContent = remaining;
        
        // Progress circle calculation
        // Total circumference of circle with radius 10 is 2 * PI * r = 62.83
        const maxCircleVal = 62.83;
        const percent = Math.min(count / 280, 1);
        const offset = maxCircleVal - (maxCircleVal * percent);
        charProgressBar.style.strokeDashoffset = offset;
        
        // Highlight states
        if (remaining < 0) {
            charCounter.className = 'char-counter danger';
            charProgressBar.style.stroke = 'var(--color-deprecation)';
            btnSubmitTweet.disabled = true;
        } else if (remaining <= 20) {
            charCounter.className = 'char-counter warning';
            charProgressBar.style.stroke = 'var(--color-issue)';
            btnSubmitTweet.disabled = false;
        } else {
            charCounter.className = 'char-counter';
            charProgressBar.style.stroke = 'var(--twitter-color)';
            btnSubmitTweet.disabled = false;
        }
        
        if (count === 0) {
            btnSubmitTweet.disabled = true;
        }
    }
    
    // Copy Tweet text to Clipboard
    function copyTweetToClipboard() {
        const text = tweetTextarea.value;
        if (!text) return;
        
        navigator.clipboard.writeText(text);
        showToast('Tweet text copied to clipboard!', 'success');
    }
    
    // Open Twitter Web Intent to Post Tweet
    function submitTweet() {
        const text = tweetTextarea.value;
        if (!text || text.length > 280) return;
        
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
        closeTweetModal();
        showToast('Opened Twitter / X share window', 'info');
    }
    
    // Toast Notification System
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Set correct icon based on type
        let iconSvg = '';
        if (type === 'success') {
            iconSvg = `
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            `;
        } else if (type === 'error') {
            iconSvg = `
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            `;
        } else {
            iconSvg = `
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
            `;
        }
        
        toast.innerHTML = `
            ${iconSvg}
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        // Trigger show animation
        setTimeout(() => toast.classList.add('show'), 50);
        
        // Auto-remove toast after 3.5s
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
    
    // Export currently filtered notes to CSV format
    function exportFilteredNotesToCSV() {
        if (releaseNotes.length === 0) {
            showToast('No notes to export', 'error');
            return;
        }
        
        const headers = ['Date', 'Type', 'Content'];
        const rows = [];
        
        releaseNotes.forEach(day => {
            day.updates.forEach(update => {
                const matchesType = activeFilter === 'all' || update.type.toLowerCase() === activeFilter.toLowerCase();
                const matchesSearch = !searchQuery || 
                    update.type.toLowerCase().includes(searchQuery) || 
                    update.content_text.toLowerCase().includes(searchQuery) ||
                    day.date.toLowerCase().includes(searchQuery);
                    
                if (matchesType && matchesSearch) {
                    const escapeCSV = (text) => {
                        if (!text) return '""';
                        // Replace double quotes with two double quotes
                        const clean = text.replace(/"/g, '""');
                        return `"${clean}"`;
                    };
                    rows.push([
                        escapeCSV(day.date),
                        escapeCSV(update.type),
                        escapeCSV(update.content_text)
                    ]);
                }
            });
        });
        
        if (rows.length === 0) {
            showToast('No notes match the active filter/search to export', 'error');
            return;
        }
        
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `bigquery_release_notes_${activeFilter}_filter.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Exported filtered notes to CSV!', 'success');
    }
});
