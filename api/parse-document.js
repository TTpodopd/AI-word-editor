const { handleParseDocument } = require("../server/apiHandlers");
const { withApiHandler } = require("../server/vercelUtils");

module.exports = withApiHandler(handleParseDocument);

module.exports.config = {
  maxDuration: 10,
  memory: 1024,
};
