# file-lock-js
A file-based lock for coordinating exclusive access between processes.

# Interface <br>
  ```js
  const ret = await FileLock.withLock('lock key', () => { 'ロック中に実行すべき処理'; return result; }, options); 
  // Offcouse you can get callback functions return values.
  ```


# 特徴
* 複数プロセス間において、直列化すべき「資源等へのアクセス処理」を排他的に実行できる。<br>
  例えば、「特定サービスのアクセスを、一度に一回のみ実施する」、「ドキュメントの更新を他プロセスに干渉されずに更新する」、など。
* シンプルで安全なユーザーインターフェイス。　
  利用者は、これを呼ぶだけ: 
  ```js
  const ret = await FileLock.withLock('lock key', () => { 'ロック中に実行すべき処理'; return result; }, options); 
  // Offcouse you can get callback functions return values.
  ```
  このため、ロック解除忘れの心配がない。これは、利用者にとっては親切な設計だと思う。
* 同一プロセス内におけるデッドロックを防ぐことができる。 <br>
  AsyncLocalStorageを利用し同じキーにおける再入ロックを検出可能とした。これにより、慎重なオプション（デフォルト(`{allowReentry: false}`)）では、デッドロック検出エラーとなる。
  もちろん、オプションで、再入ロック可能を指定することも出来る(`{allowReentry: true}`)。この場合、再入ロックについては、ロックをせずに、処理を実施する。ただし、この場合、前段のロック中の処理との干渉が無き事は利用者側で保証する必要がある。
* 堅牢で著名な`proper-filelock`を利用し、本ライブラリの内部で行われる種々のファイルアクセスの排他制御に利用しており、そのおかげで堅牢なプロセス間排他制御を実現できている。
* ロック用に作成したファイルにメタ情報を格納しているため、ロック時点の`Ttl`(Time to live)や`heartbeat timeout`(実行中の処理が終わってからのタイムアウト時間)を格納しているので、ロックの有効性の確認を前段ロックの意向を反映している。