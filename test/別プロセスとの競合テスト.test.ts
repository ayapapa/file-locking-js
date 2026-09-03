import { describe, expect, it } from 'vitest';
import { PrettyConsole } from '@ayapapa-npm/pretty-console-js';

import { FileLock } from '../src/index';
import { LockBase, type ReentrantContext } from '../src/lib/LockBase.ts';
import { spawn } from 'node:child_process';

async function sleepAsync(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const logger = new PrettyConsole({ level: 'trace' });

FileLock.setConfig({ logger });

describe('別プロセスとの競合テスト', () => {

  // 別プロセスを非同期で実行する関数を用意する。
  async function exec(command: string) {
    spawn(command, {}); // オプションは何かな？　処理結果の受け取りかたは、、コールバックで受け取るのかな？　待つのかな、非同期なのかな？？　要調査。
  } 

  it("別プロセスを先に起動し、別のキーでロックすると、干渉されずにいずれも処理が完了する.", async () => {
  });

  // 以下は、別プロセスと本プロセスが同じキーのときのテスト
  it("別プロセスを先に起動し、それを待ってロックが完了する.", async () => {
  });

  it("別プロセスを先に起動し、最大待ち時間内に終わらないので、タイムアウトエラーになる.", async () => {
  });

  it("別プロセスを先に起動したが、ttlエラーになり、処理はキャンセル状態となったところで、こっちのプロセスはロック処理が進む.", async () => {
  });

  it("別プロセスを先に起動したが、実行中に、強制的にプロセスをキルする。こっちのプロセスは、ロック情報の無効化を確認後ロック処理が進む.", async () => {
  });

  it("すべて別キーの複数のプロセスを同時に数個から数十個起動し、いずれも、問題なく処理が正常終了する。", async () => {
  });

  it("すべて同じキーの複数のプロセスを同時に数個から数十個起動し、いずれも、問題なく処理が正常終了する。（タイムアウトしない程度の設定でテストする）", async () => {
  });


  // そして、上記の先に自分、あとから、別プロセスの順で、同様のことをテストする。
  // 起動した結果が何らかの形で取得できるような仕掛けにする必要ありだね。

});
