# API Foundation - Project②

統一 REST API 基盤。プロジェクト①③④⑤が使用する共有バックエンド層。

## Quick Start

### Local Development

```bash
npm install
npm run dev
```

ブラウザで http://localhost:3000/api-docs を開いて Swagger UI を確認。

### API テスト

#### ログイン
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com"}'
```

レスポンス:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc...",
    "user": { "id": "uuid", "name": "Alice", "email": "alice@example.com" }
  }
}
```

#### タスク一覧取得
```bash
curl http://localhost:3000/api/tasks
```

#### タスク作成（認証必須）
```bash
TOKEN=<access_token>
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"New Task","description":"Description here"}'
```

#### ダッシュボード統計
```bash
curl http://localhost:3000/api/dashboard/stats
```

#### ヘルスチェック
```bash
curl http://localhost:3000/api/health
```

## Architecture

```
【Routing Layer】
   ↓
【Controller Layer】 (Business Logic)
   ↓
【Service Layer】 (Data Access)
   ↓
【Supabase PostgreSQL】
```

### Middleware

- **auth.middleware.js** — JWT 検証、`req.user` に格納
- **errorHandler.js** — 統一エラーハンドリング
- **requestLogger.js** — リクエスト/レスポンスログ

### Services

- **taskService** — タスク CRUD、ステータス更新
- **dashboardService** — 統計集計（完了率、平均リードタイム等）
- **authService** — JWT 生成、トークンリフレッシュ

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tasks` | ✗ | タスク一覧（ペーション対応） |
| GET | `/api/tasks/:task_id` | ✗ | タスク詳細 |
| POST | `/api/tasks` | ✓ | タスク作成 |
| PATCH | `/api/tasks/:task_id/status` | ✓ | ステータス更新 |
| POST | `/api/auth/login` | ✗ | ログイン（JWT 発行） |
| POST | `/api/auth/refresh` | ✗ | トークンリフレッシュ |
| GET | `/api/dashboard/stats` | ✗ | ダッシュボード統計 |
| GET | `/api/health` | ✗ | ヘルスチェック |

## Environment Variables

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=service_role_key_here
JWT_SECRET=long_random_string
JWT_REFRESH_SECRET=long_random_string
PORT=3000
```

`.env` は Git に含まれない（.gitignore で除外）。

## Response Format

**Success:**
```json
{
  "success": true,
  "data": {...},
  "meta": {
    "timestamp": "2026-04-18T13:00:00Z",
    "pagination": { "total_count": 50, "limit": 10, "offset": 0, "page": 1 }
  },
  "error": null
}
```

**Error:**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "details": {}
  },
  "meta": { "timestamp": "2026-04-18T13:00:00Z" }
}
```

## Authentication Flow

```
ユーザー
  ↓ POST /api/auth/login { email }
API Server
  ↓ users テーブル確認
  ↓ JWT 生成（access + refresh）
  ↓
トークン取得 → Authorization: Bearer <access_token> で保護エンドポイント呼び出し
```

**Token Lifespan:**
- Access Token: 7日
- Refresh Token: 30日

## Deployment to Render

1. **GitHub リポジトリ作成**
   ```bash
   git remote set-url origin git@github.com:yukilabs-core/api-server.git
   git push -u origin main
   ```

2. **Render ダッシュボード**
   - Web Service 作成
   - GitHub リポジトリ選択: `yukilabs-core/api-server`
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **環境変数設定**
   - Render > Environment タブで以下を設定:
     - `SUPABASE_URL`
     - `SUPABASE_KEY` (service role)
     - `JWT_SECRET`
     - `JWT_REFRESH_SECRET`
     - `PORT` (optional, default 3000)

4. **デプロイ確認**
   - https://api-server.onrender.com/api/health にアクセス
   - https://api-server.onrender.com/api-docs で Swagger UI

## Integration with Project①

`src/pages/project-01/index.astro` を修正して、API Server を呼び出すように変更:

```javascript
const taskResponse = await fetch('https://api-server.onrender.com/api/tasks');
const { data: tasks } = await taskResponse.json();
```

## Database Schema

```sql
-- Users (認証用)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP
);

-- Task Statuses (ステータス定義)
CREATE TABLE task_statuses (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT,
  sort_order INTEGER,
  is_terminal BOOLEAN,
  color TEXT
);

-- Tasks (タスク本体)
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
  is_deleted BOOLEAN
);

-- Task Events (状態遷移履歴)
CREATE TABLE task_events (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id),
  from_status_id UUID REFERENCES task_statuses(id),
  to_status_id UUID REFERENCES task_statuses(id),
  changed_by TEXT,
  occurred_at TIMESTAMP
);
```

## Testing

### Curl での全エンドポイント検証

```bash
# ログイン
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com"}' | jq -r '.data.access_token')

# タスク一覧
curl http://localhost:3000/api/tasks

# タスク作成
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Test Task"}'

# ダッシュボード
curl http://localhost:3000/api/dashboard/stats

# ヘルスチェック
curl http://localhost:3000/api/health
```

## Next Steps

- [ ] Project①でAPI Server を呼び出すように修正
- [ ] Project③④⑤でも API Server を使用
- [ ] Rate Limiting 追加
- [ ] ロール（admin/editor/viewer）実装
- [ ] テストスイート追加

---

Made with ❤️ for portfolio.yukilabs-core


## 設計判断 / Architecture decisions

[ADR 一覧](docs/adr/README.md) — 設計判断、根拠資料、未決定事項。
