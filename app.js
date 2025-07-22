// メインアプリケーション
let currentSection = 'reports';
let allReports = [];
let allFoodDonations = [];
let allMoneyDonations = [];
let allLogs = [];
let filteredLogs = [];
let currentLogPage = 1;
const logsPerPage = 20;
let allUsers = [];
let allSites = [];

// ソート用のグローバル変数
window.sortColumn = 'timestamp';
window.sortDirection = 'desc';

// 初期化
window.onload = async function() {
  checkAuth();
  initializeFilters();
  await initializeSiteFilter();
  
  // グローバル関数を確実に設定
  window.applyFilters = function() {
    filterReports();
  };
  
  window.clearFilters = function() {
    document.getElementById('monthFilter').value = '';
    document.getElementById('statusFilter').value = '';
    const siteFilter = document.getElementById('siteFilter');
    if (siteFilter) {
      siteFilter.value = '';
    }
    filterReports();
  };
  
  // ログ関連のグローバル関数
  window.applyLogFilters = applyLogFilters;
  window.clearLogFilters = clearLogFilters;
  window.changeLogPage = changeLogPage;
  window.sortLogs = sortLogs;
};

// フィルター初期化
function initializeFilters() {
  initializeMonthFilter('monthFilter', null); // 自動更新を無効化
  initializeMonthFilter('foodMonthFilter', filterFoodDonations);
  initializeMonthFilter('moneyMonthFilter', filterMoneyDonations);
  
  // フィルターの自動更新を無効化（手動検索に変更）
  // document.getElementById('statusFilter').addEventListener('change', filterReports);
}

function initializeMonthFilter(filterId, filterFunction) {
  const monthFilter = document.getElementById(filterId);
  if (!monthFilter) return;
  
  const now = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yearMonth = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
    const displayText = date.getFullYear() + '年' + (date.getMonth() + 1) + '月';
    
    const option = document.createElement('option');
    option.value = yearMonth;
    option.textContent = displayText;
    if (i === 0 && filterId === 'monthFilter') option.selected = true; // 活動報告のみ現在月をデフォルト
    
    monthFilter.appendChild(option);
  }
  
  if (filterFunction) {
    monthFilter.addEventListener('change', filterFunction);
  }
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
    case 'transfer-confirm':
      loadTransferConfirm();
      break;
    case 'backup':
      loadBackup();
      break;
  }
}

// 統計情報更新（常に対象月の全データを対象）
function updateStatistics() {
  if (!allReports || !Array.isArray(allReports)) {
    console.log('allReports is not available yet');
    return;
  }
  
  const monthFilter = document.getElementById('monthFilter').value;
  let monthReports = allReports;
  
  // 月フィルターのみ適用（開催日ベース）
  if (monthFilter) {
    monthReports = allReports.filter(report => {
      const eventDate = new Date(report.eventDate);
      const eventMonth = eventDate.getFullYear() + '-' + String(eventDate.getMonth() + 1).padStart(2, '0');
      return eventMonth === monthFilter;
    });
  }
  
  const statusCounts = {
    total: monthReports.length,
    '投稿まち': 0,
    '金額確定まち': 0,
    '振込OK': 0,
    '振込NG': 0,
    '完了': 0
  };
  
  monthReports.forEach(report => {
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
    const result = await apiRequest('getAdminReports');
    
    if (result.success || result.data) {
      allReports = result.data || result.reports || [];
      console.log('allReports loaded:', allReports.length, 'items');
      await initializeSiteFilter(); // 拠点フィルターを更新
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

// DOMContentLoadedでも関数を設定（フォールバック）
document.addEventListener('DOMContentLoaded', function() {
  window.applyFilters = function() {
    console.log('applyFilters called');
    filterReports();
  };
  
  window.clearFilters = function() {
    console.log('clearFilters called');
    document.getElementById('monthFilter').value = '';
    document.getElementById('statusFilter').value = '';
    const siteFilter = document.getElementById('siteFilter');
    if (siteFilter) {
      siteFilter.value = '';
    }
    filterReports();
  };
});

// フィルター適用
function filterReports() {
  const monthFilter = document.getElementById('monthFilter').value;
  const statusFilter = document.getElementById('statusFilter').value;
  const siteFilter = document.getElementById('siteFilter')?.value;
  
  console.log('フィルター値:', { monthFilter, statusFilter, siteFilter });
  
  let filteredReports = allReports;
  
  // 月フィルター（開催日ベース）
  if (monthFilter) {
    filteredReports = filteredReports.filter(report => {
      const eventDate = new Date(report.eventDate);
      const eventMonth = eventDate.getFullYear() + '-' + String(eventDate.getMonth() + 1).padStart(2, '0');
      return eventMonth === monthFilter;
    });
  }
  
  // ステータスフィルター
  if (statusFilter) {
    filteredReports = filteredReports.filter(report => report.processingFlag === statusFilter);
  }
  
  // 拠点フィルター
  if (siteFilter) {
    console.log('拠点フィルター適用前:', filteredReports.length + '件');
    filteredReports = filteredReports.filter(report => {
      console.log('比較:', report.siteName, '===', siteFilter, report.siteName === siteFilter);
      return report.siteName === siteFilter;
    });
    console.log('拠点フィルター適用後:', filteredReports.length + '件');
  }
  
  // ソート適用
  filteredReports = sortReportsArray(filteredReports);
  
  // 統計更新（フィルターに関係なく対象月の全データ）
  updateStatistics();
  
  // テーブル更新
  const tbody = document.getElementById('reportsList');
  if (filteredReports.length > 0) {
    tbody.innerHTML = filteredReports.map((report, index) => {
      // 元のallReports配列でのインデックスを取得
      const originalIndex = allReports.findIndex(r => 
        r.timestamp === report.timestamp && 
        r.siteName === report.siteName && 
        r.userId === report.userId
      );
      
      return `
      <tr>
        <td>${new Date(report.timestamp).toLocaleDateString('ja-JP')}</td>
        <td>${escapeHtml(report.siteName)}</td>
        <td>${escapeHtml(report.nickname || report.userId)}</td>
        <td>${new Date(report.eventDate).toLocaleDateString('ja-JP')}</td>
        <td>${escapeHtml(report.eventType)}</td>
        <td>大人:${report.adults} 子:${report.children} スタッフ:${report.staff || '未記録'}</td>
        <td>${report.amount ? report.amount.toLocaleString().replace(/\\/g, '') + '円' : '-'}</td>
        <td>
          <select class="form-select form-select-sm status-select" 
                  onchange="changeReportStatus(this, ${originalIndex})"
                  data-original-status="${report.processingFlag || '投稿まち'}"
                  data-current-status="${report.processingFlag || '投稿まち'}">
            <option value="投稿まち" ${(report.processingFlag || '投稿まち') === '投稿まち' ? 'selected' : ''}>⚠️ 投稿まち</option>
            <option value="金額確定まち" ${report.processingFlag === '金額確定まち' ? 'selected' : ''}>ℹ️ 金額確定まち</option>
            <option value="振込OK" ${report.processingFlag === '振込OK' ? 'selected' : ''}>✅ 振込OK</option>
            <option value="振込NG" ${report.processingFlag === '振込NG' ? 'selected' : ''}>❌ 振込NG</option>
            <option value="完了" ${report.processingFlag === '完了' ? 'selected' : ''}>🏁 完了</option>
          </select>
        </td>
        <td>
          <button class="btn btn-sm btn-outline-primary" onclick="showReportDetails(${originalIndex})">
            詳細
          </button>
        </td>
      </tr>
      `;
    }).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center">データがありません</td></tr>';
  }
}

// 報告詳細表示
window.showReportDetails = function(index) {
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
        <p><strong>スタッフ:</strong> ${report.staff || 0}人</p>
        <p><strong>請求額:</strong> ${report.amount ? report.amount.toLocaleString().replace(/\\/g, '') + '円' : '未確定'}</p>
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
    const result = await apiRequest('getAdminKifuData');
    
    if (result.success || result.data) {
      const kifuData = result.data || result.kifu || [];
      console.log('寄付データ取得:', kifuData);
      
      // 食品寄付データを取得（GASから返されるfoodプロパティ）
      allFoodDonations = kifuData.food || [];
      
      console.log('食品寄付フィルター後:', allFoodDonations.length + '件');
      
      const tbody = document.getElementById('foodDonationsList');
      
      console.log('食品寄付データ詳細:', allFoodDonations);
      
      // 統計を更新
      updateFoodDonationStatistics(allFoodDonations);
      
      // ソートを適用して表示
      applyFoodDonationSort();
      
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
    const result = await apiRequest('getAdminKifuData');
    
    if (result.success || result.data) {
      const kifuData = result.data || result.kifu || [];
      // 金銭寄付データを取得（GASから返されるmoneyプロパティ）
      allMoneyDonations = kifuData.money || [];
      
      const tbody = document.getElementById('moneyDonationsList');
      
      // 統計を更新
      updateMoneyDonationStatistics(allMoneyDonations);
      
      // ソートを適用して表示
      applyMoneyDonationSort();
      
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
  const pagination = document.getElementById('logPagination');
  
  loading.style.display = 'block';
  errorMsg.style.display = 'none';
  table.style.display = 'none';
  pagination.style.display = 'none';
  
  try {
    const result = await apiRequest('getLogs');
    
    if (result.success || result.data) {
      allLogs = result.data || result.logs || [];
      
      // デバッグ: ログデータの形式を確認
      console.log('Raw logs:', allLogs);
      const firstLog = allLogs[0];
      console.log('First log:', firstLog);
      if (firstLog) {
        console.log('First log keys:', Object.keys(firstLog));
        console.log('First log values:', Object.values(firstLog));
        console.log('Looking for タイムスタンプ key:', firstLog['タイムスタンプ']);
        console.log('Looking for 種類 key:', firstLog['種類']);
        console.log('Looking for カテゴリ key:', firstLog['カテゴリ']);
        console.log('Looking for 詳細 key:', firstLog['詳細']);
      }
      
      // 最近30日のログのみを取得
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // GASから返されるログデータをそのまま使用（変換処理なし）
      console.log('GASから取得した生ログデータ:', allLogs);
      
      console.log('All logs after conversion:', allLogs);
      
      // 一時的に30日フィルタリングを無効化（ログ形式確認のため）
      console.log('30日フィルタリングをスキップしています');
      // allLogs = allLogs.filter(log => {
      //   const logDate = new Date(log['タイムスタンプ'] || log.timestamp);
      //   return !isNaN(logDate) && logDate >= thirtyDaysAgo;
      // });
      
      console.log('Filtered logs:', allLogs);
      
      currentLogPage = 1;
      updateLogStatistics();
      applyLogFilters();
      
      loading.style.display = 'none';
      table.style.display = 'table';
      pagination.style.display = 'block';
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
    const result = await apiRequest('getUsers');
    
    if (result.success || result.data) {
      allUsers = result.data || [];
      applyUserSort();
    }
  } catch (error) {
    console.error('Users load error:', error);
    showError('ユーザー一覧の読み込みに失敗しました');
  }
}

// 拠点読み込み
async function loadSites() {
  try {
    const result = await apiRequest('getSite?userId=admin');
    
    if (result.success && result.data) {
      allSites = result.data || [];
      applySiteSort();
    }
  } catch (error) {
    console.error('Sites load error:', error);
    showError('拠点一覧の読み込みに失敗しました');
  }
}

// 古い編集機能（削除済み）


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

// ステータス表示クラス取得
function getStatusClass(status) {
  switch(status) {
    case '投稿まち': return 'status-waiting';
    case '金額確定まち': return 'status-amount-waiting';
    case '振込OK': return 'status-ok';
    case '振込NG': return 'status-ng';
    case '完了': return 'status-completed';
    default: return 'status-waiting';
  }
}

// ステータスアイコン取得
function getStatusIcon(status) {
  switch(status) {
    case '投稿まち': return '⚠️';
    case '金額確定まち': return 'ℹ️';
    case '振込OK': return '✅';
    case '振込NG': return '❌';
    case '完了': return '🏁';
    default: return '⚠️';
  }
}

// ステータスバッジクラス取得（モーダル用）
function getStatusBadgeClass(status) {
  switch(status) {
    case '投稿まち': return 'bg-warning text-dark';
    case '金額確定まち': return 'bg-info text-white';
    case '振込OK': return 'bg-success text-white';
    case '振込NG': return 'bg-danger text-white';
    case '完了': return 'bg-secondary text-white';
    default: return 'bg-warning text-dark';
  }
}

// グローバル変数
let pendingStatusChange = null;


// ステータス変更モーダル表示（バッジクリック用）
function showStatusChangeModal(reportIndex) {
  const report = allReports[reportIndex];
  if (!report) return;
  
  const currentStatus = report.processingFlag || '投稿まち';
  const modalBody = document.getElementById('statusChangeModalBody');
  
  modalBody.innerHTML = `
    <div class="row">
      <div class="col-12">
        <h6 class="mb-3">変更対象の投稿詳細</h6>
        <table class="table table-sm">
          <tr><th style="width: 100px;">投稿日時</th><td>${new Date(report.timestamp).toLocaleDateString('ja-JP')}</td></tr>
          <tr><th>拠点名</th><td>${escapeHtml(report.siteName)}</td></tr>
          <tr><th>投稿者</th><td>${escapeHtml(report.nickname || report.userId)}</td></tr>
          <tr><th>開催日</th><td>${new Date(report.eventDate).toLocaleDateString('ja-JP')}</td></tr>
          <tr><th>開催タイプ</th><td>${escapeHtml(report.eventType)}</td></tr>
          <tr><th>金額</th><td>${report.amount ? report.amount.toLocaleString().replace(/\\/g, '') + '円' : '金額未確定'}</td></tr>
        </table>
      </div>
    </div>
    <div class="row mt-3">
      <div class="col-12">
        <div class="mb-3">
          <label class="form-label">現在のステータス</label>
          <div>
            <span class="status-badge ${getStatusClass(currentStatus)}">${currentStatus}</span>
          </div>
        </div>
        <div class="mb-3">
          <label class="form-label">新しいステータスを選択</label>
          <div class="d-grid gap-2">
            <button class="btn btn-outline-warning" onclick="confirmStatusChange(${reportIndex}, '投稿まち')">投稿まち</button>
            <button class="btn btn-outline-info" onclick="confirmStatusChange(${reportIndex}, '金額確定まち')">金額確定まち</button>
            <button class="btn btn-outline-success" onclick="confirmStatusChange(${reportIndex}, '振込OK')">振込OK</button>
            <button class="btn btn-outline-danger" onclick="confirmStatusChange(${reportIndex}, '振込NG')">振込NG</button>
            <button class="btn btn-outline-secondary" onclick="confirmStatusChange(${reportIndex}, '完了')">完了</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // モーダル表示
  const modal = new bootstrap.Modal(document.getElementById('statusChangeModal'));
  modal.show();
}

// ステータス変更確認
function confirmStatusChange(reportIndex, newStatus) {
  const report = allReports[reportIndex];
  if (!report) return;
  
  const oldStatus = report.processingFlag || '投稿まち';
  
  // 同じステータスの場合は何もしない
  if (oldStatus === newStatus) {
    const modal = bootstrap.Modal.getInstance(document.getElementById('statusChangeModal'));
    if (modal) modal.hide();
    return;
  }
  
  // ペンディング情報を保存
  pendingStatusChange = {
    reportIndex,
    newStatus
  };
  
  // 確認メッセージを表示
  const modalBody = document.getElementById('statusChangeModalBody');
  modalBody.innerHTML += `
    <div class="row mt-3">
      <div class="col-12">
        <div class="alert alert-warning">
          <strong>変更を確定しますか？</strong><br>
          ステータスを<br>
          <span class="status-badge ${getStatusClass(oldStatus)}">${oldStatus}</span> から 
          <span class="status-badge ${getStatusClass(newStatus)}">${newStatus}</span> へ変更します。
        </div>
      </div>
    </div>
  `;
  
  // ボタンを変更
  const footer = document.querySelector('#statusChangeModal .modal-footer');
  footer.innerHTML = `
    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">キャンセル</button>
    <button type="button" class="btn btn-primary" onclick="executeStatusChange()">変更を確定</button>
  `;
}

// ステータス変更実行
async function executeStatusChange() {
  if (!pendingStatusChange) return;
  
  const { reportIndex, newStatus, selectElement } = pendingStatusChange;
  const report = allReports[reportIndex];
  
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
  } finally {
    // モーダルを閉じる
    const modal = bootstrap.Modal.getInstance(document.getElementById('statusChangeModal'));
    if (modal) modal.hide();
    pendingStatusChange = null;
  }
}

// シンプルなステータス変更（プルダウン用）
function changeReportStatus(selectElement, reportIndex) {
  const newStatus = selectElement.value;
  const originalStatus = selectElement.getAttribute('data-original-status');
  const report = allReports[reportIndex];
  
  if (!report) {
    showError('レポートが見つかりません');
    selectElement.value = originalStatus; // 元に戻す
    return;
  }
  
  if (newStatus === originalStatus) {
    return; // 変更なし
  }
  
  // 確認モーダルを表示
  showStatusConfirmModal(report, originalStatus, newStatus, selectElement, reportIndex);
}

// ステータス変更確認モーダル表示
function showStatusConfirmModal(report, oldStatus, newStatus, selectElement, reportIndex) {
  const modalBody = document.getElementById('statusConfirmModalBody');
  
  modalBody.innerHTML = `
    <div class="mb-3">
      <table class="table table-sm table-borderless">
        <tr>
          <td class="fw-bold" style="width: 80px;">拠点名:</td>
          <td>${escapeHtml(report.siteName)}</td>
        </tr>
        <tr>
          <td class="fw-bold">開催日:</td>
          <td>${new Date(report.eventDate).toLocaleDateString('ja-JP')}</td>
        </tr>
        <tr>
          <td class="fw-bold">金額:</td>
          <td>${report.amount ? report.amount.toLocaleString().replace(/\\/g, '') + '円' : '金額未確定'}</td>
        </tr>
      </table>
    </div>
    <div class="text-center">
      <p class="mb-3">
        ステータスを<br>
        <span class="badge ${getStatusBadgeClass(oldStatus)}">${getStatusIcon(oldStatus)} ${oldStatus}</span> から 
        <span class="badge ${getStatusBadgeClass(newStatus)}">${getStatusIcon(newStatus)} ${newStatus}</span><br>
        へ変更します
      </p>
      <p class="mb-0 text-muted">よろしいですか？</p>
    </div>
  `;
  
  // グローバル変数に情報を保存
  window.pendingStatusChangeData = {
    report,
    oldStatus,
    newStatus,
    selectElement,
    reportIndex
  };
  
  // モーダル表示
  const modal = new bootstrap.Modal(document.getElementById('statusConfirmModal'));
  modal.show();
}

// ステータス変更確定処理
async function confirmStatusChange() {
  if (!window.pendingStatusChangeData) return;
  
  const { report, newStatus, selectElement, reportIndex } = window.pendingStatusChangeData;
  
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
      selectElement.setAttribute('data-original-status', newStatus);
      selectElement.setAttribute('data-current-status', newStatus);
      
      // 統計を更新
      updateStatistics();
      
      // モーダルを閉じる
      const modal = bootstrap.Modal.getInstance(document.getElementById('statusConfirmModal'));
      if (modal) modal.hide();
      
      showSuccess(`ステータスを「${newStatus}」に更新しました`);
    } else {
      throw new Error(result.error || '更新に失敗しました');
    }
  } catch (error) {
    showError('更新に失敗しました: ' + error.message);
    // エラー時は元の値に戻す
    selectElement.value = selectElement.getAttribute('data-original-status');
  } finally {
    window.pendingStatusChangeData = null;
  }
}

// ステータス変更キャンセル処理
function cancelStatusChange() {
  if (!window.pendingStatusChangeData) return;
  
  const { selectElement } = window.pendingStatusChangeData;
  // 元の値に戻す
  selectElement.value = selectElement.getAttribute('data-original-status');
  
  window.pendingStatusChangeData = null;
}

// 振込確認関連の変数とデータ
let allTransferData = [];
let pendingTransferData = null;

// 振込確認データ読み込み
async function loadTransferConfirm() {
  const container = document.querySelector('#transfer-confirm .table-container');
  const loading = container.querySelector('.loading');
  const errorMsg = container.querySelector('.error-message');
  const table = document.getElementById('transferTable');
  
  loading.style.display = 'block';
  errorMsg.style.display = 'none';
  table.style.display = 'none';
  
  try {
    // 活動報告データと拠点データを取得
    const [reportsResult, sitesResult] = await Promise.all([
      apiRequest('getAdminReports'),
      apiRequest('getSite?userId=admin')
    ]);
    
    if ((reportsResult.success || reportsResult.data) && (sitesResult.success && sitesResult.data)) {
      const reports = reportsResult.data || reportsResult.reports || [];
      const sites = sitesResult.data || [];
      
      // 振込確認用のデータを生成
      allTransferData = generateTransferData(reports, sites);
      
      // フィルター初期化
      initializeTransferFilters();
      
      // 表示を更新
      applyTransferFilters();
      
      loading.style.display = 'none';
      table.style.display = 'block';
    } else {
      throw new Error('データ取得エラー');
    }
  } catch (error) {
    loading.style.display = 'none';
    errorMsg.textContent = 'エラー: ' + error.message;
    errorMsg.style.display = 'block';
  }
}

// 振込確認用データの生成
function generateTransferData(reports, sites) {
  const siteMap = new Map();
  
  // 拠点情報をマップに格納（全拠点を含む）
  sites.forEach(site => {
    const siteName = site['拠点名'] || site.siteName || site.name || '';
    if (siteName) {
      siteMap.set(siteName, {
        name: siteName,
        account: site['振込口座'] || site.transferDestination || site.account || '口座情報なし',
        reports: []
      });
    }
  });
  
  // 活動報告を拠点別に分類
  reports.forEach(report => {
    const siteName = report.siteName;
    if (siteName) {
      if (siteMap.has(siteName)) {
        siteMap.get(siteName).reports.push(report);
      } else {
        // 拠点データにない場合は新規作成
        siteMap.set(siteName, {
          name: siteName,
          account: '口座情報なし',
          reports: [report]
        });
      }
    }
  });
  
  return Array.from(siteMap.values());
}

// 振込フィルター初期化
function initializeTransferFilters() {
  initializeMonthFilter('transferMonthFilter', applyTransferFilters);
  
  // 拠点フィルター
  const transferSiteFilter = document.getElementById('transferSiteFilter');
  if (transferSiteFilter && allTransferData) {
    // 既存のオプションをクリア（「全て」以外）
    while (transferSiteFilter.options.length > 1) {
      transferSiteFilter.remove(1);
    }
    
    // 拠点名を追加
    const siteNames = allTransferData.map(data => data.name).sort();
    siteNames.forEach(siteName => {
      const option = document.createElement('option');
      option.value = siteName;
      option.textContent = siteName;
      transferSiteFilter.appendChild(option);
    });
  }
}

// 振込フィルター適用
function applyTransferFilters() {
  const monthFilter = document.getElementById('transferMonthFilter').value;
  const statusFilter = document.getElementById('transferStatusFilter').value;
  const siteFilter = document.getElementById('transferSiteFilter').value;
  
  let filteredData = allTransferData.map(siteData => {
    let filteredReports = siteData.reports;
    
    // 月フィルター（開催日ベース）
    if (monthFilter) {
      filteredReports = filteredReports.filter(report => {
        const eventDate = new Date(report.eventDate);
        const eventMonth = eventDate.getFullYear() + '-' + String(eventDate.getMonth() + 1).padStart(2, '0');
        return eventMonth === monthFilter;
      });
    }
    
    // ステータスフィルター
    if (statusFilter) {
      if (statusFilter === '要確認') {
        // 要確認の場合：振込OKのレポートがない拠点
        filteredReports = filteredReports.filter(report => 
          report.processingFlag !== '振込OK' && report.processingFlag !== '完了'
        );
      } else {
        filteredReports = filteredReports.filter(report => 
          report.processingFlag === statusFilter
        );
      }
    }
    
    return {
      ...siteData,
      reports: filteredReports
    };
  });
  
  // 拠点フィルター
  if (siteFilter) {
    filteredData = filteredData.filter(siteData => siteData.name === siteFilter);
  }
  
  // ステータスフィルターに応じた表示制御
  if (statusFilter === '要確認') {
    filteredData = filteredData.filter(siteData => {
      const hasOkReports = siteData.reports.some(report => report.processingFlag === '振込OK');
      const hasCompletedReports = siteData.reports.some(report => report.processingFlag === '完了');
      return !hasOkReports && !hasCompletedReports && siteData.reports.length > 0;
    });
  } else if (statusFilter === '活動なし') {
    filteredData = filteredData.filter(siteData => siteData.reports.length === 0);
  } else if (statusFilter) {
    // 特定のステータスのレポートがある拠点のみ表示
    filteredData = filteredData.filter(siteData => siteData.reports.length > 0);
  }
  // フィルターなしの場合は全て表示（活動なしも含む）
  
  // 統計を更新
  updateTransferStatistics(filteredData);
  
  // テーブル表示を更新
  renderTransferTable(filteredData);
}

// 振込統計更新
function updateTransferStatistics(filteredData) {
  // 総団体数は全拠点の数（フィルタに関係なく）
  const totalOrganizations = allTransferData.length;
  
  // 振込あり団体数（振込OKのレポートがある拠点数）
  const transferCount = filteredData.filter(siteData => 
    siteData.reports.some(report => report.processingFlag === '振込OK')
  ).length;
  
  // 活動なし団体数
  const noActivityCount = allTransferData.filter(siteData => 
    siteData.reports.length === 0
  ).length;
  
  // 総振込金額を計算（15,000円上限を適用）
  const totalAmount = filteredData.reduce((sum, siteData) => {
    return sum + siteData.reports
      .filter(report => ['振込OK', '振込NG', '金額確定まち', '完了'].includes(report.processingFlag))
      .reduce((siteSum, report) => {
        // 金額を確実に数値として取得
        let amount = 0;
        if (report.amount !== undefined && report.amount !== null) {
          const amountStr = String(report.amount).replace(/[^0-9.-]/g, '');
          amount = parseFloat(amountStr);
          if (isNaN(amount)) amount = 0;
        }
        return siteSum + amount;
      }, 0);
  }, 0);
  
  document.getElementById('totalOrganizations').textContent = totalOrganizations;
  document.getElementById('transferCount').textContent = transferCount;
  document.getElementById('noActivityCount').textContent = noActivityCount;
  document.getElementById('totalTransferAmount').textContent = 
    isNaN(totalAmount) ? '0円' : Math.floor(totalAmount).toLocaleString() + '円';
}

// 振込テーブル表示
function renderTransferTable(filteredData) {
  const container = document.getElementById('transferList');
  
  if (filteredData.length === 0) {
    container.innerHTML = '<div class="text-center p-4">該当するデータがありません</div>';
    return;
  }
  
  container.innerHTML = filteredData.map((siteData, index) => {
    const okReports = siteData.reports.filter(report => report.processingFlag === '振込OK');
    const completedReports = siteData.reports.filter(report => report.processingFlag === '完了');
    const allRelevantReports = siteData.reports.filter(report => 
      ['振込OK', '振込NG', '金額確定まち', '完了'].includes(report.processingFlag)
    );
    
    // 各拠点の総金額を計算（15,000円上限を適用）
    const siteTotal = Math.min(
      allRelevantReports.reduce((sum, report) => {
        let amount = 0;
        if (report.amount !== undefined && report.amount !== null) {
          const amountStr = String(report.amount).replace(/[^0-9.-]/g, '');
          amount = parseFloat(amountStr);
          if (isNaN(amount)) amount = 0;
        }
        return sum + amount;
      }, 0),
      15000
    );
    
    // ボタンの状態を決定
    const hasTransferData = okReports.length > 0;
    const isCompleted = completedReports.length > 0 && okReports.length === 0;
    const hasActivity = siteData.reports.length > 0;
    const activityCount = allRelevantReports.length;
    
    return `
      <div class="card mb-3">
        <div class="card-header">
          <h6 class="mb-0">${escapeHtml(siteData.name)}</h6>
        </div>
        <div class="card-body">
          <!-- 活動報告一覧 -->
          <div class="table-responsive mb-3">
            ${hasActivity ? `
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>開催日</th>
                    <th>開催タイプ</th>
                    <th>金額</th>
                    <th>ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  ${siteData.reports.map(report => `
                    <tr>
                      <td>${new Date(report.eventDate).toLocaleDateString('ja-JP')}</td>
                      <td>${escapeHtml(report.eventType)}</td>
                      <td>${(() => {
                        const amount = parseFloat(String(report.amount || '0').replace(/[^0-9.-]/g, ''));
                        return isNaN(amount) || amount === 0 ? '-' : Math.floor(amount).toLocaleString() + '円';
                      })()}</td>
                      <td>
                        <span class="badge ${getStatusBadgeClass(report.processingFlag || '投稿まち')}">
                          ${getStatusIcon(report.processingFlag || '投稿まち')} ${report.processingFlag || '投稿まち'}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : `
              <div class="text-start text-muted">
                活動報告なし
              </div>
            `}
          </div>
          
          <!-- 合計と振込情報 -->
          ${hasActivity ? `
            <div class="row align-items-center">
              <div class="col-12 text-end">
                <div class="mb-2">
                  <strong>合計振込金額: </strong>
                  <span class="h5 text-primary">${Math.floor(siteTotal).toLocaleString()}円</span>
                  <span class="ms-3"><strong>活動件数: </strong><span class="h5 text-info">${activityCount}件</span></span>
                </div>
                <div class="mb-2">
                  <strong>振込先口座: </strong>
                  <span class="text-muted">${escapeHtml(siteData.account)}</span>
                </div>
                <div>
                  ${hasTransferData ? 
                    `<button class="btn btn-success" onclick="showTransferConfirm('${escapeHtml(siteData.name)}', '${escapeHtml(siteData.account)}', ${siteTotal}, ${activityCount})">
                      <i class="bi bi-bank"></i> 振込する
                    </button>` :
                    isCompleted ?
                      `<button class="btn btn-secondary" disabled>
                        <i class="bi bi-check-circle"></i> 完了
                      </button>` :
                      `<button class="btn btn-danger" onclick="showCheckRequired('${escapeHtml(siteData.name)}')">
                        <i class="bi bi-exclamation-triangle"></i> 要確認
                      </button>`
                  }
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// 振込フィルタークリア
function clearTransferFilters() {
  document.getElementById('transferMonthFilter').value = '';
  document.getElementById('transferStatusFilter').value = '';
  document.getElementById('transferSiteFilter').value = '';
  applyTransferFilters();
}

// グローバル関数として設定
window.applyTransferFilters = applyTransferFilters;
window.clearTransferFilters = clearTransferFilters;

// 振込確認モーダル表示
function showTransferConfirm(siteName, account, amount, activityCount) {
  const modalBody = document.getElementById('transferConfirmModalBody');
  
  modalBody.innerHTML = `
    <div class="text-start">
      <div class="mb-3">
        <h6 class="text-primary">${escapeHtml(siteName)}</h6>
        <p class="mb-2">への振り込み先</p>
        <div class="alert alert-info mb-3">
          <i class="bi bi-bank"></i> ${escapeHtml(account)}
        </div>
        <p class="mb-2">振込金額: <strong class="text-success">${Math.floor(amount).toLocaleString()}円</strong></p>
        <p class="mb-2">活動件数: <strong class="text-info">${activityCount}件</strong></p>
      </div>
      <p class="mb-0 text-muted">振込完了でよろしいですか？</p>
    </div>
  `;
  
  // グローバル変数に情報を保存
  pendingTransferData = { siteName, account, amount, activityCount };
  
  // モーダル表示
  const modal = new bootstrap.Modal(document.getElementById('transferConfirmModal'));
  modal.show();
}

// 振込確定処理
async function confirmTransfer() {
  if (!pendingTransferData) return;
  
  const { siteName } = pendingTransferData;
  
  try {
    // 該当拠点の「振込OK」ステータスのレポートを「完了」に更新
    const siteData = allTransferData.find(data => data.name === siteName);
    if (!siteData) {
      throw new Error('拠点データが見つかりません');
    }
    
    const okReports = siteData.reports.filter(report => report.processingFlag === '振込OK');
    
    // 複数のレポートを一括更新
    const updatePromises = okReports.map(report => 
      apiRequest('updateReportStatus', 'POST', {
        action: 'updateReportStatus',
        timestamp: report.timestamp,
        siteName: report.siteName,
        status: '完了'
      })
    );
    
    await Promise.all(updatePromises);
    
    // ローカルデータを更新
    okReports.forEach(report => {
      report.processingFlag = '完了';
      
      // allReportsも更新（存在する場合）
      if (window.allReports) {
        const originalReport = allReports.find(r => 
          r.timestamp === report.timestamp && 
          r.siteName === report.siteName && 
          r.userId === report.userId
        );
        if (originalReport) {
          originalReport.processingFlag = '完了';
        }
      }
    });
    
    // モーダルを閉じる
    const modal = bootstrap.Modal.getInstance(document.getElementById('transferConfirmModal'));
    if (modal) modal.hide();
    
    // 表示を更新
    applyTransferFilters();
    
    showSuccess(`${siteName}の振込処理が完了しました。${okReports.length}件のレポートを「完了」に更新しました。`);
    
  } catch (error) {
    showError('振込処理に失敗しました: ' + error.message);
  } finally {
    pendingTransferData = null;
  }
}

// 振込キャンセル処理
function cancelTransfer() {
  pendingTransferData = null;
}

// 要確認メッセージ表示
function showCheckRequired(siteName) {
  showError(`${siteName} は振込OKのレポートがありません。活動報告ページで確認してください。`);
}

// グローバル関数として設定
window.showTransferConfirm = showTransferConfirm;
window.confirmTransfer = confirmTransfer;
window.cancelTransfer = cancelTransfer;
window.showCheckRequired = showCheckRequired;

// ユーティリティ関数
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text.toString();
  return div.innerHTML;
}

// モーダル表示関数
function showModal(title, message, type = 'success') {
  const modal = document.getElementById('messageModal');
  const titleElement = document.getElementById('messageModalTitle');
  const bodyElement = document.getElementById('messageModalBody');
  
  // アイコンと色を設定
  let icon = '';
  let headerClass = '';
  
  if (type === 'success') {
    icon = '✅ ';
    headerClass = 'text-success';
  } else if (type === 'error') {
    icon = '❌ ';
    headerClass = 'text-danger';
  } else if (type === 'warning') {
    icon = '⚠️ ';
    headerClass = 'text-warning';
  } else {
    icon = 'ℹ️ ';
    headerClass = 'text-info';
  }
  
  titleElement.textContent = title;
  titleElement.className = 'modal-title ' + headerClass;
  bodyElement.innerHTML = '<p class="mb-0">' + icon + escapeHtml(message) + '</p>';
  
  // モーダルを表示
  const bootstrapModal = new bootstrap.Modal(modal);
  bootstrapModal.show();
}

function showSuccess(message) {
  showModal('成功', message, 'success');
}

function showError(message) {
  showModal('エラー', message, 'error');
}

function showWarning(message) {
  showModal('警告', message, 'warning');
}

function showInfo(message) {
  showModal('情報', message, 'info');
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

// 拠点フィルター初期化
async function initializeSiteFilter() {
  const siteFilter = document.getElementById('siteFilter');
  if (!siteFilter) return;
  
  // 既存のオプションをクリア（「全て」以外）
  while (siteFilter.options.length > 1) {
    siteFilter.remove(1);
  }
  
  try {
    // Google Sheetsのsiteシートから取得
    const result = await apiRequest('getSite?userId=admin');
    if (result.success && result.data) {
      const sites = result.data.map(site => site['拠点名'] || site.siteName || site.name).filter(Boolean).sort();
      
      sites.forEach(site => {
        const option = document.createElement('option');
        option.value = site;
        option.textContent = site;
        siteFilter.appendChild(option);
      });
    }
  } catch (error) {
    console.error('拠点リスト取得エラー:', error);
    // フォールバック: レポートデータから取得
    const sites = [...new Set(allReports.map(report => report.siteName))].sort();
    sites.forEach(site => {
      const option = document.createElement('option');
      option.value = site;
      option.textContent = site;
      siteFilter.appendChild(option);
    });
  }
}

// ソート関数
window.sortReports = function(column) {
  if (sortColumn === column) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn = column;
    sortDirection = 'asc';
  }
  filterReports();
}

// レポート配列をソート
function sortReportsArray(reports) {
  return reports.sort((a, b) => {
    let aVal = a[sortColumn];
    let bVal = b[sortColumn];
    
    // 日付の場合
    if (sortColumn === 'timestamp' || sortColumn === 'eventDate') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }
    
    // 数値の場合
    if (sortColumn === 'amount') {
      aVal = parseInt(aVal) || 0;
      bVal = parseInt(bVal) || 0;
    }
    
    // 文字列の場合
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });
}

// 食品寄付統計更新
function updateFoodDonationStatistics(donations) {
  console.log('食品寄付統計更新開始:', donations.length, '件');
  
  const now = new Date();
  const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  
  const totalCount = donations.length;
  const currentMonthCount = donations.filter(donation => {
    const donationDate = new Date(donation.timestamp);
    const donationMonth = donationDate.getFullYear() + '-' + String(donationDate.getMonth() + 1).padStart(2, '0');
    console.log('日付チェック:', donation.timestamp, '→', donationMonth, 'vs', currentMonth);
    return donationMonth === currentMonth;
  }).length;
  
  console.log('統計結果 - 総数:', totalCount, '当月:', currentMonthCount);
  
  const totalElement = document.getElementById('totalFoodDonations');
  const currentElement = document.getElementById('currentMonthFoodDonations');
  
  if (totalElement) {
    totalElement.textContent = totalCount;
    console.log('総数要素更新:', totalCount);
  } else {
    console.error('totalFoodDonations要素が見つかりません');
  }
  
  if (currentElement) {
    currentElement.textContent = currentMonthCount;
    console.log('当月要素更新:', currentMonthCount);
  } else {
    console.error('currentMonthFoodDonations要素が見つかりません');
  }
}

// 金銭寄付統計更新
function updateMoneyDonationStatistics(donations) {
  console.log('金銭寄付統計更新開始:', donations.length, '件');
  
  const now = new Date();
  const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  
  const totalCount = donations.length;
  const totalAmount = donations.reduce((sum, donation) => {
    const amount = parseInt(donation.amount) || 0;
    console.log('金額チェック:', donation.amount, '→', amount);
    return sum + amount;
  }, 0);
  
  const currentMonthDonations = donations.filter(donation => {
    const donationDate = new Date(donation.timestamp);
    const donationMonth = donationDate.getFullYear() + '-' + String(donationDate.getMonth() + 1).padStart(2, '0');
    return donationMonth === currentMonth;
  });
  
  const currentMonthCount = currentMonthDonations.length;
  const currentMonthAmount = currentMonthDonations.reduce((sum, donation) => sum + (parseInt(donation.amount) || 0), 0);
  
  console.log('金銭統計結果 - 総数:', totalCount, '総額:', totalAmount, '当月数:', currentMonthCount, '当月額:', currentMonthAmount);
  
  const elements = {
    totalAmount: document.getElementById('totalMoneyAmount'),
    totalCount: document.getElementById('totalMoneyDonations'),
    currentAmount: document.getElementById('currentMonthMoneyAmount'),
    currentCount: document.getElementById('currentMonthMoneyDonations')
  };
  
  if (elements.totalAmount) {
    elements.totalAmount.textContent = totalAmount.toLocaleString().replace(/\\/g, '') + '円';
  } else {
    console.error('totalMoneyAmount要素が見つかりません');
  }
  
  if (elements.totalCount) {
    elements.totalCount.textContent = totalCount;
  } else {
    console.error('totalMoneyDonations要素が見つかりません');
  }
  
  if (elements.currentAmount) {
    elements.currentAmount.textContent = currentMonthAmount.toLocaleString().replace(/\\/g, '') + '円';
  } else {
    console.error('currentMonthMoneyAmount要素が見つかりません');
  }
  
  if (elements.currentCount) {
    elements.currentCount.textContent = currentMonthCount;
  } else {
    console.error('currentMonthMoneyDonations要素が見つかりません');
  }
}

// 食品寄付フィルター
function filterFoodDonations() {
  applyFoodDonationSort();
}

// 金銭寄付フィルター
function filterMoneyDonations() {
  applyMoneyDonationSort();
}

// Instagram投稿処理
function postToInstagram(donationIndex) {
  const donation = allFoodDonations[donationIndex];
  if (!donation) return;
  
  const instagramUrl = prompt(`Instagram投稿URLを入力してください:\n\n寄付品名: ${donation.itemName}\n寄付元: ${donation.donor}`);
  
  if (instagramUrl && instagramUrl.trim()) {
    // 実際の処理ではGASにデータを送信
    donation.instagramUrl = instagramUrl.trim();
    loadFoodDonations(); // 表示を更新
    showSuccess('Instagram投稿URLを設定しました');
  }
}

// 食品寄付ソート用のグローバル変数
let foodSortColumn = 'timestamp';
let foodSortDirection = 'desc';

// 食品寄付ソート関数
window.sortFoodDonations = function(column) {
  if (foodSortColumn === column) {
    foodSortDirection = foodSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    foodSortColumn = column;
    foodSortDirection = 'asc';
  }
  applyFoodDonationSort();
}

// 食品寄付配列をソート
function sortFoodDonationsArray(donations) {
  return donations.sort((a, b) => {
    let aVal = a[foodSortColumn];
    let bVal = b[foodSortColumn];
    
    // 日付の場合
    if (foodSortColumn === 'timestamp') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }
    
    // 文字列の場合
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (foodSortDirection === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });
}

// 食品寄付ソート適用
function applyFoodDonationSort() {
  if (!allFoodDonations || !Array.isArray(allFoodDonations)) return;
  
  const monthFilter = document.getElementById('foodMonthFilter').value;
  let filteredDonations = allFoodDonations;
  
  if (monthFilter) {
    filteredDonations = filteredDonations.filter(donation => {
      const donationDate = new Date(donation.timestamp);
      const donationMonth = donationDate.getFullYear() + '-' + String(donationDate.getMonth() + 1).padStart(2, '0');
      return donationMonth === monthFilter;
    });
  }
  
  // ソート適用
  filteredDonations = sortFoodDonationsArray(filteredDonations);
  
  const tbody = document.getElementById('foodDonationsList');
  if (filteredDonations.length > 0) {
    tbody.innerHTML = filteredDonations.map((donation, index) => `
      <tr>
        <td>${new Date(donation.timestamp).toLocaleDateString('ja-JP')}</td>
        <td>${escapeHtml(donation.siteName)}</td>
        <td>${escapeHtml(donation.nickname || donation.userId)}</td>
        <td>${escapeHtml(donation.donor || '-')}</td>
        <td>${escapeHtml(donation.itemName || '-')}</td>
        <td>${donation.webPublic === 'する' ? '公開' : '非公開'}</td>
        <td>
          ${donation.instagramUrl && donation.instagramUrl.trim() !== '' ? 
            `<a href="${donation.instagramUrl}" target="_blank" class="btn btn-sm btn-outline-success instagram-btn">投稿済</a>` :
            `<button class="btn btn-sm btn-primary instagram-btn" onclick="postToInstagram(${index})">投稿</button>`
          }
        </td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">データがありません</td></tr>';
  }
}

// 金銭寄付ソート用のグローバル変数
let moneySortColumn = 'timestamp';
let moneySortDirection = 'desc';

// 金銭寄付ソート関数
window.sortMoneyDonations = function(column) {
  if (moneySortColumn === column) {
    moneySortDirection = moneySortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    moneySortColumn = column;
    moneySortDirection = 'asc';
  }
  applyMoneyDonationSort();
}

// 金銭寄付配列をソート
function sortMoneyDonationsArray(donations) {
  return donations.sort((a, b) => {
    let aVal = a[moneySortColumn];
    let bVal = b[moneySortColumn];
    
    // 日付の場合
    if (moneySortColumn === 'timestamp') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }
    
    // 金額の場合
    if (moneySortColumn === 'amount') {
      aVal = parseInt(aVal) || 0;
      bVal = parseInt(bVal) || 0;
    }
    
    // 文字列の場合
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (moneySortDirection === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });
}

// 金銭寄付ソート適用
function applyMoneyDonationSort() {
  if (!allMoneyDonations || !Array.isArray(allMoneyDonations)) return;
  
  const monthFilter = document.getElementById('moneyMonthFilter').value;
  let filteredDonations = allMoneyDonations;
  
  if (monthFilter) {
    filteredDonations = filteredDonations.filter(donation => {
      const donationDate = new Date(donation.timestamp);
      const donationMonth = donationDate.getFullYear() + '-' + String(donationDate.getMonth() + 1).padStart(2, '0');
      return donationMonth === monthFilter;
    });
  }
  
  // ソート適用
  filteredDonations = sortMoneyDonationsArray(filteredDonations);
  
  const tbody = document.getElementById('moneyDonationsList');
  if (filteredDonations.length > 0) {
    tbody.innerHTML = filteredDonations.map(donation => `
      <tr>
        <td>${new Date(donation.timestamp).toLocaleDateString('ja-JP')}</td>
        <td>${escapeHtml(donation.siteName)}</td>
        <td>${escapeHtml(donation.nickname || donation.userId)}</td>
        <td>${escapeHtml(donation.donor || '-')}</td>
        <td>${donation.amount ? parseInt(donation.amount).toLocaleString().replace(/\\/g, '') + '円' : '-'}</td>
        <td>${donation.webPublic === 'する' ? '公開' : '非公開'}</td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">データがありません</td></tr>';
  }
}

// ユーザーソート用のグローバル変数
let userSortColumn = 'siteName';
let userSortDirection = 'asc';

// ユーザーソート関数
window.sortUsers = function(column) {
  if (userSortColumn === column) {
    userSortDirection = userSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    userSortColumn = column;
    userSortDirection = 'asc';
  }
  applyUserSort();
}

// ユーザー配列をソート
function sortUsersArray(users) {
  return users.sort((a, b) => {
    let aVal = a[userSortColumn];
    let bVal = b[userSortColumn];
    
    // registrationDateの場合
    if (userSortColumn === 'registrationDate') {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    }
    
    // 文字列の場合
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (userSortDirection === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });
}

// ユーザーソート適用
async function applyUserSort() {
  if (!allUsers || !Array.isArray(allUsers)) return;
  
  const sortedUsers = sortUsersArray([...allUsers]);
  const tbody = document.getElementById('usersList');
  
  if (sortedUsers.length > 0) {
    tbody.innerHTML = sortedUsers.map((user, index) => {
      const userId = user.userId || user['LINE ID'] || '';
      const currentSite = user.siteName || user['拠点名'] || '';
      return `
        <tr data-user-index="${index}">
          <td>
            <span class="site-display">${escapeHtml(currentSite)}</span>
            <select class="form-control form-control-sm site-select d-none" data-user-id="${escapeHtml(userId)}">
              <option value="">(拠点未選択)</option>
            </select>
          </td>
          <td>${escapeHtml(user.nickname || user['管理者名'] || '')}</td>
          <td>${escapeHtml(userId)}</td>
          <td>${user.registrationDate ? new Date(user.registrationDate).toLocaleDateString('ja-JP') : '-'}</td>
          <td>
            <button class="btn btn-sm btn-primary edit-user-btn" onclick="toggleUserEdit(this, ${index})">
              <i class="bi bi-pencil"></i> 変更
            </button>
            <button class="btn btn-sm btn-danger save-user-btn d-none" onclick="saveUserEdit(this, ${index})">
              <i class="bi bi-check"></i> 保存
            </button>
          </td>
        </tr>
      `;
    }).join('');
    
    // 拠点オプションを設定
    await populateUserSiteOptions();
  } else {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">データがありません</td></tr>';
  }
}

// ユーザー拠点選択肢を設定
async function populateUserSiteOptions() {
  try {
    const siteResult = await apiRequest('getSite?userId=admin');
    if (siteResult.success && siteResult.data) {
      const sites = siteResult.data.map(site => site['拠点名'] || site.siteName || site.name).filter(Boolean).sort();
      
      document.querySelectorAll('.site-select').forEach(select => {
        const userId = select.getAttribute('data-user-id');
        const user = allUsers.find(u => (u.userId || u['LINE ID']) === userId);
        const currentSite = user ? (user.siteName || user['拠点名'] || '') : '';
        
        // オプションをクリア
        select.innerHTML = '<option value="">(拠点未選択)</option>';
        
        // 拠点オプションを追加
        sites.forEach(site => {
          const option = document.createElement('option');
          option.value = site;
          option.textContent = site;
          if (site === currentSite) {
            option.selected = true;
          }
          select.appendChild(option);
        });
      });
    }
  } catch (error) {
    console.error('拠点データ取得エラー:', error);
  }
}

// 拠点ソート用のグローバル変数
let siteSortColumn = 'siteName';
let siteSortDirection = 'asc';

// 拠点ソート関数
window.sortSites = function(column) {
  if (siteSortColumn === column) {
    siteSortDirection = siteSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    siteSortColumn = column;
    siteSortDirection = 'asc';
  }
  applySiteSort();
}

// 拠点配列をソート
function sortSitesArray(sites) {
  return sites.sort((a, b) => {
    let aVal = a[siteSortColumn] || a['拠点名'] || a.siteName || a.name || '';
    let bVal = b[siteSortColumn] || b['拠点名'] || b.siteName || b.name || '';
    
    // 文字列の場合
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (siteSortDirection === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });
}

// 拠点ソート適用
function applySiteSort() {
  if (!allSites || !Array.isArray(allSites)) return;
  
  const sortedSites = sortSitesArray([...allSites]);
  const tbody = document.getElementById('sitesList');
  
  if (sortedSites.length > 0) {
    tbody.innerHTML = sortedSites.map((site, index) => {
      const siteName = site['拠点名'] || site.siteName || site.name || '';
      const website = site['web'] || site.webSite || site.website || '';
      const account = site['振込口座'] || site.transferDestination || site.account || '';
      
      return `
        <tr data-site-index="${index}">
          <td>
            <span class="site-name-display">${escapeHtml(siteName)}</span>
          </td>
          <td>
            <span class="website-display">${escapeHtml(website)}</span>
            <input type="text" class="form-control form-control-sm website-input d-none" value="${escapeHtml(website)}" 
                   data-field="webSite" data-site-name="${escapeHtml(siteName)}">
          </td>
          <td>
            <span class="account-display">${escapeHtml(account)}</span>
            <input type="text" class="form-control form-control-sm account-input d-none" value="${escapeHtml(account)}" 
                   data-field="transferDestination" data-site-name="${escapeHtml(siteName)}">
          </td>
          <td>
            <button class="btn btn-sm btn-primary edit-site-btn" onclick="toggleSiteEdit(this, ${index})">
              <i class="bi bi-pencil"></i> 変更
            </button>
            <button class="btn btn-sm btn-danger save-site-btn d-none" onclick="saveSiteEdit(this, ${index})">
              <i class="bi bi-check"></i> 保存
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">データがありません</td></tr>';
  }
}

// ログソート用のグローバル変数
let logSortColumn = 'timestamp';
let logSortDirection = 'desc';

// ログソート関数
window.sortLogs = function(column) {
  if (logSortColumn === column) {
    logSortDirection = logSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    logSortColumn = column;
    logSortDirection = 'asc';
  }
  applyLogSort();
}

// ログ配列をソート
function sortLogsArray(logs) {
  return logs.sort((a, b) => {
    let aVal = a[logSortColumn] || a.action;
    let bVal = b[logSortColumn] || b.action;
    
    // 日付の場合
    if (logSortColumn === 'timestamp') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }
    
    // タイプの場合
    if (logSortColumn === 'type') {
      aVal = a.type || a.action || '';
      bVal = b.type || b.action || '';
    }
    
    // 文字列の場合
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (logSortDirection === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });
}

// ログ統計更新
function updateLogStatistics() {
  const totalLogs = allLogs.length;
  const errorLogs = allLogs.filter(log => (log['種類'] || log.type) === 'ERROR').length;
  const warningLogs = allLogs.filter(log => (log['種類'] || log.type) === 'WARNING').length;
  const successLogs = allLogs.filter(log => (log['種類'] || log.type) === 'SUCCESS').length;
  
  document.getElementById('totalLogs').textContent = totalLogs;
  document.getElementById('errorLogs').textContent = errorLogs;
  document.getElementById('warningLogs').textContent = warningLogs;
  document.getElementById('successLogs').textContent = successLogs;
}

// ログフィルター適用
function applyLogFilters() {
  const typeFilter = document.getElementById('logTypeFilter').value;
  const categoryFilter = document.getElementById('logCategoryFilter').value;
  const dateFilter = parseInt(document.getElementById('logDateFilter').value);
  
  let filtered = [...allLogs];
  
  // 種類フィルター
  if (typeFilter) {
    filtered = filtered.filter(log => (log['種類'] || log.type) === typeFilter);
  }
  
  // カテゴリフィルター
  if (categoryFilter) {
    filtered = filtered.filter(log => (log['カテゴリ'] || log.category) === categoryFilter);
  }
  
  // 日付フィルター
  if (dateFilter) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - dateFilter);
    
    filtered = filtered.filter(log => {
      const logDate = new Date(log['タイムスタンプ'] || log.timestamp);
      return logDate >= targetDate;
    });
  }
  
  filteredLogs = filtered;
  console.log('Applying filters:', { typeFilter, categoryFilter, dateFilter });
  console.log('Filtered logs result:', filteredLogs);
  currentLogPage = 1;
  renderLogTable();
  updateLogPagination();
}

// ログフィルタークリア
function clearLogFilters() {
  document.getElementById('logTypeFilter').value = '';
  document.getElementById('logCategoryFilter').value = '';
  document.getElementById('logDateFilter').value = '30';
  applyLogFilters();
}

// ログテーブル描画
function renderLogTable() {
  const tbody = document.getElementById('logsList');
  const startIndex = (currentLogPage - 1) * logsPerPage;
  const endIndex = startIndex + logsPerPage;
  const pageData = filteredLogs.slice(startIndex, endIndex);
  
  console.log('Rendering table:', { 
    totalFiltered: filteredLogs.length, 
    currentPage: currentLogPage, 
    startIndex, 
    endIndex, 
    pageDataLength: pageData.length,
    pageData: pageData 
  });
  
  if (pageData.length > 0) {
    tbody.innerHTML = pageData.map(log => {
      const timestamp = new Date(log['タイムスタンプ'] || log.timestamp).toLocaleString('ja-JP');
      const type = log['種類'] || log.type || '';
      const category = log['カテゴリ'] || log.category || '';
      const details = log['詳細'] || log.details || log.message || '';
      
      const typeClass = getLogTypeClass(type);
      
      return `
        <tr>
          <td>${timestamp}</td>
          <td><span class="badge ${typeClass}">${escapeHtml(type)}</span></td>
          <td>${escapeHtml(category)}</td>
          <td>${escapeHtml(details)}</td>
        </tr>
      `;
    }).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">データがありません</td></tr>';
  }
}

// ログタイプのCSSクラス取得
function getLogTypeClass(type) {
  switch (type) {
    case 'SUCCESS': return 'bg-success';
    case 'ERROR': return 'bg-danger';
    case 'WARNING': return 'bg-warning text-dark';
    case 'INFO': return 'bg-info';
    case 'DEBUG': return 'bg-secondary';
    default: return 'bg-light text-dark';
  }
}

// ログページネーション更新
function updateLogPagination() {
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const startIndex = (currentLogPage - 1) * logsPerPage + 1;
  const endIndex = Math.min(currentLogPage * logsPerPage, filteredLogs.length);
  
  document.getElementById('logPageNumber').textContent = currentLogPage;
  document.getElementById('logPageInfo').textContent = 
    `${startIndex}-${endIndex} / ${filteredLogs.length}件`;
  
  const prevPage = document.getElementById('logPrevPage');
  const nextPage = document.getElementById('logNextPage');
  
  if (currentLogPage <= 1) {
    prevPage.classList.add('disabled');
  } else {
    prevPage.classList.remove('disabled');
  }
  
  if (currentLogPage >= totalPages) {
    nextPage.classList.add('disabled');
  } else {
    nextPage.classList.remove('disabled');
  }
}

// ログページ変更
function changeLogPage(page) {
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
  
  if (page >= 1 && page <= totalPages) {
    currentLogPage = page;
    renderLogTable();
    updateLogPagination();
  }
}

// ログソート
function sortLogs(column) {
  if (window.sortColumn === column) {
    window.sortDirection = window.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    window.sortColumn = column;
    window.sortDirection = 'desc';
  }
  
  filteredLogs.sort((a, b) => {
    let aVal, bVal;
    
    switch (column) {
      case 'timestamp':
        aVal = new Date(a['タイムスタンプ'] || a.timestamp);
        bVal = new Date(b['タイムスタンプ'] || b.timestamp);
        break;
      case 'type':
        aVal = a['種類'] || a.type || '';
        bVal = b['種類'] || b.type || '';
        break;
      case 'category':
        aVal = a['カテゴリ'] || a.category || '';
        bVal = b['カテゴリ'] || b.category || '';
        break;
      default:
        return 0;
    }
    
    if (aVal < bVal) return window.sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return window.sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  
  renderLogTable();
}

// 古いユーザー編集機能（削除済み、プルダウンに変更）

// ユーザーの拠点更新
async function updateUserSite(userId, newSiteName) {
  console.log('ユーザー拠点更新開始:', { userId, newSiteName });
  
  // 複数のAPIパターンを試す
  let result;
  let lastError = null;
  
  // パターン1: updateUserSite
  try {
    result = await apiRequest('updateUserSite', 'POST', {
      action: 'updateUserSite',
      userId: userId,
      siteName: newSiteName
    });
    console.log('updateUserSite結果:', result);
    if (result.success) {
      return await handleUserUpdateSuccess(userId, newSiteName);
    }
  } catch (error) {
    console.log('updateUserSite失敗:', error.message);
    lastError = error;
  }
  
  // パターン2: updateUser
  try {
    result = await apiRequest('updateUser', 'POST', {
      action: 'updateUser',
      userId: userId,
      siteName: newSiteName
    });
    console.log('updateUser結果:', result);
    if (result.success) {
      return await handleUserUpdateSuccess(userId, newSiteName);
    }
  } catch (error) {
    console.log('updateUser失敗:', error.message);
    lastError = error;
  }
  
  // パターン3: userUpdate
  try {
    result = await apiRequest('userUpdate', 'POST', {
      action: 'userUpdate',
      userId: userId,
      siteName: newSiteName
    });
    console.log('userUpdate結果:', result);
    if (result.success) {
      return await handleUserUpdateSuccess(userId, newSiteName);
    }
  } catch (error) {
    console.log('userUpdate失敗:', error.message);
    lastError = error;
  }
  
  // すべて失敗した場合
  console.error('全パターン失敗。GASバックエンドにユーザー拠点更新APIが未実装の可能性');
  throw new Error('GASバックエンドエラー: ユーザー拠点更新API未実装。管理者にGASの拡張が必要です。');
}

// ユーザー更新成功時の処理
async function handleUserUpdateSuccess(userId, newSiteName) {
  console.log('ユーザー拠点更新成功');
  // ローカルデータを更新
  const user = allUsers.find(u => u.userId === userId || u['LINE ID'] === userId);
  if (user) {
    user.siteName = newSiteName;
    user['拠点名'] = newSiteName;
  }
  return true;
}

// ユーザー編集モード切り替え
function toggleUserEdit(button, userIndex) {
  const row = button.closest('tr');
  const siteDisplay = row.querySelector('.site-display');
  const siteSelect = row.querySelector('.site-select');
  const editBtn = row.querySelector('.edit-user-btn');
  const saveBtn = row.querySelector('.save-user-btn');
  
  // 編集モードに切り替え
  siteDisplay.classList.add('d-none');
  siteSelect.classList.remove('d-none');
  siteSelect.style.border = '2px solid #007bff';
  
  // ボタンを切り替え
  editBtn.classList.add('d-none');
  saveBtn.classList.remove('d-none');
}

// ユーザー編集保存
async function saveUserEdit(button, userIndex) {
  const row = button.closest('tr');
  const siteDisplay = row.querySelector('.site-display');
  const siteSelect = row.querySelector('.site-select');
  const editBtn = row.querySelector('.edit-user-btn');
  const saveBtn = row.querySelector('.save-user-btn');
  
  const userId = siteSelect.getAttribute('data-user-id');
  const newSiteName = siteSelect.value;
  
  try {
    // データを更新
    await updateUserSite(userId, newSiteName);
    
    // 表示を更新
    siteDisplay.textContent = newSiteName || '(拠点未選択)';
    
    // 編集モードを終了
    siteDisplay.classList.remove('d-none');
    siteSelect.classList.add('d-none');
    siteSelect.style.border = '1px solid #ced4da';
    
    // ボタンを切り替え
    editBtn.classList.remove('d-none');
    saveBtn.classList.add('d-none');
    
    // テーブル表示を更新
    await applyUserSort();
    
    showSuccess('ユーザー拠点をGoogle Sheetsに保存しました');
  } catch (error) {
    console.error('ユーザー拠点更新エラー:', error);
    showError('拠点変更に失敗しました: ' + error.message);
  }
}

// 拠点編集モード切り替え
function toggleSiteEdit(button, siteIndex) {
  const row = button.closest('tr');
  const websiteDisplay = row.querySelector('.website-display');
  const accountDisplay = row.querySelector('.account-display');
  const websiteInput = row.querySelector('.website-input');
  const accountInput = row.querySelector('.account-input');
  const editBtn = row.querySelector('.edit-site-btn');
  const saveBtn = row.querySelector('.save-site-btn');
  
  // 編集モードに切り替え
  websiteDisplay.classList.add('d-none');
  accountDisplay.classList.add('d-none');
  
  websiteInput.classList.remove('d-none');
  websiteInput.style.border = '2px solid #007bff';
  
  accountInput.classList.remove('d-none');
  accountInput.style.border = '2px solid #007bff';
  
  // ボタンを切り替え
  editBtn.classList.add('d-none');
  saveBtn.classList.remove('d-none');
}

// 拠点編集保存
async function saveSiteEdit(button, siteIndex) {
  const row = button.closest('tr');
  const websiteDisplay = row.querySelector('.website-display');
  const accountDisplay = row.querySelector('.account-display');
  const websiteInput = row.querySelector('.website-input');
  const accountInput = row.querySelector('.account-input');
  const editBtn = row.querySelector('.edit-site-btn');
  const saveBtn = row.querySelector('.save-site-btn');
  
  const siteName = websiteInput.getAttribute('data-site-name');
  const websiteValue = websiteInput.value.trim();
  const accountValue = accountInput.value.trim();
  
  try {
    // 更新が必要なフィールドのみ更新
    const updatePromises = [];
    
    // 現在の値と比較して変更があった場合のみ更新
    if (websiteDisplay.textContent !== websiteValue) {
      updatePromises.push(updateSiteField(siteName, 'webSite', websiteValue));
    }
    
    if (accountDisplay.textContent !== accountValue) {
      updatePromises.push(updateSiteField(siteName, 'transferDestination', accountValue));
    }
    
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }
    
    // 表示を更新
    websiteDisplay.textContent = websiteValue;
    accountDisplay.textContent = accountValue;
    
    // 編集モードを終了
    websiteDisplay.classList.remove('d-none');
    accountDisplay.classList.remove('d-none');
    
    websiteInput.classList.add('d-none');
    websiteInput.style.border = '1px solid #ced4da';
    
    accountInput.classList.add('d-none');
    accountInput.style.border = '1px solid #ced4da';
    
    // ボタンを切り替え
    editBtn.classList.remove('d-none');
    saveBtn.classList.add('d-none');
    
    // 単一の成功メッセージ
    if (updatePromises.length > 0) {
      showSuccess('拠点情報を更新しました');
    } else {
      showInfo('変更はありませんでした');
    }
  } catch (error) {
    showError('保存に失敗しました: ' + error.message);
  }
}

// 拠点フィールド更新（メッセージ表示なし版）
async function updateSiteField(siteName, field, value) {
  const result = await apiRequest('updateSite', 'POST', {
    action: 'updateSite',
    siteName: siteName,
    field: field,
    value: value
  });
  
  if (!result.success) {
    throw new Error(result.error || '更新に失敗しました');
  }
  
  return result;
}

// バックアップ管理機能
let allBackups = [];

// バックアップページ読み込み
async function loadBackup() {
  showBackupLoading(true);
  
  try {
    await refreshBackupList();
    showBackupLoading(false);
  } catch (error) {
    showBackupError('バックアップデータの読み込みに失敗しました: ' + error.message);
    showBackupLoading(false);
  }
}

// バックアップ一覧更新
async function refreshBackupList() {
  try {
    showBackupLoading(true);
    
    // バックアップ一覧を取得
    const result = await apiRequest('getBackupList', 'GET');
    
    if (result.success) {
      allBackups = result.backups || [];
      updateBackupStatistics();
      renderBackupTable();
      
      document.getElementById('backupTable').style.display = 'table';
    } else {
      throw new Error(result.message || 'バックアップ一覧の取得に失敗しました');
    }
    
  } catch (error) {
    showBackupError('バックアップ一覧の取得に失敗しました: ' + error.message);
  } finally {
    showBackupLoading(false);
  }
}

// バックアップ統計更新
function updateBackupStatistics() {
  // 最新バックアップ
  const latestBackup = allBackups.length > 0 ? 
    new Date(allBackups[0].created).toLocaleDateString('ja-JP') : '未作成';
  document.getElementById('latestBackup').textContent = latestBackup;
  
  // バックアップ総数
  document.getElementById('totalBackups').textContent = allBackups.length;
  
  // 自動バックアップ状態（仮実装）
  document.getElementById('autoBackupStatus').textContent = '有効';
  
  // 使用容量
  const totalSize = allBackups.reduce((sum, backup) => sum + (backup.size || 0), 0);
  const sizeText = totalSize > 1024 * 1024 ? 
    (totalSize / (1024 * 1024)).toFixed(1) + ' MB' : 
    (totalSize / 1024).toFixed(1) + ' KB';
  document.getElementById('backupSize').textContent = sizeText;
}

// バックアップテーブル表示
function renderBackupTable() {
  const tbody = document.getElementById('backupList');
  
  if (allBackups.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">バックアップファイルがありません</td></tr>';
    return;
  }
  
  tbody.innerHTML = allBackups.map(backup => {
    const created = new Date(backup.created);
    const sizeText = backup.size > 1024 * 1024 ? 
      (backup.size / (1024 * 1024)).toFixed(1) + ' MB' : 
      (backup.size / 1024).toFixed(1) + ' KB';
    
    const fileType = backup.name.endsWith('.json') ? 'JSON' : 'スプレッドシート';
    const typeClass = backup.name.endsWith('.json') ? 'text-info' : 'text-primary';
    
    return `
      <tr>
        <td>${created.toLocaleString('ja-JP')}</td>
        <td>${escapeHtml(backup.name)}</td>
        <td>${sizeText}</td>
        <td><span class="${typeClass}">${fileType}</span></td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="downloadBackup('${backup.id}', '${escapeHtml(backup.name)}')">
            <i class="bi bi-download"></i>
          </button>
          <button class="btn btn-sm btn-outline-warning me-1" onclick="confirmRestore('${backup.id}', '${escapeHtml(backup.name)}')" 
                  ${fileType === 'JSON' ? 'disabled title="JSON形式は復元できません"' : ''}>
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteBackup('${backup.id}', '${escapeHtml(backup.name)}')">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// 手動バックアップ作成
async function createManualBackup() {
  const button = event.target;
  const originalText = button.innerHTML;
  
  try {
    button.disabled = true;
    button.innerHTML = '<i class="bi bi-hourglass-split"></i> 作成中...';
    
    const result = await apiRequest('manualBackup', 'POST', {
      action: 'manualBackup'
    });
    
    if (result.success) {
      showSuccess('手動バックアップが作成されました');
      await refreshBackupList();
    } else {
      throw new Error(result.message || 'バックアップの作成に失敗しました');
    }
    
  } catch (error) {
    showError('バックアップの作成に失敗しました: ' + error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = originalText;
  }
}

// 自動バックアップ設定
async function setupAutoBackup() {
  const button = event.target;
  const originalText = button.innerHTML;
  
  try {
    button.disabled = true;
    button.innerHTML = '<i class="bi bi-hourglass-split"></i> 設定中...';
    
    const result = await apiRequest('setupBackupTrigger', 'POST', {
      action: 'setupBackupTrigger'
    });
    
    if (result.success) {
      showSuccess('自動バックアップが設定されました（毎日午前2時に実行）');
      document.getElementById('autoBackupStatus').textContent = '有効';
    } else {
      throw new Error(result.message || '自動バックアップの設定に失敗しました');
    }
    
  } catch (error) {
    showError('自動バックアップの設定に失敗しました: ' + error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = originalText;
  }
}

// バックアップダウンロード
function downloadBackup(backupId, fileName) {
  // Google DriveのダウンロードURL
  const downloadUrl = `https://drive.google.com/uc?id=${backupId}&export=download`;
  
  // 新しいタブでダウンロード
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showSuccess(`${fileName} のダウンロードを開始しました`);
}

// 復元確認
function confirmRestore(backupId, fileName) {
  if (confirm(`${fileName} からデータを復元しますか？\n\n⚠️ 現在のデータは上書きされます。この操作は元に戻せません。`)) {
    restoreFromBackup(backupId, fileName);
  }
}

// バックアップから復元
async function restoreFromBackup(backupId, fileName) {
  try {
    const result = await apiRequest('restoreFromBackup', 'POST', {
      action: 'restoreFromBackup',
      backupFileId: backupId
    });
    
    if (result.success) {
      showSuccess(`${fileName} からの復元が完了しました`);
      // データ再読み込み
      if (currentSection === 'reports') {
        loadReports();
      }
    } else {
      throw new Error(result.message || '復元に失敗しました');
    }
    
  } catch (error) {
    showError(`復元に失敗しました: ${error.message}`);
  }
}

// バックアップ削除確認
function confirmDeleteBackup(backupId, fileName) {
  if (confirm(`${fileName} を削除しますか？\n\nこの操作は元に戻せません。`)) {
    deleteBackup(backupId, fileName);
  }
}

// バックアップ削除
async function deleteBackup(backupId, fileName) {
  try {
    // Google Driveファイル削除のAPIが必要（GAS側で実装）
    const result = await apiRequest('deleteBackup', 'POST', {
      action: 'deleteBackup',
      backupFileId: backupId
    });
    
    if (result.success) {
      showSuccess(`${fileName} を削除しました`);
      await refreshBackupList();
    } else {
      throw new Error(result.message || '削除に失敗しました');
    }
    
  } catch (error) {
    showError(`削除に失敗しました: ${error.message}`);
  }
}

// バックアップローディング表示
function showBackupLoading(show) {
  const loading = document.getElementById('backupLoading');
  const table = document.getElementById('backupTable');
  const error = document.getElementById('backupError');
  
  if (show) {
    loading.style.display = 'block';
    table.style.display = 'none';
    error.style.display = 'none';
  } else {
    loading.style.display = 'none';
  }
}

// バックアップエラー表示
function showBackupError(message) {
  const loading = document.getElementById('backupLoading');
  const table = document.getElementById('backupTable');
  const error = document.getElementById('backupError');
  
  loading.style.display = 'none';
  table.style.display = 'none';
  error.textContent = message;
  error.style.display = 'block';
}

// グローバル関数として設定
window.loadBackup = loadBackup;
window.refreshBackupList = refreshBackupList;
window.createManualBackup = createManualBackup;
window.setupAutoBackup = setupAutoBackup;
window.downloadBackup = downloadBackup;
window.confirmRestore = confirmRestore;
