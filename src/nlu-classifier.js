const fs = require('fs');
const { tokenize, stem } = require('./english-stemmer');
const unemojify = require('./unemojify');
const NeuralNetwork = require('./neural-network');

const arrToFeatures = words => words.reduce((prev, current) => (prev[current] = 1, prev), {});

const extractFeatures = str => arrToFeatures(stem(tokenize(unemojify(str))));

const outputToVector = (output, labels, numLabels) => Object.keys(output).reduce((result, label) => {
  if (labels[label] !== undefined) {
    result[labels[label]] = 1;
  }
  return result;
}, new Float32Array(numLabels));

const vectorToOutput = (vector, labelList) => labelList.reduce((result, label, index) => (result[label] = vector[index], result), {});

const inputToVector = (input, features, numFeatures) => {
  const nonedelta = 1 / (Object.keys(input).length * 4)
  const noneindex = features['nonefeature'];
  return Object.keys(input).reduce((prev, current) => {
    const index = features[current];
    prev[index === undefined ? noneindex : index] = index === undefined ? (prev[noneindex] || 0) + nonedelta : input[current];
    return prev;
  }, new Float32Array(numFeatures));
}

const someSimilar = (tokensA, tokensB) => {
  for (let i = 0; i < tokensB.length; i += 1) {
    if (tokensA[tokensB[i]]) {
      return true;
    }
  }
  return false;
}

const getWhitelist = (tokens, labelFeatures) => Object.keys(labelFeatures).reduce((p, c) => 
    (p[c] = someSimilar(tokens, labelFeatures[c]),  p), { None: true });

const normalizeNeural = classifications => {
  const total = classifications.reduce((p, c) => p + c.score ** 2, 0);
  return classifications.map(x => ({
    intent: x.intent,
    score: total > 0 ? x.score ** 2 / total : x.score
  }));
}

module.exports = class NluClassifier {
  constructor(options = {}) {
    this.classifier = new NeuralNetwork(options);
  }

  buildDictionaries(corpus) {
    this.features = {};
    this.labels = {};
    this.numFeatures = 0;
    this.numLabels = 0;
    this.labelList = [];
    this.corpus = corpus;
    this.labelFeatures = {};
    corpus.forEach(item => {
      const { input, output } = item;
      Object.keys(input).forEach(feature => {
        if (this.features[feature] === undefined) {
          this.features[feature] = this.numFeatures;
          this.numFeatures += 1;
        }
      });
      Object.keys(output).forEach(label => {
        if (this.labels[label] === undefined) {
          this.labels[label] = this.numLabels;
          this.labelList.push(label);
          this.numLabels += 1;
        }
        if (this.labelFeatures[label] === undefined) {
          this.labelFeatures[label] = [];
        }
        Object.keys(input).forEach(feature => {
          if (!this.labelFeatures[label].includes(feature)) {
            this.labelFeatures[label].push(feature);
          }
        });
      });
    });
  }

  train(corpus) {
    this.data = [];
    corpus.forEach(item => {
      const { intent, utterances } = item;
      const intentFeatures = arrToFeatures([intent]);
      utterances.forEach(utterance => {
        this.data.push({ input: extractFeatures(utterance), output: intentFeatures });
      })
    });
    this.data.push({ input: { nonefeature: 1 }, output: { None: 1 }});
    const hrstart = process.hrtime();
    this.buildDictionaries(this.data);
    const data = this.data.map(x => ({
      input: inputToVector(x.input, this.features, this.numFeatures),
      output: outputToVector(x.output, this.labels, this.numLabels),
    }));
    this.classifier.train(data);
    const hrend = process.hrtime(hrstart);
    console.info('Trained (hr): %ds %dms', hrend[0], hrend[1] / 1000000);
  }

  run(input) {
    const classifications = vectorToOutput(
      this.classifier.run(inputToVector(input, this.features, this.numFeatures)),
      this.labelList
    );
    const whitelist = getWhitelist(input, this.labelFeatures);
    const result = Object.keys(classifications).map(key => ({ intent: key, score: whitelist[key] ? classifications[key] : 0 }));
    return normalizeNeural(result).sort((a,b) => b.score - a.score);
  }

  classify(input) {
    return this.run(typeof input === 'string' ? extractFeatures(input) : input);
  }

  getBestClassification(input) {
    return this.classify(input)[0];
  }

  getBestIntent(utterance) {
    return this.getBestClassification(utterance).intent;
  }

  evaluate() {
    let good = 0;
    let bad = 0;
    this.data.forEach(item => {
      const classification = this.getBestIntent(item.input);
      if (classification === Object.keys(item.output)[0]) {
        good += 1;
      } else {
        console.log(JSON.stringify(item.input));
        console.log(`Expected: ${Object.keys(item.output)[0]} Received: ${classification}`);
        bad += 1;
      }
    });
    return { good, bad };
  }

  toJSON(neural) {
    const result = {};
    Object.keys(neural).forEach(key => {
      result[key] = neural[key];
    });
    result.perceptrons = [];
    for (let i = 0; i < neural.outputSize; i += 1) {
      const src = neural.perceptrons[i];
      const perceptron = { weights: [], bias: src.bias };
      result.perceptrons.push(perceptron);
      for (let j = 0; j < src.weights.length; j += 1) {
        perceptron.weights.push(src.weights[j]);
      }
    }
    return result;
  }

  fromJSON(neural, obj) {
    Object.keys(obj).forEach(key => {
      neural[key] = obj[key];
    });
    neural.outputs = new Float32Array(neural.outputSize);
    neural.perceptrons = [];
    for (let node = 0; node < neural.outputSize; node += 1) {
      const src = obj.perceptrons[node];
      const perceptron = {
        weights: new Float32Array(src.weights.length),
        changes: new Float32Array(src.weights.length),
        bias: src.bias,
      };
      neural.perceptrons.push(perceptron);
      for (let j = 0; j < src.weights.length; j += 1) {
        perceptron.weights[j] = src.weights[j];
      }
    }
  }

  export(fileName = 'training.net', overwrite = true) {
    if (overwrite || (!fs.existsSync(fileName))) {
      const obj = this.toJSON(this.classifier);
      fs.writeFileSync(fileName, JSON.stringify(obj, null, 2), 'utf8');
    }
  }

  import(fileName = 'training.net') {
    if (fs.existsSync(fileName)) {
      const obj = JSON.parse(fs.readFileSync(fileName, 'utf8'));
      this.fromJSON(this.classifier, obj);
      return true;
    }
    return false;
  }
};
