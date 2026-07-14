const serverless = require("serverless-http");
const { createApiApp } = require("../server/createApiApp");

let cachedHandler;

module.exports = async (req, res) => {
  if (!cachedHandler) {
    cachedHandler = serverless(createApiApp());
  }
  return cachedHandler(req, res);
};

module.exports.config = {
  maxDuration: 10,
  memory: 1024,
};
