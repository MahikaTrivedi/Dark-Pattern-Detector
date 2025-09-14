function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('findings');
  const rescanBtn = document.getElementById('rescan');

  function showLoading(show) {
    if (show) {
      rescanBtn.disabled = true;
      rescanBtn.innerHTML = `<div class="spinner"></div> Scanning...`;
    } else {
      rescanBtn.disabled = false;
      rescanBtn.innerHTML = `🔄 Rescan Page`;
    }
  }

  function showMessage(msg) {
    list.innerHTML = `<p>${msg}</p>`;
  }

  function renderFindings(items) {
    list.innerHTML = '';
    if (!items || items.length === 0) {
      showMessage('No dark patterns found! 🎉');
      return;
    }
    items.forEach(it => {
      const div = document.createElement('div');
      div.className = 'finding';
      div.innerHTML = `<strong>${escapeHtml(it.reason)}</strong>
                       <div class="snippet">${escapeHtml(it.snippet || '')}</div>`;
      const btn = document.createElement('button');
      btn.textContent = 'Highlight on page';
      btn.addEventListener('click', () => {
        chrome.tabs.query({active:true, currentWindow:true}, tabs => {
          if (!tabs[0]) return;
          chrome.tabs.sendMessage(tabs[0].id, { action: 'focus', id: it.id }, resp => {
            if (chrome.runtime.lastError || !resp || !resp.ok) {
              alert('Could not find element on page.');
            }
          });
        });
      });
      div.appendChild(btn);
      list.appendChild(div);
    });
  }

  function fetchFindings() {
    showLoading(true);
    chrome.tabs.query({active:true, currentWindow:true}, tabs => {
      if (!tabs[0]) { 
        showMessage('No active tab');
        showLoading(false);
        return; 
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getFindings' }, response => {
        showLoading(false);
        if (chrome.runtime.lastError || !response) {
          showMessage('Could not contact page. Some pages block extensions (e.g., Chrome Web Store).');
          return;
        }
        renderFindings(response.findings || []);
      });
    });
  }

  rescanBtn.addEventListener('click', () => {
    showLoading(true);
    chrome.tabs.query({active:true, currentWindow:true}, tabs => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: 'rescan' }, response => {
        showLoading(false);
        if (chrome.runtime.lastError || !response) {
          showMessage('Could not rescan the page.');
          return;
        }
        renderFindings(response.findings || []);
      });
    });
  });

  fetchFindings();
});
