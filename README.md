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

ビルド不要。実行に必要なのは `index.html` / `js/` / `vendor/` の3つだけ。

`make deploy` でデプロイ先にコピーできる（`js/` と `vendor/` は `--delete` 付き rsync でミラーし、テストなど開発用ファイルは含めない）:

```sh
make deploy                       # 既定の DEST=/mnt/irmagi/tiny-pdf-viewer へ
make deploy DEST=/other/path      # コピー先を変更
```

手動で置く場合も、上記3つを Web サーバの公開ディレクトリにコピーするだけ。

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

## 大きい PDF と linearize

このビューアは pdf.js を「必要分だけ Range で取得する」設定（`disableAutoFetch` /
`disableStream`）で使う。前ページを先頭からダウンロードしないため、配信側が以下を満たすことが前提:

- `Accept-Ranges: bytes` と `Content-Length` を返す。
- `application/pdf` に **gzip / Content-Encoding をかけない**（Range が壊れて全ダウンロードになる）。

その上で、**大きい PDF は linearize（web 最適化）しておくことを強く推奨**する。
非 linearize の PDF は相互参照（xref）がファイル末尾にあり、最初のページを出すまでに
広い範囲を読みに行くため、回線によっては「ほぼ全部ダウンロードしてからやっと表示」に
なりやすい。linearize された PDF は「先頭から1ページ目をすぐ出す」構造（fast web view）を
持つため、Range での部分取得が意図どおり効く。

### linearize されているか確認する

linearization 辞書は仕様上ファイル先頭 1024 バイト以内に必ず収まる。先頭だけ見れば判定できる:

```sh
# ローカル
head -c 1024 file.pdf | grep -a Linearized        # 出力あり → linearized

# リモート（先頭だけ Range 取得）
curl -s -r 0-1023 https://example/pdfs/big.pdf | grep -a Linearized

# 厳密に検証（全体を読むので遅い）
qpdf --check file.pdf                              # "File is linearized" と表示される
```

### linearize する

```sh
qpdf --linearize in.pdf out.pdf
```

- **ロスレス**: ページ・画像・テキスト・ストリームは再エンコードしない（画質劣化なし）。
  オブジェクトの並びと索引を作り直すだけ。
- ファイル全体が書き直されるため、**バイト列・ETag・更新日時が変わる**。サイズはヒント
  テーブルの分わずかに増えることが多い。
- **デジタル署名は無効化される**（署名対象のバイト範囲が変わるため）。インクリメンタル
  更新履歴も統合されて消える。
- 効果が出るのは Range 配信時のみ。後で何か編集すると linearize が外れることがある。

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