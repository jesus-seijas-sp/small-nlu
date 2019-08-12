const { stringToArray } = require('./helper');
const nonSpacingRegex = new RegExp(String.fromCharCode(65039), 'g')
const emojiByName = require('./emoji.json');

const stripNSB = x => x.replace(nonSpacingRegex, '');
const emojiByCode = Object.keys(emojiByName).reduce((prev, current) => (prev[stripNSB(emojiByName[current])] = current, prev), {});
const which = code => {
  const word = emojiByCode[stripNSB(code)];
  return word ? `:${word}:` : code;
}

module.exports = str => str ? stringToArray(str).map(word => which(word)).join('') : '';