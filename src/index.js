const readline = require('readline');
const NluClassifier = require('./nlu-classifier');
const corpus = require('../data/corpus.json').filter(x => x.language === 'en');
const classifier = new NluClassifier();

function say(message) {
  console.log(message);
}

function findAnswer(intent) {
  for (let i = 0; i < corpus.length; i += 1) {
    if (corpus[i].intent === intent) {
      return corpus[i].answers[0];
    }
  }
  return 'I don\'t know the answer';
}

(async () => {
  classifier.import();
  await classifier.train(corpus);
  const evaluation = classifier.evaluate();
  const total = evaluation.good + evaluation.bad;
  classifier.export(undefined, false);
  console.log(`Trained! I have ${evaluation.bad} errors of ${total} utterances.`);
  console.log(`My accuracy is ${ (evaluation.good * 100 / total).toFixed(2)}`);
  say('Say something!');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });
  rl.on('line', async line => {
    if (line.toLowerCase() === 'quit') {
      rl.close();
      return process.exit();
    }
    const classifications = await classifier.classify(line);
    const result = classifications[0];
    const gap = classifications[0].score - classifications[1].score;
    const answer = findAnswer(result.intent);
    say(`bot> (${result.intent} - ${result.score} gap: ${gap.toFixed(2)}) ${answer}`);
  })
})();
