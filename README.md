# tiny-pdf-viewer

ブラウザで PDF を表示する、ビルド不要・単一ページの軽量ビューア。
大きい PDF でも、全体をダウンロードせず必要なページだけを HTTP Range Request で取得して描画する。

設計の詳細は [docs/DESIGN.md](docs/DESIGN.md) を参照。

## 使い方

`index.html` を静的配信し、URL パラメタで起動する。

```
index.html?file_url=/pdfs/novel.pdf&page=10
```

| パラメタ | 必須 | 既定 | 意味 |
|---|---|---|---|
| `file_url` | ✅ | — | 表示する PDF の URL |
| `page` | — | `1` | 初期表示ページ（その番号を含む見開きを表示） |
| `dir` | — | `rtl` | 綴じ方向。`rtl`（右綴じ）/ `ltr`（左綴じ） |
| `spread` | — | `on` | 見開き。`on` / `off`（単ページ） |

### 操作

- スライダー / `◀` `▶` ボタン / `←` `→` キーでページ移動（見開き時はペア単位）。
- 「見開き / 単ページ」トグルで表示モード切替。
- `⛶` で全画面表示。
- 画面が狭いときは見開き設定を保持したまま自動的に単ページ表示へフォールバックする。

## デプロイ

ビルド不要。このフォルダ一式（`index.html` / `js/` / `vendor/`）を Web サーバに置くだけ。

### nginx での配信

```nginx
server {
    listen 80;
    server_name example;

    root /var/www;  # ここに tiny-pdf-viewer/ と pdfs/ を置く

    # application/pdf に gzip をかけないこと（Range が壊れる）
    gzip_types text/css application/javascript;  # application/pdf は含めない

    location / {
        # nginx は静的ファイルで Range Request をデフォルトで返す
        # （Accept-Ranges: bytes / 206 Partial Content）
    }
}
```

注意点（DESIGN.md §2 / §10）:

- **`application/pdf` を gzip 対象に含めない**（Range Request が壊れる）。
- 任意で PDF を linearize しておくと初回表示と堅牢性が向上する: `qpdf --linearize in.pdf out.pdf`

### Range Request の確認

```sh
curl -I -H "Range: bytes=0-1023" https://example/pdfs/big.pdf
# → 206 Partial Content と Content-Range が返れば OK
```

## 開発

`navigation.js`（見開き / 綴じ方向 / スライダー対応の純ロジック）は DOM・PDF.js 非依存で、Node 標準のテストランナーで単体テストする。

```sh
npm test   # node --test
```

描画系（`pdf-core.js` / `viewer.js`）は実 PDF を使った手動確認とする。ローカル確認例:

```sh
python3 -m http.server 8000
# http://localhost:8000/index.html?file_url=/path/to/sample.pdf
```

## 同梱バージョン

- [pdf.js](https://github.com/mozilla/pdf.js)（`pdfjs-dist`）**6.0.227**
  - `vendor/pdfjs/pdf.min.mjs`, `vendor/pdfjs/pdf.worker.min.mjs`
  - 更新時は prebuilt の上記 2 ファイルを差し替え、この記載を更新する。