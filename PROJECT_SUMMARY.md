# API Server (Project②) — 詳細まとめ

## 📌 プロジェクト概要

**名称**: API Foundation (Project②)  
**役割**: プロジェクト①③④⑤が使用する統一 REST API 基盤  
**言語**: Node.js + Express.js  
**データベース**: Supabase (PostgreSQL)  
**デプロイ**: Render (https://api-server-7e7j.onrender.com)  

---

## 🎯 プロジェクトの目的

### 背景
各プロジェクトが Supabase に直接接続すると、以下の問題が発生：
- セキュリティ: クライアント側に Supabase キーが露出
- 一貫性: レスポンス形式がバラバラ
- 保守性: ビジネスロジックの変更が複数箇所に影響

### 解決策
**API Server**を中間層として導入し、以下を実現：
- ✅ JWT 認証による統一認証
- ✅ レスポンス形式の標準化
- ✅ ビジネスロジック一元管理
- ✅ 監査ログ（task_events）の記録

---

## 🏗️ アーキテクチャ

### レイヤー構成（4層分離）

```
┌─────────────────────────────────┐
│      Client (Frontend)          │
│  portfolio-site / Project③④⑤  │
└────────────────┬────────────────┘
                 │ REST API (HTTP/JSON)
┌─────────────────▼────────────────┐
│      Express.js (Router)         │
│  src/routes/tasks.js             │
│  src/routes/auth.js              │
│  src/routes/dashboard.js         │
└────────────────┬────────────────┘
                 │ async/await
┌─────────────────▼────────────────┐
│    Controllers (Validation)      │
│  src/controllers/taskController  │
│  src/controllers/authController  │
└────────────────┬────────────────┘
                 │ try/catch
┌─────────────────▼────────────────┐
│    Services (Business Logic)     │
│  src/services/taskService        │
│  src/services/authService        │
│  src/services/dashboardService   │
└────────────────┬────────────────┘
                 │ Supabase client
┌─────────────────▼────────────────┐
│   Supabase PostgreSQL            │
│  - users                         │
│  - tasks                         │
│  - task_statuses                 │
│  - task_events                   │
└─────────────────────────────────┘
```

### ファイル構成

```
api-server/
├── index.js                          # Express app + middleware setup
├── package.json                      # Dependencies
├── .env                              # 環境変数（.gitignore）
├── .env.example                      # テンプレート
├── swagger.json                      # OpenAPI 3.0.0 仕様
├── src/
│   ├── middleware/
│   │   ├── auth.middleware.js       # JWT 検証
│   │   ├── errorHandler.js          # エラー統一処理
│   │   └── requestLogger.js         # リクエスト/レスポンスログ
│   ├── routes/
│   │   ├── tasks.js                 # GET/POST /api/tasks
│   │   ├── auth.js                  # POST /api/auth/login
│   │   └── dashboard.js             # GET /api/dashboard/stats
│   ├── controllers/
│   │   ├── taskController.js        # getTasks, createTask, updateStatus
│   │   ├── authController.js        # login, refreshToken
│   │   └── dashboardController.js   # getStats
│   ├── services/
│   │   ├── taskService.js           # Supabase task CRUD
│   │   ├── authService.js           # JWT生成・検証
│   │   └── dashboardService.js      # 統計計算（修正済み）
│   └── utils/
│       └── response.js              # APIResponse クラス
└── .github/workflows/
    └── ci-cd.yml                     # GitHub Actions
```

---

## 🔑 主な機能

### 1️⃣ タスク管理 (Task API)

| Method | Path | Auth | 説明 |
|--------|------|------|------|
| GET | `/api/tasks` | ✗ | タスク一覧（ペーション対応） |
| GET | `/api/tasks/:task_id` | ✗ | タスク詳細 + 履歴 |
| POST | `/api/tasks` | ✓ | タスク作成 |
| PATCH | `/api/tasks/:task_id/status` | ✓ | ステータス更新 |

**レスポンス例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "title": "Dashboard実装",
      "description": "メインダッシュボード",
      "current_status_id": "uuid-status",
      "task_statuses": {
        "id": "uuid-status",
        "name": "進行中",
        "code": "in-progress",
        "is_terminal": false
      },
      "assigned_to": "alice@example.com",
      "due_date": "2026-05-15",
      "created_at": "2026-04-18T10:00:00Z",
      "updated_at": "2026-05-09T05:20:00Z",
      "closed_at": null
    }
  ],
  "meta": {
    "timestamp": "2026-05-09T05:22:00Z",
    "pagination": {
      "total_count": 50,
      "limit": 10,
      "offset": 0,
      "page": 1
    }
  }
}
```

### 2️⃣ 認証 (Auth API)

| Method | Path | 説明 |
|--------|------|------|
| POST | `/api/auth/login` | Email ベースログイン（JWT 発行） |
| POST | `/api/auth/refresh` | トークンリフレッシュ |

**トークン仕様**:
- **Access Token**: 7 日有効（API 呼び出し用）
- **Refresh Token**: 30 日有効（新 Access Token 取得用）

### 3️⃣ ダッシュボード統計 (Dashboard API)

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/dashboard/stats` | 統計データ（完了率、平均リードタイム等） |

**レスポンス例**:
```json
{
  "success": true,
  "data": {
    "total_tasks": 50,
    "completed_tasks": 30,
    "completion_rate": "60.0",
    "average_lead_time_days": "3.5",
    "tasks_by_status": {
      "未着手": 10,
      "進行中": 8,
      "完了": 30,
      "アーカイブ": 2
    }
  }
}
```

### 4️⃣ ヘルスチェック

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/health` | サーバー稼働状態確認 |

---

## 🗄️ データベーススキーマ

### users テーブル
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP
);
```

### task_statuses テーブル（ステータス定義）
```sql
CREATE TABLE task_statuses (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE,        -- "pending", "in-progress", "completed"
  name TEXT,               -- "未着手", "進行中", "完了"
  sort_order INTEGER,      -- 並び順
  is_terminal BOOLEAN,     -- true: 終了状態
  color TEXT               -- UI用カラーコード
);
```

### tasks テーブル
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  current_status_id UUID REFERENCES task_statuses(id),
  assigned_to TEXT,
  due_date DATE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  closed_at TIMESTAMP,
  is_deleted BOOLEAN DEFAULT false
);
```

### task_events テーブル（監査ログ）
```sql
CREATE TABLE task_events (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id),
  from_status_id UUID REFERENCES task_statuses(id),
  to_status_id UUID REFERENCES task_statuses(id),
  changed_by TEXT,
  occurred_at TIMESTAMP
);
```

---

## 🔄 レスポンス形式（統一）

すべてのエンドポイントは同じ形式でレスポンス：

**成功時**:
```json
{
  "success": true,
  "data": { /* 実データ */ },
  "meta": {
    "timestamp": "ISO-8601",
    "pagination": { /* オプション */ }
  },
  "error": null
}
```

**エラー時**:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "details": {}
  },
  "meta": { "timestamp": "ISO-8601" }
}
```

---

## 🚀 デプロイメント

### 本番環境（Render）

**URL**: https://api-server-7e7j.onrender.com  
**自動デプロイ**: GitHub main branch への push で自動ビルド・デプロイ  
**デプロイ時間**: 1-2 分

### 環境変数（Render ダッシュボードで設定）

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<your-supabase-key>
JWT_SECRET=<your-jwt-secret>
JWT_REFRESH_SECRET=<your-jwt-refresh-secret>
PORT=3000
```

### ローカル開発

```bash
# インストール
npm install

# 開発サーバー起動（ポート 3000）
npm run dev

# 本番サーバー起動
npm start

# Swagger UI（ローカル）
http://localhost:3000/api-docs
```

---

## 🔧 テスト方法

### 1. ログイン
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com"}' \
  | jq -r '.data.access_token')

echo $TOKEN
```

### 2. タスク一覧取得
```bash
curl http://localhost:3000/api/tasks | jq .
```

### 3. タスク作成（認証必須）
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"New Task","description":"Description"}'
```

### 4. ダッシュボード統計
```bash
curl http://localhost:3000/api/dashboard/stats | jq .
```

### 5. ヘルスチェック
```bash
curl http://localhost:3000/api/health | jq .
```

---

## 📝 最近の修正（2026-05-09）

### 問題
ダッシュボード統計エンドポイント (`GET /api/dashboard/stats`) が Internal Error を返していた。

### 原因
`dashboardService.js` が Supabase クエリでリレーション結合を含めていなかったため、`task_statuses` が `null` になり、`is_terminal` の判定に失敗。

### 修正内容
```javascript
// 修正前
const { data: tasks, count } = await supabase
  .from('tasks')
  .select('*', { count: 'exact' })  // ← リレーション結合がない
  .eq('is_deleted', false);

// 修正後
const { data: tasks, count } = await supabase
  .from('tasks')
  .select('*, task_statuses(id, is_terminal)', { count: 'exact' })  // ← 追加
  .eq('is_deleted', false);
```

### デプロイ
```
commit: 84db5fe fix: Add task_statuses relationship to dashboard query
デプロイ: Render 自動デプロイ完了
```

---

## 🔮 今後の実装予定

### 短期（1-2週間）
- [ ] **テストデータ投入** — ユーザー、ステータス、タスク作成
- [ ] **Project① 統合テスト** — portfolio-site ダッシュボードで実データ表示確認
- [ ] **CORS 設定見直し** — Project③④⑤ のドメイン追加

### 中期（1ヶ月）
- [ ] **Rate Limiting** — `express-rate-limit` 導入（DoS 対策）
- [ ] **ロール管理（RBAC）** — admin/editor/viewer
- [ ] **入力検証** — joi/zod による堅牢なバリデーション
- [ ] **テストスイート** — Jest/Mocha による単体・統合テスト

### 長期
- [ ] **Webhook サポート** — ステータス変更時に外部サービスに通知
- [ ] **GraphQL レイヤー** — Project③ 知識DB向け
- [ ] **WebSocket リアルタイム** — 複数ユーザー同時操作対応
- [ ] **キャッシング** — Redis による パフォーマンス向上

---

## 🔗 統合状況

### Project① — portfolio-site（業務ログダッシュボード）
**状態**: ✅ API Server 統合済み

- `src/pages/project-01/index.astro` で `PUBLIC_API_SERVER_URL` から tasks・stats を取得
- ダッシュボード表示のデータソース: `/api/tasks` + `/api/dashboard/stats`

**次**: テストデータ投入後、ダッシュボード表示確認

### Project③ — knowledge-db-web（検索AI）
**状態**: ⏳ 計画中

### Project④ — operational-analytics-system（データ分析）
**状態**: ⏳ 計画中

### Project⑤ — decision-log-system（判断ログ）
**状態**: ⏳ 計画中

---

## 📊 パフォーマンス指標

**ヘルスチェック**: ✅ 正常稼働
- レスポンス時間: ~11ms
- アップタイム: 安定稼働中

**API Server 本番**:
- Render: https://api-server-7e7j.onrender.com
- Supabase: babpqrypkqmivqujgeyy.supabase.co
- GitHub: https://github.com/yukilabs-core/api-server

---

## 🎓 開発ガイドライン

### 新しいエンドポイント追加手順

1. **Service** に メソッド追加 (`src/services/`)
2. **Controller** で バリデーション + Service呼び出し (`src/controllers/`)
3. **Route** に ルーティング追加 (`src/routes/`)
4. **Swagger** に エンドポイント定義追加 (`swagger.json`)
5. **テスト** — curl または Swagger UI で動作確認
6. **Git** — コミット＆プッシュ（自動デプロイ）

### エラーハンドリング

すべてのエラーは `APIResponse.error()` で統一：

```javascript
try {
  const result = await service.doSomething();
  res.json(APIResponse.success(result));
} catch (err) {
  errorHandler(err, req, res);
}
```

### JWT 認証

`authMiddleware` で保護:

```javascript
router.post('/api/protected-endpoint', authMiddleware, controller.method.bind(controller));
```

---

## 📞 トラブルシューティング

| 症状 | 原因 | 解決方法 |
|------|------|--------|
| 401 Unauthorized | JWT 期限切れ | `/api/auth/refresh` で新トークン取得 |
| 500 Internal Error | Supabase 接続失敗 | .env 確認、SUPABASE_KEY 有効性確認 |
| CORS エラー | オリジン許可なし | `index.js` の CORS 設定を更新 |
| タスク取得 0 件 | テストデータなし | Supabase にテストデータ投入 |

---

**最終更新**: 2026-05-09  
**リポジトリ**: https://github.com/yukilabs-core/api-server  
**デプロイ**: https://api-server-7e7j.onrender.com
