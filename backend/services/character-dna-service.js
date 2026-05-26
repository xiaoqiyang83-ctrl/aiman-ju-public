const fs = require('fs');
const path = require('path');

const DNA_DIR = path.join(__dirname, '../data/character_memory');

function ensureDir() {
  if (!fs.existsSync(DNA_DIR)) {
    fs.mkdirSync(DNA_DIR, { recursive: true });
  }
}

function getCharacterDNAPath(characterId) {
  ensureDir();
  return path.join(DNA_DIR, `${characterId}.json`);
}

function saveCharacterDNA(characterId, dna) {
  const filePath = getCharacterDNAPath(characterId);

  fs.writeFileSync(
    filePath,
    JSON.stringify(dna, null, 2),
    'utf8'
  );

  return dna;
}

function loadCharacterDNA(characterId) {
  const filePath = getCharacterDNAPath(characterId);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(
    fs.readFileSync(filePath, 'utf8')
  );
}

function buildStructuredPrompt(dna, extraPrompt = '') {
  const parts = [];

  parts.push('same character');

  if (dna.gender) {
    parts.push(dna.gender);
  }

  if (dna.face) {
    parts.push(dna.face);
  }

  if (dna.hair) {
    parts.push(dna.hair);
  }

  if (dna.clothing) {
    parts.push(dna.clothing);
  }

  if (dna.style) {
    parts.push(dna.style);
  }

  parts.push('consistent character design');
  parts.push('consistent face');
  parts.push('consistent hairstyle');
  parts.push('consistent clothing');

  if (extraPrompt) {
    parts.push(extraPrompt);
  }

  return parts.join(', ');
}

module.exports = {
  saveCharacterDNA,
  loadCharacterDNA,
  buildStructuredPrompt
};