const serverless = require("serverless-http");
const { createApiApp } = require("../server/createApiApp");

const app = createApiApp();

module.exports = serverless(app);
