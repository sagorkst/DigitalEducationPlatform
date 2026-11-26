const test = require('node:test');
const assert = require('node:assert/strict');

const { BadRequestException } = require('@nestjs/common');
const {
  ImportsController,
} = require('../dist/modules/imports/imports.controller');

function createController(storage) {
  return new ImportsController(
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

test('unsupported embedded image data is rejected instead of being saved in ImportRow JSON', async () => {
  const controller = createController({
    saveQuestionImage: async () => '/uploads/questions/unexpected.webp',
  });

  await assert.rejects(
    controller.persistEmbeddedImages('<img src="data:image/bmp;base64,Qk0=">'),
    BadRequestException,
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
