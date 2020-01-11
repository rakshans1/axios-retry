import axios from "axios";

const server = axios.create({ baseURL: "https://httpstat.us", timeout: 15000 });

server.interceptors.request.use(config => {
  return config;
});

const defaultRetryOptions = {
  retries: 2,
  retryStatusCodes: [408, 413, 429, 500, 502, 503, 504],
  retryMethods: ["get", "put", "head", "delete", "options", "trace"],
  retryCodes: ["ECONNABORTED"]
};

const retryCondition = (error, options) => {
  const { retryMethods, retryStatusCodes, retryCodes } = options;
  const { config, response, code } = error;
  const { status } = response || {};
  const { method } = config;
  if (retryCodes.includes(code)) return true;
  if (!retryMethods.includes(method)) return false;
  if (!retryStatusCodes.includes(status)) return false;
  return true;
};

const getRequestDelay = (error, retryCount, options) => {
  const { code } = error;
  const { retryCodes } = options;
  if (retryCodes.includes(code)) return 0;
  if (retryCount === 0 ) return 0;
  const BACKOFF_FACTOR = 0.3;
  return BACKOFF_FACTOR * 2 ** (retryCount - 1) * 1000;
};

server.interceptors.response.use(null, error => {
  const { config } = error;
  if (!config) {
    return Promise.reject(error);
  }
  const { retry, retryCount = 0 } = config;
  const retryOptions = {
    ...defaultRetryOptions
  };
  if (retry !== undefined) {
    retryOptions.retries = retry;
  }
  const shouldRetry =
    retryCondition(error, retryOptions) && retryCount < retryOptions.retries;
  if (!shouldRetry) return Promise.reject(error);

  const delay = getRequestDelay(error, retryCount, retryOptions);
  console.log("delay", delay);
  config.retryCount = retryCount + 1;
  return new Promise(resolve =>
    setTimeout(() => resolve(server(config)), delay)
  );
});

server
  .get("/500?sleep=2000", {
    retry: 3
  })
  .then(resp => {
    console.log("data", resp.data);
  })
  .catch(err => {
    console.log("error", err.message);
  });
