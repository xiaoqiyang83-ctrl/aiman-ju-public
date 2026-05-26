const fs = require('fs');
const path = require('path');

const REF_DIR = path.join(
  __dirname,
  '../data/character_reference_images'
);

function ensureCharacterDir(characterId) {
  const dir = path.join(REF_DIR, characterId);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return dir;
}

function saveReferenceImage(characterId, type, imageBuffer) {
  const dir = ensureCharacterDir(characterId);

  const filePath = path.join(dir, `${type}.png`);

  fs.writeFileSync(filePath, imageBuffer);

  return filePath;
}

function getReferenceImage(characterId, type = 'best') {
  const filePath = path.join(
    REF_DIR,
    characterId,
    `${type}.png`
  );

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return filePath;
}

module.exports = {
  saveReferenceImage,
  getReferenceImage
};