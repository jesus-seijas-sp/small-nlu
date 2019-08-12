class NeuralNetwork {
  constructor(options = {}) {
    Object.assign(this, options, {
      maxIterations: 20000,
      errorThresh: 0.000005,
      deltaErrorThresh: 0.00000000001,
      learningRate: 0.7,
      momentum: 0.5,
      alpha: 0.08
    });
  }

  initialize(data) {
    this.outputSize = data[0].output.length;
    this.outputs = new Float32Array(this.outputSize);
    this.perceptrons = [];
    for (let node = 0; node < this.outputSize; node += 1) {
      this.perceptrons.push({
        weights: new Float32Array(data[0].input.length),
        changes: new Float32Array(data[0].input.length),
        bias: 0,
      });
    }
  }

  run(input) {
    const { alpha, outputSize } = this;
    for (let node = 0; node < outputSize; node += 1) {
      const perceptron = this.perceptrons[node];
      const { weights, bias } = perceptron;
      let sum = bias;
      for (let y = 0; y < weights.length; y += 1) {
        if (input[y]) {
          sum += weights[y];
        }
      }
      this.outputs[node] = sum < 0 ? 0 : alpha * sum;
    }
    return this.outputs;
  }

  train(data) {
    if (!this.status) {
      this.status = { error: Infinity, deltaError: Infinity, iterations: 0 };
    }
    if (this.status.iterations >= this.maxIterations ||
      this.status.error <= this.errorThresh ||
      this.status.deltaError <= this.deltaErrorThresh) {
      return this.status;
    }
    this.initialize(data);
    while (
      this.status.iterations < this.maxIterations &&
      this.status.error > this.errorThresh &&
      this.status.deltaError > this.deltaErrorThresh
    ) {
      const hrstart = process.hrtime();
      this.status.iterations += 1;
      const lastError = this.status.error;
      this.status.error = 0;
      for (let i = 0; i < data.length; i += 1) {
        const { input, output } = data[i];
        const outputs = this.run(input);
        this.status.error += this.calculateDeltas(
          input,
          output,
          outputs
        );
      }
      this.status.error /= data.length;
      this.status.deltaError = Math.abs(this.status.error - lastError);
      const hrend = process.hrtime(hrstart);
      console.log(`Epoch ${this.status.iterations} loss ${this.status.error.toFixed(9)} time ${(hrend[0] * 1000 + hrend[1] / 1000000).toFixed(2)}ms delta ${this.status.deltaError.toFixed(9)}`);
    }
    return this.status;
  }

  calculateDeltas(incoming, target, outputs) {
    const { learningRate, alpha, momentum, outputSize } = this;
    let error = 0;
    for (let node = 0; node < outputSize; node += 1) {
      const perceptron = this.perceptrons[node];
      const { changes, weights } = perceptron;
      const output = outputs[node];
      const currentError = target[node] - output;
      if (currentError) {
        error += currentError ** 2;
        const delta = (output >= 0 ? 1 : alpha) * currentError * learningRate;
        for (let k = 0; k < incoming.length; k += 1) {
          const change = delta * incoming[k] + momentum * changes[k];
          changes[k] = change;
          weights[k] += change;
        }
        perceptron.bias += delta;
      } else {
        for (let k; k < incoming.length; k += 1) {
          const change = momentum * changes[k];
          changes[k] = change;
          weights[k] += change;
        }
      }
    }
    return error / outputSize;
  }
}

module.exports = NeuralNetwork;
