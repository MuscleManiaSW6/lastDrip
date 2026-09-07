const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const retry = async (
  operation,
  maxRetries = 3,
  baseDelay = 500,
) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;

      if (attempt === maxRetries) {
        throw lastError;
      }

      const delay = baseDelay * 2 ** attempt;

      await sleep(delay);
    }
  }
};

export { retry };