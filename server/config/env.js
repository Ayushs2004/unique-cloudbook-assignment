const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const REQUIRED_VARS = ['VERIFY_TOKEN', 'APP_SECRET', 'PAGE_ACCESS_TOKEN'];

/**
 * Validates the provided environment object against required configuration keys.
 * @param {NodeJS.ProcessEnv} [envToValidate=process.env]
 * @returns {{ PORT: number, VERIFY_TOKEN: string, APP_SECRET: string, PAGE_ACCESS_TOKEN: string }}
 */
function validateEnv(envToValidate = process.env) {
  const missing = REQUIRED_VARS.filter((key) => !envToValidate[key] || envToValidate[key].trim() === '');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. Please check your .env file or environment settings.`
    );
  }

  const port = parseInt(envToValidate.PORT || '3000', 10);
  if (isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT specified: ${envToValidate.PORT}. Must be a valid positive number.`);
  }

  return {
    PORT: port,
    VERIFY_TOKEN: envToValidate.VERIFY_TOKEN,
    APP_SECRET: envToValidate.APP_SECRET,
    PAGE_ACCESS_TOKEN: envToValidate.PAGE_ACCESS_TOKEN,
  };
}

module.exports = {
  validateEnv,
  get env() {
    return validateEnv(process.env);
  },
};
