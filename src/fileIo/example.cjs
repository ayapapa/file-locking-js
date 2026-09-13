'use strict';

const path = require('node:path');
const { FileIoClient } = require('./file-io-client');

(async () => {
  const client = new FileIoClient();

  const baseDir = path.join(__dirname, 'data');
  const file1 = path.join(baseDir, 'a.txt');
  const file2 = path.join(baseDir, 'b.txt');

  await client.mkdir(baseDir, { recursive: true });
  await client.write(file1, 'hello\n');
  await client.append(file1, 'world\n');
  await client.rename(file1, file2);

  const text = await client.read(file2);
  console.log(text);

  await client.rm(file2, { force: true });
})();
