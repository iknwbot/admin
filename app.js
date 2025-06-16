// メインアプリケーション
let currentSection = 'dashboard';

// 初期化
window.onload = function() {
  checkAuth();
};

// 認証チェック
function checkAuth() {
  const auth = localStorage.getItem(CONFIG.STORAGE_KEY);
  if (auth) {
    const authData = JSON.parse(auth);
    if (new Date().getTime() - authData.timestamp < CONFIG.SESSION_TIMEOUT) {
      showMainScreen();
      loadDashboard();
      return;
    }
  }
  showLoginScreen();
}

// ログイン画面表示
function showLoginScreen() {
  document.getElementById('loginScreen').classList.remove('d-none');
  document.getElementById('mainScreen').classList.add('d-none');
}

// メイン画面表示
function showMainScreen() {
  document.getElementById('loginScreen').classList.add('d-none');
  document.getElementById('mainScreen').classList.remove('d-none');
}

// ログイン処理
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const accessKey = document.getElementById('accessKey').value;
  const errorDiv = document.getElementById('loginError');
  
  if (accessKey === CONFIG.ACCESS_KEY) {
    // 認証成功
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({
      authenticated: true,
      timestamp: new Date().getTime()
    }));
    errorDiv.classList.add('d-none');
    showMainScreen();
    loadDashboard();
  } else {
    // 認証失敗
    errorDiv.textContent = 'アクセスキーが正しくありません';
    errorDiv.classList.remove('d-none');
  }
});

// ログアウト
function logout() {
  localStorage.removeItem(CONFIG.STORAGE_KEY);
  showLoginScreen();
  document.getElementById('accessKey').value = '';
}

// APIリクエスト共通関数
async function apiRequest(path, method = 'GET', data = null) {
  try {
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    };
    
    let url = CONFIG.API_URL;
    
    if (method === 'GET') {
      url += `?path=${path}`;
    } else {
      options.body = new URLSearchParams(data);
    }
    
    const response = await fetch(url, options);
    const result = await response.json();
    
    if (!result.success && result.error) {
      throw new Error(result.error);
    }
    
    return result;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// セクション切り替え
function showSection(sectionName) {
  currentSection = sectionName;
  
  // すべてのセクションを非表示
  document.querySelectorAll('.section').forEach(section => {
    section.style.display = 'none';
  });
  
  // ナビゲーションのアクティブ状態を更新
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  event.target.closest('.nav-link').classList.add('active');
  
  // 選択されたセクションを表示
  document.getElementById(sectionName).style.display = 'block';
  
  // データをロード
  switch(sectionName) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'reports':
      loadReports();
      break;
    case 'users':
      loadUsers();
      break;
    case 'sites':
      loadSites();
      break;
  }
}

// ダッシュボード読み込み
async function loadDashboard() {
  try {
    const result = await apiRequest('admin/dashboard');
    
    if (result.success) {
      const data = result.data;
      document.getElementById('totalReports').textContent = data.totalReports;
      document.getElementById('pendingReports').textContent = data.pendingReports;
      document.getElementById('totalUsers').textContent = data.totalUsers;
      document.getElementById('totalSites').textContent = data.totalSites;
      
      // 最新報告を表示
      const tbody = document.getElementById('recentReports');
      if (data.recentReports.length > 0) {
        tbody.innerHTML = data.recentReports.map(report => `
          <tr>
            <td>${escapeHtml(report.siteName)}</td>
            <td>${escapeHtml(report.eventType)}</td>
            <td>${new Date(report.timestamp).toLocaleDateString('ja-JP')}</td>
            <td><span class="badge ${report.processingFlag === '投稿まち' ? 'bg-warning' : 'bg-success'}">${escapeHtml(report.processingFlag)}</span></td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">データがありません</td></tr>';
      }
    }
  } catch (error) {
    console.error('Dashboard load error:', error);
    showError('ダッシュボードの読み込みに失敗しました');
  }
}

// 活動報告読み込み
async function loadReports() {
  const container = document.querySelector('#reports .table-container');
  const loading = container.querySelector('.loading');
  const errorMsg = container.querySelector('.error-message');
  const table = document.getElementById('reportsTable');
  
  loading.style.display = 'block';
  errorMsg.style.display = 'none';
  table.style.display = 'none';
  
  try {
    const result = await apiRequest('admin/reports');
    
    if (result.success) {
      const tbody = document.getElementById('reportsList');
      if (result.data.length > 0) {
        tbody.innerHTML = result.data.map(report => `
          <tr>
            <td>${new Date(report.timestamp).toLocaleDateString('ja-JP')}</td>
            <td>${escapeHtml(report.siteName)}</td>
            <td>${escapeHtml(report.eventType)}</td>
            <td>大人: ${report.adults}<br>子供: ${report.children}</td>
            <td>${report.amount.toLocaleString()}円</td>
            <td>
              <select class="form-select form-select-sm" onchange="updateReportStatus(${report.id}, this.value)">
                <option value="投稿まち" ${report.processingFlag === '投稿まち' ? 'selected' : ''}>投稿まち</option>
                <option value="振込OK" ${report.processingFlag === '振込OK' ? 'selected' : ''}>振込OK</option>
                <option value="振込NG" ${report.processingFlag === '振込NG' ? 'selected' : ''}>振込NG</option>
              </select>
            </td>
            <td>
              ${report.imageUrl ? `<a href="${report.imageUrl}" target="_blank" class="btn btn-sm btn-outline-primary">画像</a>` : '-'}
            </td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">データがありません</td></tr>';
      }
      
      loading.style.display = 'none';
      table.style.display = 'table';
    } else {
      throw new Error(result.error || 'データ取得エラー');
    }
  } catch (error) {
    loading.style.display = 'none';
    errorMsg.textContent = 'エラー: ' + error.message;
    errorMsg.style.display = 'block';
  }
}

// ユーザー読み込み
async function loadUsers() {
  try {
    const result = await apiRequest('admin/users');
    
    if (result.success) {
      const tbody = document.getElementById('usersList');
      if (result.data.length > 0) {
        tbody.innerHTML = result.data.map(user => `
          <tr>
            <td>${escapeHtml(user.siteName)}</td>
            <td>${escapeHtml(user.adminName)}</td>
            <td>${escapeHtml(user.lineId)}</td>
            <td>
              <button class="btn btn-sm btn-danger" onclick="deleteUser('${escapeHtml(user.lineId)}')">
                <i class="bi bi-trash"></i> 削除
              </button>
            </td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">データがありません</td></tr>';
      }
    }
  } catch (error) {
    console.error('Users load error:', error);
    showError('ユーザー一覧の読み込みに失敗しました');
  }
}

// 拠点読み込み
async function loadSites() {
  try {
    const result = await apiRequest('admin/sites');
    
    if (result.success) {
      const tbody = document.getElementById('sitesList');
      if (result.data.length > 0) {
        tbody.innerHTML = result.data.map(site => `
          <tr>
            <td>${escapeHtml(site.name)}</td>
            <td>${escapeHtml(site.address || '-')}</td>
            <td>${escapeHtml(site.transferDestination || '-')}</td>
            <td>
              <button class="btn btn-sm btn-danger" onclick="deleteSite('${escapeHtml(site.name)}')">
                <i class="bi bi-trash"></i> 削除
              </button>
            </td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">データがありません</td></tr>';
      }
    }
  } catch (error) {
    console.error('Sites load error:', error);
    showError('拠点一覧の読み込みに失敗しました');
  }
}

// レポートステータス更新
async function updateReportStatus(reportId, newStatus) {
  if (!confirm(`ステータスを「${newStatus}」に変更しますか？`)) {
    // 元に戻す
    loadReports();
    return;
  }
  
  try {
    const result = await apiRequest('', 'POST', {
      action: 'admin_updateReportStatus',
      reportId: reportId,
      status: newStatus
    });
    
    if (result.success) {
      showSuccess('ステータスを更新しました');
    } else {
      throw new Error(result.error || '更新に失敗しました');
    }
  } catch (error) {
    showError('更新に失敗しました: ' + error.message);
    loadReports(); // リロードして元に戻す
  }
}

// ユーザー追加モーダル表示
function showAddUserModal() {
  document.getElementById('addUserForm').reset();
  new bootstrap.Modal(document.getElementById('addUserModal')).show();
}

// ユーザー追加
async function addUser() {
  const form = document.getElementById('addUserForm');
  const formData = new FormData(form);
  
  try {
    const result = await apiRequest('', 'POST', {
      action: 'admin_addUser',
      siteName: formData.get('siteName'),
      adminName: formData.get('adminName'),
      lineId: formData.get('lineId')
    });
    
    if (result.success) {
      showSuccess('ユーザーを追加しました');
      bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
      loadUsers();
    } else {
      throw new Error(result.error || '追加に失敗しました');
    }
  } catch (error) {
    showError('追加に失敗しました: ' + error.message);
  }
}

// ユーザー削除
async function deleteUser(lineId) {
  if (!confirm('本当に削除しますか？')) return;
  
  try {
    const result = await apiRequest('', 'POST', {
      action: 'admin_deleteUser',
      lineId: lineId
    });
    
    if (result.success) {
      showSuccess('ユーザーを削除しました');
      loadUsers();
    } else {
      throw new Error(result.error || '削除に失敗しました');
    }
  } catch (error) {
    showError('削除に失敗しました: ' + error.message);
  }
}

// 拠点追加モーダル表示
function showAddSiteModal() {
  document.getElementById('addSiteForm').reset();
  new bootstrap.Modal(document.getElementById('addSiteModal')).show();
}

// 拠点追加
async function addSite() {
  const form = document.getElementById('addSiteForm');
  const formData = new FormData(form);
  
  try {
    const result = await apiRequest('', 'POST', {
      action: 'admin_addSite',
      name: formData.get('name'),
      address: formData.get('address'),
      transferDestination: formData.get('transferDestination')
    });
    
    if (result.success) {
      showSuccess('拠点を追加しました');
      bootstrap.Modal.getInstance(document.getElementById('addSiteModal')).hide();
      loadSites();
    } else {
      throw new Error(result.error || '追加に失敗しました');
    }
  } catch (error) {
    showError('追加に失敗しました: ' + error.message);
  }
}

// 拠点削除
async function deleteSite(siteName) {
  if (!confirm('本当に削除しますか？')) return;
  
  try {
    const result = await apiRequest('', 'POST', {
      action: 'admin_deleteSite',
      siteName: siteName
    });
    
    if (result.success) {
      showSuccess('拠点を削除しました');
      loadSites();
    } else {
      throw new Error(result.error || '削除に失敗しました');
    }
  } catch (error) {
    showError('削除に失敗しました: ' + error.message);
  }
}

// ユーティリティ関数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showSuccess(message) {
  // Bootstrapのトーストまたはアラートで表示
  alert('✅ ' + message);
}

function showError(message) {
  // Bootstrapのトーストまたはアラートで表示
  alert('❌ ' + message);
}

// セッションタイムアウトチェック
setInterval(() => {
  const auth = localStorage.getItem(CONFIG.STORAGE_KEY);
  if (auth) {
    const authData = JSON.parse(auth);
    if (new Date().getTime() - authData.timestamp >= CONFIG.SESSION_TIMEOUT) {
      logout();
      alert('セッションがタイムアウトしました。再度ログインしてください。');
    }
  }
}, 60000); // 1分ごとにチェック