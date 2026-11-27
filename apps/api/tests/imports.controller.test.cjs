const test = require('node:test');
const assert = require('node:assert/strict');

const { BadRequestException } = require('@nestjs/common');
const {
  ImportsController,
} = require('../dist/modules/imports/imports.controller');
const {
  LocalStorageService,
} = require('../dist/modules/users/local-storage.service');
const sharp = require('sharp');
const { readFile, unlink } = require('fs/promises');
const path = require('path');

function createController(storage) {
  return new ImportsController(
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    storage,
  );
}

test('escaped literal \n sequences in MHTML Base64 are normalized', async () => {
  const saved = [];
  const controller = createController({
    saveQuestionImage: async (buffer) => {
      saved.push(Buffer.from(buffer));
      return '/uploads/questions/escaped.webp';
    },
  });
  const result = await controller.persistEmbeddedImages(
    '<img src="data:image/png;base64,AQID\\nBA==">',
  );
  assert.deepEqual(saved[0], Buffer.from([1, 2, 3, 4]));
  assert.match(result, /escaped\.webp/);
});

test('stylesheet Content-ID links are not mistaken for missing image attachments', async () => {
  const controller = createController({
    saveQuestionImage: async () => '/uploads/questions/unexpected.webp',
  });
  const html = '<link rel="stylesheet" href="cid:styles@example.test"><div class="question">Test question</div>';
  assert.equal(await controller.persistEmbeddedImages(html), html);
});

test('embedded HTML Base64 images are stored once and line-wrapped Base64 is normalized', async () => {
  const saved = [];
  const controller = createController({
    saveQuestionImage: async (buffer) => {
      saved.push(Buffer.from(buffer));
      return '/uploads/questions/embedded-image.webp';
    },
  });
  const dataUrl = 'data:image/png;base64,AQID\nBA==';
  const html = `<div><img src="${dataUrl}"><img src="${dataUrl}"></div>`;

  const result = await controller.persistEmbeddedImages(html);

  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0], Buffer.from([1, 2, 3, 4]));
  assert.equal((result.match(/embedded-image\.webp/g) ?? []).length, 2);
  assert.equal(/data:image\//i.test(result), false);
});

test('embedded SVG and static GIF references are persisted instead of left as Base64', async () => {
  const saved = [];
  const controller = createController({
    saveQuestionImage: async (buffer) => {
      saved.push(Buffer.from(buffer));
      return `/uploads/questions/image-${saved.length}.webp`;
    },
  });
  const html = [
    '<img src="data:image/svg+xml;base64,PHN2Zy8+">',
    '<img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=">',
  ].join('');

  const result = await controller.persistEmbeddedImages(html);

  assert.equal(saved.length, 2);
  assert.equal(/data:image\//i.test(result), false);
  assert.match(result, /image-1\.webp/);
  assert.match(result, /image-2\.webp/);
});

test('embedded image decoder errors are propagated instead of persisting invalid data URIs', async () => {
  const controller = createController({
    saveQuestionImage: async () => {
      throw new BadRequestException('The image could not be decoded.');
    },
  });

  await assert.rejects(
    controller.persistEmbeddedImages('<img src="data:image/bmp;base64,Qk0=">'),
    (error) =>
      error instanceof BadRequestException &&
      error.message === 'The image could not be decoded.',
  );
});

test('unresolved MHTML Content-ID references are rejected', async () => {
  const controller = createController({
    saveQuestionImage: async () => '/uploads/questions/unexpected.webp',
  });

  await assert.rejects(
    controller.persistEmbeddedImages('<img src="cid:missing-attachment">'),
    BadRequestException,
  );
});


test('real question image storage converts SVG, GIF and TIFF inputs to WebP', async () => {
  const storage = new LocalStorageService();
  const savedPaths = [];

  try {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#ffffff"/></svg>',
    );
    const gif = Buffer.from(
      'R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
      'base64',
    );
    const tiff = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#ffffff' } })
      .tiff()
      .toBuffer();

    savedPaths.push(await storage.saveQuestionImage(svg));
    savedPaths.push(await storage.saveQuestionImage(gif));
    savedPaths.push(await storage.saveQuestionImage(tiff));

    for (const publicPath of savedPaths) {
      const diskPath = path.resolve(
        process.cwd(),
        'uploads',
        'questions',
        path.basename(publicPath),
      );
      const metadata = await sharp(await readFile(diskPath)).metadata();
      assert.equal(metadata.format, 'webp');
    }
  } finally {
    await Promise.all(
      savedPaths.map((publicPath) =>
        unlink(
          path.resolve(
            process.cwd(),
            'uploads',
            'questions',
            path.basename(publicPath),
          ),
        ).catch(() => undefined),
      ),
    );
  }
});
