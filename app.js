// メインアプリケーション
let currentSection = 'reports';
let allReports = [];
let allFoodDonations = [];
let allMoneyDonations = [];
let allLogs = [];
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
        <td>大人:${report.adults} 子:${report.children}</td>
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
  
  loading.style.display = 'block';
  errorMsg.style.display = 'none';
  table.style.display = 'none';
  
  try {
    const result = await apiRequest('getLogs');
    
    if (result.success || result.data) {
      allLogs = result.data || result.logs || [];
      applyLogSort();
      
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
async function changeReportStatus(selectElement, reportIndex) {
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
      
      showSuccess(`ステータスを「${newStatus}」に更新しました`);
    } else {
      throw new Error(result.error || '更新に失敗しました');
    }
  } catch (error) {
    showError('更新に失敗しました: ' + error.message);
    // エラー時は元の値に戻す
    selectElement.value = originalStatus;
  }
}

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

// ログソート適用
function applyLogSort() {
  if (!allLogs || !Array.isArray(allLogs)) return;
  
  const sortedLogs = sortLogsArray([...allLogs]);
  const tbody = document.getElementById('logsList');
  
  if (sortedLogs.length > 0) {
    tbody.innerHTML = sortedLogs.slice(0, 100).map(log => `
      <tr>
        <td>${new Date(log.timestamp).toLocaleString('ja-JP')}</td>
        <td>${escapeHtml(log.type || log.action)}</td>
        <td>${escapeHtml(log.details || log.message)}</td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center">データがありません</td></tr>';
  }
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