// メインアプリケーション
let currentSection = 'reports';
let allReports = [];
let allFoodDonations = [];
let allMoneyDonations = [];
let allLogs = [];

// 初期化
window.onload = function() {
  checkAuth();
  initializeFilters();
};

// フィルター初期化
function initializeFilters() {
  // 月フィルターの初期化（過去12ヶ月 + 現在月）
  const monthFilter = document.getElementById('monthFilter');
  const now = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yearMonth = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
    const displayText = date.getFullYear() + '年' + (date.getMonth() + 1) + '月';
    
    const option = document.createElement('option');
    option.value = yearMonth;
    option.textContent = displayText;
    if (i === 0) option.selected = true; // 現在月をデフォルト選択
    
    monthFilter.appendChild(option);
  }
  
  // フィルター変更時のイベント
  monthFilter.addEventListener('change', filterReports);
  document.getElementById('statusFilter').addEventListener('change', filterReports);
}

// 認証チェック
function checkAuth() {
  const auth = localStorage.getItem(CONFIG.STORAGE_KEY);
  if (auth) {
    const authData = JSON.parse(auth);
    if (new Date().getTime() - authData.timestamp < CONFIG.SESSION_TIMEOUT) {
      showMainScreen();
      showSection('reports');
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
    showSection('reports');
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
      // pathにクエリパラメータが含まれている場合の処理
      if (path.includes('?')) {
        const [action, params] = path.split('?');
        url += `?action=${action}&${params}`;
      } else {
        url += `?action=${path}`;
      }
    } else {
      const params = new URLSearchParams(data);
      options.body = params;
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
function showSection(sectionName, targetElement = null) {
  currentSection = sectionName;
  
  // すべてのセクションを非表示
  document.querySelectorAll('.section').forEach(section => {
    section.style.display = 'none';
  });
  
  // ナビゲーションのアクティブ状態を更新
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  // クリックされた要素またはsectionNameに対応するリンクをアクティブにする
  if (targetElement) {
    targetElement.closest('.nav-link').classList.add('active');
  } else {
    // 自動呼び出しの場合、対応するナビゲーションリンクを探してアクティブにする
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      const onclick = link.getAttribute('onclick');
      if (onclick && onclick.includes(`'${sectionName}'`)) {
        link.classList.add('active');
      }
    });
  }
  
  // 選択されたセクションを表示
  const sectionElement = document.getElementById(sectionName);
  if (sectionElement) {
    sectionElement.style.display = 'block';
  }
  
  // データをロード
  switch(sectionName) {
    case 'reports':
      loadReports();
      break;
    case 'food-donations':
      loadFoodDonations();
      break;
    case 'money-donations':
      loadMoneyDonations();
      break;
    case 'users':
      loadUsers();
      break;
    case 'sites':
      loadSites();
      break;
    case 'logs':
      loadLogs();
      break;
  }
}

// 統計情報更新
function updateStatistics(reports) {
  const statusCounts = {
    total: reports.length,
    '投稿まち': 0,
    '金額確定まち': 0,
    '振込OK': 0,
    '振込NG': 0,
    '完了': 0
  };
  
  reports.forEach(report => {
    if (statusCounts.hasOwnProperty(report.processingFlag)) {
      statusCounts[report.processingFlag]++;
    }
  });
  
  document.getElementById('totalReports').textContent = statusCounts.total;
  document.getElementById('statusWaiting').textContent = statusCounts['投稿まち'];
  document.getElementById('statusAmountWaiting').textContent = statusCounts['金額確定まち'];
  document.getElementById('statusOK').textContent = statusCounts['振込OK'];
  document.getElementById('statusNG').textContent = statusCounts['振込NG'];
  document.getElementById('statusCompleted').textContent = statusCounts['完了'];
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
    const result = await apiRequest('getInternalReports');
    
    if (result.success || result.data) {
      allReports = result.data || result.reports || [];
      filterReports();
      
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

// フィルター適用
function filterReports() {
  const monthFilter = document.getElementById('monthFilter').value;
  const statusFilter = document.getElementById('statusFilter').value;
  
  let filteredReports = allReports;
  
  // 月フィルター
  if (monthFilter) {
    filteredReports = filteredReports.filter(report => {
      const reportDate = new Date(report.timestamp);
      const reportMonth = reportDate.getFullYear() + '-' + String(reportDate.getMonth() + 1).padStart(2, '0');
      return reportMonth === monthFilter;
    });
  }
  
  // ステータスフィルター
  if (statusFilter) {
    filteredReports = filteredReports.filter(report => report.processingFlag === statusFilter);
  }
  
  // 統計更新
  updateStatistics(filteredReports);
  
  // テーブル更新
  const tbody = document.getElementById('reportsList');
  if (filteredReports.length > 0) {
    tbody.innerHTML = filteredReports.map((report, index) => `
      <tr>
        <td>${new Date(report.timestamp).toLocaleDateString('ja-JP')}</td>
        <td>${escapeHtml(report.siteName)}</td>
        <td>${escapeHtml(report.nickname || report.userId)}</td>
        <td>${new Date(report.eventDate).toLocaleDateString('ja-JP')}</td>
        <td>${escapeHtml(report.eventType)}</td>
        <td>大人:${report.adults} 子:${report.children}</td>
        <td>${report.amount ? report.amount.toLocaleString() + '円' : '-'}</td>
        <td>
          <select class="form-select form-select-sm" onchange="updateReportStatus(${index}, this.value)">
            <option value="投稿まち" ${report.processingFlag === '投稿まち' ? 'selected' : ''}>投稿まち</option>
            <option value="金額確定まち" ${report.processingFlag === '金額確定まち' ? 'selected' : ''}>金額確定まち</option>
            <option value="振込OK" ${report.processingFlag === '振込OK' ? 'selected' : ''}>振込OK</option>
            <option value="振込NG" ${report.processingFlag === '振込NG' ? 'selected' : ''}>振込NG</option>
            <option value="完了" ${report.processingFlag === '完了' ? 'selected' : ''}>完了</option>
          </select>
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary" onclick="showReportDetails(${index})">
            詳細
          </button>
        </td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">データがありません</td></tr>';
  }
}

// 報告詳細表示
function showReportDetails(index) {
  const report = allReports[index];
  if (!report) return;
  
  const modalBody = document.getElementById('detailModalBody');
  modalBody.innerHTML = `
    <div class="row">
      <div class="col-md-6">
        <h6>基本情報</h6>
        <p><strong>投稿日時:</strong> ${new Date(report.timestamp).toLocaleString('ja-JP')}</p>
        <p><strong>拠点名:</strong> ${escapeHtml(report.siteName)}</p>
        <p><strong>投稿者:</strong> ${escapeHtml(report.nickname || report.userId)}</p>
        <p><strong>開催日:</strong> ${new Date(report.eventDate).toLocaleDateString('ja-JP')}</p>
        <p><strong>開催タイプ:</strong> ${escapeHtml(report.eventType)}</p>
      </div>
      <div class="col-md-6">
        <h6>参加者・金額</h6>
        <p><strong>大人:</strong> ${report.adults}人</p>
        <p><strong>子ども:</strong> ${report.children}人</p>
        <p><strong>請求額:</strong> ${report.amount ? report.amount.toLocaleString() + '円' : '未確定'}</p>
        <p><strong>ステータス:</strong> ${escapeHtml(report.processingFlag || '投稿まち')}</p>
      </div>
    </div>
    ${report.comment ? `
    <div class="row mt-3">
      <div class="col-12">
        <h6>コメント</h6>
        <p>${escapeHtml(report.comment)}</p>
      </div>
    </div>
    ` : ''}
    ${report.imageUrl ? `
    <div class="row mt-3">
      <div class="col-12">
        <h6>添付画像</h6>
        <img src="${report.imageUrl}" class="img-fluid" style="max-height: 300px;" alt="活動画像">
      </div>
    </div>
    ` : ''}
  `;
  
  new bootstrap.Modal(document.getElementById('detailModal')).show();
}

// 食品寄付読み込み
async function loadFoodDonations() {
  const container = document.querySelector('#food-donations .table-container');
  const loading = container.querySelector('.loading');
  const errorMsg = container.querySelector('.error-message');
  const table = document.getElementById('foodDonationsTable');
  
  loading.style.display = 'block';
  errorMsg.style.display = 'none';
  table.style.display = 'none';
  
  try {
    const result = await apiRequest('getKifuReports');
    
    if (result.success || result.data) {
      const kifuData = result.data || result.kifu || [];
      console.log('寄付データ取得:', kifuData);
      
      // 食品寄付データを取得（GASから返されるfoodプロパティ）
      allFoodDonations = kifuData.food || [];
      
      console.log('食品寄付フィルター後:', allFoodDonations.length + '件');
      
      const tbody = document.getElementById('foodDonationsList');
      if (allFoodDonations.length > 0) {
        tbody.innerHTML = allFoodDonations.map(donation => `
          <tr>
            <td>${new Date(donation.timestamp).toLocaleDateString('ja-JP')}</td>
            <td>${escapeHtml(donation.siteName)}</td>
            <td>${escapeHtml(donation.nickname || donation.userId)}</td>
            <td>${escapeHtml(donation.donor || '-')}</td>
            <td>${escapeHtml(donation.itemName || '-')}</td>
            <td>${donation.webPublic === 'する' ? '公開' : '非公開'}</td>
            <td>${donation.instagramUrl ? '投稿済' : '未投稿'}</td>
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

// 金銭寄付読み込み
async function loadMoneyDonations() {
  const container = document.querySelector('#money-donations .table-container');
  const loading = container.querySelector('.loading');
  const errorMsg = container.querySelector('.error-message');
  const table = document.getElementById('moneyDonationsTable');
  
  loading.style.display = 'block';
  errorMsg.style.display = 'none';
  table.style.display = 'none';
  
  try {
    const result = await apiRequest('getKifuReports');
    
    if (result.success || result.data) {
      const kifuData = result.data || result.kifu || [];
      // 金銭寄付データを取得（GASから返されるmoneyプロパティ）
      allMoneyDonations = kifuData.money || [];
      
      const tbody = document.getElementById('moneyDonationsList');
      if (allMoneyDonations.length > 0) {
        tbody.innerHTML = allMoneyDonations.map(donation => `
          <tr>
            <td>${new Date(donation.timestamp).toLocaleDateString('ja-JP')}</td>
            <td>${escapeHtml(donation.siteName)}</td>
            <td>${escapeHtml(donation.nickname || donation.userId)}</td>
            <td>${escapeHtml(donation.donor || '-')}</td>
            <td>${donation.amount ? donation.amount.toLocaleString() + '円' : '-'}</td>
            <td>${donation.webPublic === 'する' ? '公開' : '非公開'}</td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">データがありません</td></tr>';
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

// ログ読み込み
async function loadLogs() {
  const container = document.querySelector('#logs .table-container');
  const loading = container.querySelector('.loading');
  const errorMsg = container.querySelector('.error-message');
  const table = document.getElementById('logsTable');
  
  loading.style.display = 'block';
  errorMsg.style.display = 'none';
  table.style.display = 'none';
  
  try {
    const result = await apiRequest('getLogs');
    
    if (result.success || result.data) {
      allLogs = result.data || result.logs || [];
      
      const tbody = document.getElementById('logsList');
      if (allLogs.length > 0) {
        tbody.innerHTML = allLogs.slice(0, 100).map(log => `
          <tr>
            <td>${new Date(log.timestamp).toLocaleString('ja-JP')}</td>
            <td>${escapeHtml(log.type || log.action)}</td>
            <td>${escapeHtml(log.details || log.message)}</td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">データがありません</td></tr>';
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
    // 管理画面用の仮のuserIdを設定
    const result = await apiRequest('getSite?userId=admin');
    
    if (result.success || result.data) {
      const userData = result.data || result.users || [];
      const tbody = document.getElementById('usersList');
      
      if (userData.length > 0) {
        tbody.innerHTML = userData.map(user => `
          <tr>
            <td>${escapeHtml(user.siteName || user.name)}</td>
            <td>${escapeHtml(user.adminName || user.nickname || '-')}</td>
            <td>${escapeHtml(user.lineId || user.userId || '-')}</td>
            <td>${user.registeredDate ? new Date(user.registeredDate).toLocaleDateString('ja-JP') : '-'}</td>
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
    // 管理画面用の仮のuserIdを設定
    const result = await apiRequest('getSite?userId=admin');
    
    if (result.success || result.data) {
      const siteData = result.data || result.sites || [];
      const tbody = document.getElementById('sitesList');
      
      if (siteData.length > 0) {
        tbody.innerHTML = siteData.map(site => `
          <tr>
            <td>
              <input type="text" class="form-control form-control-sm" value="${escapeHtml(site.siteName || site.name)}" 
                     onchange="updateSite('${escapeHtml(site.siteName || site.name)}', 'name', this.value)" readonly>
            </td>
            <td>
              <input type="text" class="form-control form-control-sm" value="${escapeHtml(site.webSite || site.website || '')}" 
                     onchange="updateSite('${escapeHtml(site.siteName || site.name)}', 'webSite', this.value)">
            </td>
            <td>
              <input type="text" class="form-control form-control-sm" value="${escapeHtml(site.transferDestination || site.account || '')}" 
                     onchange="updateSite('${escapeHtml(site.siteName || site.name)}', 'transferDestination', this.value)">
            </td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="toggleEdit(this)">
                <i class="bi bi-pencil"></i> 編集
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

// 編集モード切り替え
function toggleEdit(button) {
  const row = button.closest('tr');
  const inputs = row.querySelectorAll('input:not([readonly])');
  const isEditing = button.textContent.includes('保存');
  
  if (isEditing) {
    // 保存処理
    button.innerHTML = '<i class="bi bi-pencil"></i> 編集';
    inputs.forEach(input => input.disabled = true);
    showSuccess('変更を保存しました');
  } else {
    // 編集モード
    button.innerHTML = '<i class="bi bi-check"></i> 保存';
    inputs.forEach(input => input.disabled = false);
  }
}

// サイト情報更新
async function updateSite(siteName, field, value) {
  try {
    const result = await apiRequest('updateSite', 'POST', {
      action: 'updateSite',
      siteName: siteName,
      field: field,
      value: value
    });
    
    if (result.success) {
      showSuccess('拠点情報を更新しました');
    } else {
      throw new Error(result.error || '更新に失敗しました');
    }
  } catch (error) {
    showError('更新に失敗しました: ' + error.message);
  }
}

// レポートステータス更新
async function updateReportStatus(reportIndex, newStatus) {
  if (!confirm(`ステータスを「${newStatus}」に変更しますか？`)) {
    filterReports(); // 元に戻す
    return;
  }
  
  const report = allReports[reportIndex];
  if (!report) return;
  
  try {
    const result = await apiRequest('updateReportStatus', 'POST', {
      action: 'updateReportStatus',
      timestamp: report.timestamp,
      siteName: report.siteName,
      status: newStatus
    });
    
    if (result.success) {
      // ローカルデータを更新
      allReports[reportIndex].processingFlag = newStatus;
      filterReports(); // 表示を更新
      showSuccess('ステータスを更新しました');
    } else {
      throw new Error(result.error || '更新に失敗しました');
    }
  } catch (error) {
    showError('更新に失敗しました: ' + error.message);
    filterReports(); // 元に戻す
  }
}

// ユーティリティ関数
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text.toString();
  return div.innerHTML;
}

function showSuccess(message) {
  alert('✅ ' + message);
}

function showError(message) {
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