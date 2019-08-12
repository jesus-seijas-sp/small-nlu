const englishTokens = require('./english-stemmer-tokens.json');

const { tokens2, tokens3 } = englishTokens;
const gt0 = new RegExp('^([^aeiou][^aeiouy]*)?([aeiouy][aeiou]*)([^aeiou][^aeiouy]*)');
const gt1 = new RegExp('^([^aeiou][^aeiouy]*)?(([aeiouy][aeiou]*)([^aeiou][^aeiouy]*)){2,}');
const eq1 = new RegExp('^([^aeiou][^aeiouy]*)?([aeiouy][aeiou]*)([^aeiou][^aeiouy]*)([aeiouy][aeiou]*)?$');
const vowelInStem = new RegExp('^([^aeiou][^aeiouy]*)?[aeiouy]');
const consonantLike = new RegExp('^([^aeiou][^aeiouy]*)[aeiouy][^aeiouwxy]$');
const step2reg = new RegExp(`^(.+?)(${Object.keys(tokens2).join('|')})$`);
const step3reg = new RegExp(`^(.+?)(${Object.keys(tokens3).join('|')})$`);
const step4reg = new RegExp('^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$');

function step1(input) {
  let value = input;
  let match;
  if (/^.+?(ss|i)es$/.test(value)) {
    value = value.slice(0, -2);
  } else if (/^.+?[^s]s$/.test(value)) {
    value = value.slice(0, -1);
  }
  if (match = /^(.+?)eed$/.exec(value)) {
    if (gt0.test(match[1])) {
      value = value.slice(0, -1);
    }
  } else if ((match = /^(.+?)(ed|ing)$/.exec(value)) && vowelInStem.test(match[1])) {
    value = match[1];
    if (/(at|bl|iz)$/.test(value)) {
      value = `${value}e`;
    } else if (/([^aeiouylsz])\1$/.test(value)) {
      value = value.slice(0, -1);
    } else if (consonantLike.test(value)) {
      value += 'e';
    }
  }
  if (match = /^(.+?)eed$/.exec(value)) {
    if (gt0.test(match[1])) {
      value = value.slice(0, -1);
    }
  } else if ((match = /^(.+?)(ed|ing)$/.exec(value)) && vowelInStem.test(match[1])) {
    value = match[1];
  }
  if ((match = /^(.+?)y$/.exec(value)) && vowelInStem.test(match[1])) {
    value = `${match[1]}i`;
  }
  return value;
}

function stepRegList(input, reg, list) {
  let value = input;
  let match;
  if ((match = reg.exec(value)) && gt0.test(match[1])) {
    value = `${match[1]}${list[match[2]]}`;
  }
  return value;
}

const step2 = input => stepRegList(input, step2reg, tokens2);

const step3 = input => stepRegList(input, step3reg, tokens3);

function step4(input) {
  let value = input;
  let match;
  if (match = step4reg.exec(value)) {
    if (gt1.test(match[1])) {
      value = match[1];
    }
  } else if ((match = /^(.+?(s|t))(ion)$/.exec(value)) && gt1.test(match[1])) {
    value = match[1];
  }
  return value;
}

function step5(input) {
  let value = input;
  let match;
  if ((match = /^(.+?)e$/.exec(value)) && (gt1.test(match[1]) || (eq1.test(match[1]) && !consonantLike.test(match[1])))) {
    value = match[1];  
  }
  if (/ll$/.test(value) && gt1.test(value)) {
    value = value.slice(0, -1);
  }
  return value;
}

function step6(input) {
  switch(input.toLowerCase()) {
    case 'your': return 'you';
    case 'are': return 'is';
    default: return input;
  }
}

function stemToken(input) {
  let value = input.toLowerCase().trim();
  if (value.length < 3) {
    return value;
  }
  if (value.charAt(0) === 'y') {
    value = `Y${value.substr(1)}`;
  }
  return step6(step5(step4(step3(step2(step1(value)))))).toLowerCase();
}

const replaceContractions = text => {
  let result = text.replace(/n't([ ,:;.!?]|$)/gi, ' not ');
  result = result.replace(/'s([ ,:;.!?]|$)/gi, ' is ');
  result = result.replace(/'re([ ,:;.!?]|$)/gi, ' are ');
  result = result.replace(/'ve([ ,:;.!?]|$)/gi, ' have ');
  result = result.replace(/'m([ ,:;.!?]|$)/gi, ' am ');
  result = result.replace(/'d([ ,:;.!?]|$)/gi, ' had ');
  return result;
};

const tokenize = text => replaceContractions(text).split(/\W+/);

const stem = input => (Array.isArray(input) ? input : [input]).map(x => stemToken(x));

module.exports = {
  tokenize,
  stem
}
