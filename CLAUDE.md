# api-server

Node.js (Express) REST API。JWT 認証 + RBAC (admin/editor/viewer)。

## コマンド

```bash
npm run dev      # 開発サーバー起動（port 3000、ファイル監視）
npm test         # vitest run（単体テスト）
npm run test:coverage  # カバレッジ付きテスト
```

## 重要な制約

- **ES Modules 必須**：`import/export` のみ。`require()` は使わない
- **レスポンスは必ず APIResponse を使う**：`src/utils/response.js`

```js
APIResponse.success(res, data)
APIResponse.error(res, code, message)
APIResponse.paginated(res, items, total, page, limit)
```

- **JWT**：アクセストークン 7 日、リフレッシュトークン 30 日
- **Supabase キー**：`SUPABASE_KEY` はサービスロールキー（anon キーではない）

## 必須 env

```text
DATABASE_URL / SUPABASE_URL / SUPABASE_KEY
JWT_SECRET（32 文字以上）
JWT_REFRESH_SECRET
```

## エンドポイント確認

```bash
curl http://localhost:3000/api/health
open http://localhost:3000/api-docs  # Swagger UI
```

## 主要ファイル

| ファイル | 役割 |
| --- | --- |
| `src/middleware/roleMiddleware.js` | `requireRole('admin')` ファクトリ |
| `src/services/authService.js` | JWT 署名・検証・リフレッシュ |
| `src/utils/response.js` | APIResponse クラス |
| `swagger.json` | OpenAPI 3.0 仕様書 |
