function perf() {
  const trace = {
    start: () => {},
    stop: () => {},
    putMetric: () => {},
    getMetric: () => 0,
    putAttribute: () => {},
  };
  return {
    newTrace: () => trace,
    startTrace: async () => trace,
  };
}

export default perf;
